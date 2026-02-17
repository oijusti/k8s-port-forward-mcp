# Developer Guide

## Build from source

```bash
cd k8s-port-forward-mcp
npm install
npm run build
```

Then reference the built entrypoint in your MCP config:

```json
{
  "mcpServers": {
    "k8s-port-forward": {
      "command": "node",
      "args": ["/path/to/k8s-port-forward-mcp/dist/index.js"]
    }
  }
}
```

## Workflow

1. Call list_k8s_services (and optionally list_k8s_namespaces) to discover exact service short names and namespaces.
2. Call start_k8s_port_forward with services set to an array of configs (one per service).
3. When done, call stop_k8s_port_forward.

## Output and Logs

- The MCP server runs as a separate process.
- Port-forwards run in the MCP server process; output is **prefixed per service**.
- When `includeLogs` is enabled, logs open in a **separate OS-level terminal window**.
- The tool response includes the exact `kubectl` commands, so you can copy/paste them into your own terminals if preferred.

## Configuration

This server currently does **not** expose additional CLI flags beyond the MCP stdio transport. Most configuration happens through tool arguments:

- `start_k8s_port_forward.services[].namespace` — pick a specific namespace
- `start_k8s_port_forward.services[].environment` — one of `dev`, `qa`, `stg`, `prod` (used to resolve the right pod)
- `start_k8s_port_forward.services[].remotePort` — set a remote port explicitly (otherwise detected from the Service; defaults to `3000` if detection fails)
- `start_k8s_port_forward.services[].includeLogs` — open a separate log window (default: `true`)
