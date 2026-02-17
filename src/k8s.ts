import { exec } from "node:child_process";

/** Run a shell command and return stdout; reject on exit code or stderr. */
export function execPromise(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else if (stderr && stderr.trim()) {
        reject(new Error(stderr));
      } else {
        resolve(stdout ?? "");
      }
    });
  });
}

const ENV_PREFIXES = ["dev", "qa", "stg", "prod"] as const;

export interface ServiceDetails {
  id: string;
  namespace: string;
  serviceName: string;
}

export type ServicesMap = Map<string, Record<string, ServiceDetails>>;

/**
 * Parse `kubectl get pods` output into a map: shortName -> { env -> details }.
 * Pod names are assumed to be like "dev-b2b-ecommerce-xx-yy": last two segments
 * are the id, the rest is the full service name; we derive env (dev/qa/stg/prod)
 * from prefix and short name by stripping env and optional namespace prefix.
 */
export function parseServicesMap(
  podsData: string,
  namespace: string | null
): ServicesMap {
  const servicesMap = new Map<string, Record<string, ServiceDetails>>();
  const lines = podsData.trim().split("\n");
  if (lines.length === 0) return servicesMap;

  const headers = lines[0].split(/\s+/);
  const namespaceIndex = headers.indexOf("NAMESPACE");
  const nameIndex = headers.indexOf("NAME");
  const statusIndex = headers.indexOf("STATUS");

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(/\s+/);

    const statusColumn = statusIndex !== -1 ? columns[statusIndex] : undefined;
    if (statusColumn !== undefined && statusColumn !== "Running") {
      continue;
    }

    const namespaceColumn = namespace ?? columns[namespaceIndex];
    const nameColumn = columns[nameIndex];

    const envPrefix =
      ENV_PREFIXES.find((env) => nameColumn.startsWith(`${env}-`)) ?? "default";

    const parts = nameColumn.split("-");
    if (parts.length > 2) {
      const serviceName = parts.slice(0, -2).join("-");
      const serviceId = parts.slice(-2).join("-");

      // Short name for display: strip "dev-", "qa-", etc. and optional "namespace-"
      const envPrefixStripRegex = new RegExp(
        `^(${ENV_PREFIXES.join("|")})-`
      );
      let shortServiceName = serviceName.replace(envPrefixStripRegex, "");
      if (namespaceColumn) {
        shortServiceName = shortServiceName.replace(
          new RegExp(`^${namespaceColumn}-`, "g"),
          ""
        );
      }

      if (!servicesMap.has(shortServiceName)) {
        servicesMap.set(shortServiceName, {});
      }
      const envMap = servicesMap.get(shortServiceName)!;
      envMap[envPrefix] = {
        id: serviceId,
        namespace: namespaceColumn,
        serviceName,
      };
    }
  }
  return servicesMap;
}

export async function getNamespaces(): Promise<string[]> {
  const cmd =
    "kubectl get namespaces -o jsonpath={.items[*].metadata.name}";
  const out = await execPromise(cmd);
  return out.trim() ? out.trim().split(/\s+/) : [];
}

export async function getPods(namespace: string | undefined): Promise<string> {
  const cmd = namespace
    ? `kubectl get pods --namespace ${namespace}`
    : "kubectl get pods --all-namespaces";
  return execPromise(cmd);
}

export async function getServicePort(
  serviceNamespace: string,
  serviceName: string
): Promise<string> {
  try {
    const cmd = `kubectl get service --namespace ${serviceNamespace} ${serviceName} -o jsonpath={.spec.ports[*].port}`;
    const port = await execPromise(cmd);
    return port?.trim() || "3000";
  } catch {
    return "3000";
  }
}

/**
 * Resolve short name + optional namespace/environment to pod namespace, pod name, service name, and environment.
 * If namespace is given, we pick the environment that lives in that namespace; otherwise we use
 * the given environment or the first one in the map.
 */
export function resolveService(
  servicesMap: ServicesMap,
  shortServiceName: string,
  options: { namespace?: string; environment?: string }
): { namespace: string; podName: string; serviceName: string; environment: string } | null {
  const envMap = servicesMap.get(shortServiceName);
  if (!envMap) return null;

  let env = options.environment;
  if (options.namespace) {
    const entry = Object.entries(envMap).find(
      ([_, d]) => d.namespace === options.namespace
    );
    if (entry) {
      const [resolvedEnv, details] = entry;
      const podName = `${details.serviceName}-${details.id}`;
      return {
        namespace: details.namespace,
        podName,
        serviceName: details.serviceName,
        environment: resolvedEnv,
      };
    }
  }

  if (!env) env = Object.keys(envMap)[0];
  const details = envMap[env];
  if (!details) return null;

  const podName = `${details.serviceName}-${details.id}`;
  return {
    namespace: details.namespace,
    podName,
    serviceName: details.serviceName,
    environment: env,
  };
}
