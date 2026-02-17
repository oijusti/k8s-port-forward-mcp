#!/usr/bin/env node

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  getNamespaces,
  getPods,
  parseServicesMap,
  getServicePort,
  resolveService,
} from "./k8s.js";
import { openLogsInTerminal, isValidPort } from "./util.js";

const server = new Server(
  {
    name: "k8s-port-forward-mcp",
    version: "0.0.6",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const serviceConfigSchema = {
  type: "object" as const,
  properties: {
    serviceName: {
      type: "string" as const,
      description:
        "Short name of the service (e.g. b2b-ecommerce, b2b-ticketing). Call list_k8s_services first to get exact names.",
    },
    namespace: {
      type: "string" as const,
      description:
        "Optional: Namespace to target (e.g. shared-services). Use when the user says 'from shared services namespace'.",
    },
    localPort: {
      type: "number" as const,
      description: "Local port to bind (e.g. 3000, 3002).",
    },
    remotePort: {
      type: "number" as const,
      description:
        "Optional: Remote (cluster) port. If omitted, the server detects it (default 3000 on failure).",
    },
    environment: {
      type: "string" as const,
      description:
        "Optional: Environment (dev, qa, stg, prod) for resolving the service.",
    },
    includeLogs: {
      type: "boolean" as const,
      description:
        "Optional: Open logs in a separate window for this service (default: true).",
    },
  },
  required: ["serviceName", "localPort"],
};

// Tool Definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "start_k8s_port_forward",
        description:
          "Starts port forwarding for one or more Kubernetes services. Call list_k8s_services (and optionally list_k8s_namespaces) first to resolve exact service names and namespaces. All port-forwards run in a single session; logs open in separate OS windows when includeLogs is true.",
        inputSchema: {
          type: "object",
          properties: {
            services: {
              type: "array",
              description:
                "Array of service configs; each can use different localPort, remotePort, namespace.",
              items: serviceConfigSchema,
            },
          },
          required: ["services"],
        },
      },
      {
        name: "list_k8s_services",
        description:
          "Retrieves a list of all available Kubernetes services grouped by short name and environment. Use this to find exact service names and namespaces before calling start_k8s_port_forward.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Optional: Filter by namespace",
            },
          },
        },
      },
      {
        name: "list_k8s_namespaces",
        description: "List all available Kubernetes namespaces.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "stop_k8s_port_forward",
        description: "Stop all active Kubernetes port-forward processes.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

interface ResolvedService {
  namespace: string;
  podName: string;
  localPort: number;
  remotePort: number;
  label: string;
  includeLogs: boolean;
  environment: string;
}

// Global process tracker for stopping port-forwards
const portForwardProcesses: ReturnType<typeof spawn>[] = [];

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = (text: string) => ({
    content: [{ type: "text" as const, text }],
  });

  if (name === "list_k8s_namespaces") {
    try {
      const namespaces = await getNamespaces();
      const text =
        namespaces.length > 0
          ? `Namespaces:\n${namespaces.map((n) => `- ${n}`).join("\n")}`
          : "No namespaces found.";
      return result(text);
    } catch (err) {
      return result(
        `Failed to list namespaces: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (name === "list_k8s_services") {
    try {
      const namespace =
        typeof args?.namespace === "string" ? args.namespace : undefined;
      const podsData = await getPods(namespace);
      const servicesMap = parseServicesMap(podsData, namespace ?? null);
      const lines: string[] = [
        "Services (shortName -> environments and namespace):",
      ];
      for (const [shortName, envMap] of Array.from(servicesMap.entries()).sort(
        (a, b) => a[0].localeCompare(b[0]),
      )) {
        const envList = Object.entries(envMap)
          .map(([env, d]) => `${env} (ns: ${d.namespace})`)
          .join(", ");
        lines.push(`- ${shortName}: ${envList}`);
      }
      return result(lines.length > 1 ? lines.join("\n") : "No services found.");
    } catch (err) {
      return result(
        `Failed to list services: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (name === "start_k8s_port_forward") {
    const services = args?.services;
    if (!Array.isArray(services) || services.length === 0) {
      return result(
        "Error: 'services' must be a non-empty array of objects with serviceName and localPort.",
      );
    }

    // Fetch all namespaces so we can resolve any service (e.g. in shared-services)
    const podsData = await getPods(undefined);
    const servicesMap = parseServicesMap(podsData, null);

    const resolved: ResolvedService[] = [];
    const errors: string[] = [];

    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      if (!s || typeof s !== "object") {
        errors.push(`Entry ${i + 1}: invalid object`);
        continue;
      }
      // Normalise types: AI/clients may send numbers as strings
      const serviceName =
        typeof s.serviceName === "string" ? s.serviceName.trim() : "";
      const localPort =
        typeof s.localPort === "number" ? s.localPort : Number(s.localPort);
      const remotePort =
        s.remotePort != null
          ? typeof s.remotePort === "number"
            ? s.remotePort
            : Number(s.remotePort)
          : null;
      const namespace =
        typeof s.namespace === "string" ? s.namespace : undefined;
      const environment =
        typeof s.environment === "string" ? s.environment : undefined;
      const includeLogs = s.includeLogs !== false;

      if (!serviceName) {
        errors.push(`Entry ${i + 1}: serviceName is required`);
        continue;
      }
      if (!isValidPort(localPort)) {
        errors.push(`Entry ${i + 1}: localPort must be 1-65535`);
        continue;
      }
      if (remotePort != null && !isValidPort(remotePort)) {
        errors.push(`Entry ${i + 1}: remotePort must be 1-65535`);
        continue;
      }

      const resolvedOne = resolveService(servicesMap, serviceName, {
        namespace,
        environment,
      });
      if (!resolvedOne) {
        errors.push(
          `Entry ${i + 1}: could not resolve service "${serviceName}"${namespace ? ` in namespace ${namespace}` : ""}. Call list_k8s_services to see available names.`,
        );
        continue;
      }

      let remotePortFinal: number;
      if (remotePort != null) {
        remotePortFinal = remotePort;
      } else {
        // Detect service port from cluster when not provided
        const detected = await getServicePort(
          resolvedOne.namespace,
          resolvedOne.serviceName,
        );
        remotePortFinal = parseInt(detected, 10) || 3000;
      }

      const envLabel =
        resolvedOne.environment !== "default"
          ? `${resolvedOne.environment}~`
          : "";
      resolved.push({
        namespace: resolvedOne.namespace,
        podName: resolvedOne.podName,
        localPort,
        remotePort: remotePortFinal,
        label: `${envLabel}${serviceName}:${localPort}`,
        includeLogs,
        environment: resolvedOne.environment,
      });
    }

    if (errors.length > 0) {
      return result(`Validation/resolution errors:\n${errors.join("\n")}`);
    }

    const shutdown = () => {
      for (const p of portForwardProcesses) {
        try {
          p.kill();
        } catch {
          // ignore
        }
      }
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    const commands: string[] = [];

    // Open log windows first so they are ready before port-forwards start
    for (const r of resolved) {
      if (r.includeLogs) {
        const logsCommand = `kubectl logs --namespace ${r.namespace} ${r.podName} -f`;
        commands.push(`# Logs: ${logsCommand}`);
        openLogsInTerminal(logsCommand, r.label);
      }
    }

    // Spawn all port-forwards in this process (single "terminal"); prefix output for clarity
    for (const r of resolved) {
      const portForwardArgs = [
        "port-forward",
        "--namespace",
        r.namespace,
        r.podName,
        `${r.localPort}:${r.remotePort}`,
      ];
      const portForwardCommand = `kubectl ${portForwardArgs.join(" ")}`;
      commands.push(portForwardCommand);

      const p = spawn("kubectl", portForwardArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      portForwardProcesses.push(p);

      const prefix = `[${r.label}]`;
      // MCP uses stdout for protocol; write kubectl output to stderr so it doesn't break the stream
      p.stdout?.on("data", (data: Buffer) => {
        process.stderr.write(`${prefix} ${data.toString()}`);
      });
      p.stderr?.on("data", (data: Buffer) => {
        process.stderr.write(`${prefix} ${data.toString()}`);
      });
      p.on("close", (code) => {
        process.stderr.write(
          `${prefix} port-forward exited with code ${code}\n`,
        );
      });
    }

    const summary = resolved
      .map(
        (r) =>
          `- ${r.label} -> http://localhost:${r.localPort} (pod ${r.podName})`,
      )
      .join("\n");
    const commandsBlock =
      "To run in a VS Code terminal instead, use:\n```\n" +
      commands.join("\n") +
      "\n```";

    return result(
      `Port forwarding started for ${resolved.length} service(s):\n${summary}\n\n${commandsBlock}`,
    );
  }

  if (name === "stop_k8s_port_forward") {
    const killedCount = portForwardProcesses.length;

    // Send SIGINT (graceful shutdown) to all processes
    for (const p of portForwardProcesses) {
      try {
        p.kill("SIGINT");
      } catch {
        // ignore
      }
    }

    // Give processes 500ms to shut down gracefully
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Force-kill any remaining processes with SIGKILL
    for (const p of portForwardProcesses) {
      try {
        p.kill("SIGKILL");
      } catch {
        // ignore
      }
    }

    // Clear the list
    portForwardProcesses.length = 0;

    const message =
      killedCount > 0
        ? `Stopped ${killedCount} port-forward process(es).`
        : "No active port-forwards to stop.";
    process.stderr.write(`${message}\n`);
    return result(message);
  }

  return result(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kubernetes Port Forward — MCP Server: running on stdio");
}

// Only run main when this file is executed directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
