## Kubernetes Port Forward MCP

A Model Context Protocol (MCP) server that provides tools for discovering Kubernetes services and running `kubectl port-forward` sessions (optionally with separate log windows). It is designed for MCP clients/LLMs that translate natural language into structured tool calls.

### Kubernetes Port Forward MCP vs `kubectl port-forward`

This package provides an **MCP interface** on top of the standard `kubectl` workflow.

- **`kubectl`**: Great when you already know the exact namespace/pod/ports. You run commands manually and manage multiple terminals yourself.
- **MCP**: Better when an agent needs to _discover_ services and run multiple port-forwards in a single session via tools (plus optional log windows), while returning copy/paste-ready commands.

### Key Features

- **Service discovery**: list namespaces and infer services (short name → environments → namespace) from running pods.
- **Multi-service in one session**: start multiple port-forwards with one tool call.
- **LLM-friendly API**: `start_k8s_port_forward` accepts an array so each service can use different `namespace`, `environment`, `localPort`, and `remotePort`.
- **Optional logs**: open `kubectl logs -f` in a separate OS-level terminal window per service.

### Requirements

- Node.js 18 or newer
- `kubectl` installed and configured with access to your cluster
- VS Code, Cursor, Windsurf, Claude Desktop, Cline, or any other MCP client

### Getting started

First, install the Kubernetes Port Forward MCP server with your client.

**Standard config** works in most MCP clients:

```js
{
  "mcpServers": {
    "k8s-port-forward": {
      "command": "npx",
      "args": ["-y", "k8s-port-forward-mcp@latest"]
    }
  }
}
```

<details>
<summary>Cline</summary>

Follow the instruction in the section [Configuring MCP Servers](https://docs.cline.bot/mcp/configuring-mcp-servers)

**Example:** add to your `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "k8s-port-forward": {
      "type": "stdio",
      "command": "npx",
      "timeout": 30,
      "args": ["-y", "k8s-port-forward-mcp@latest"],
      "disabled": false
    }
  }
}
```

</details>

<details>
<summary>Claude Code</summary>

```bash
claude mcp add k8s-port-forward npx -y k8s-port-forward-mcp@latest
```

</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user) and use the standard config above.

</details>

<details>
<summary>Cursor</summary>

Go to `Cursor Settings` → `MCP` → `Add new MCP Server` and paste the standard config above.

</details>

### Configuration

This server currently does **not** expose additional CLI flags beyond the MCP stdio transport. Most configuration happens through tool arguments:

- `start_k8s_port_forward.services[].namespace` — pick a specific namespace
- `start_k8s_port_forward.services[].environment` — one of `dev`, `qa`, `stg`, `prod` (used to resolve the right pod)
- `start_k8s_port_forward.services[].remotePort` — set a remote port explicitly (otherwise detected from the Service; defaults to `3000` if detection fails)
- `start_k8s_port_forward.services[].includeLogs` — open a separate log window (default: `true`)

### Output and logs

- The MCP server runs as a separate process and **cannot create VS Code integrated terminals**.
- Port-forwards run in the MCP server process; output is **prefixed per service**.
- When `includeLogs` is enabled, logs open in a **separate OS-level terminal window**.
- The tool response includes the exact `kubectl` commands, so you can copy/paste them into your own terminals if preferred.

### Tools

<details>
<summary><b>Service discovery</b></summary>

- **list_k8s_namespaces**
  - Title: List namespaces
  - Description: List all available Kubernetes namespaces.
  - Parameters: None
  - Read-only: **true**

- **list_k8s_services**
  - Title: List services
  - Description: List available services grouped by short name and environment.
  - Parameters:
    - `namespace` (string, optional): Filter results to a namespace.
  - Read-only: **true**

</details>

<details>
<summary><b>Port forwarding</b></summary>

- **start_k8s_port_forward**
  - Title: Start port-forward
  - Description: Start port-forwarding for one or more services.
  - Parameters:
    - `services` (array, required): List of service configs.
      - `serviceName` (string, required): Short name of the service. (Call `list_k8s_services` first.)
      - `localPort` (number, required): Local port to bind (1-65535).
      - `namespace` (string, optional): Namespace to target.
      - `remotePort` (number, optional): Remote (cluster) port.
      - `environment` (string, optional): `dev` | `qa` | `stg` | `prod`.
      - `includeLogs` (boolean, optional): Whether to open logs in a separate window (default: true).
  - Read-only: **false**

- **stop_k8s_port_forward**
  - Title: Stop port-forward
  - Description: Stop all active port-forward processes started by this MCP server.
  - Parameters: None
  - Read-only: **false**

</details>

### Workflow

1. Call **`list_k8s_services`** (and optionally **`list_k8s_namespaces`**) to discover exact service short names and namespaces.
2. Call **`start_k8s_port_forward`** with `services` set to an array of configs (one per service).
3. When done, call **`stop_k8s_port_forward`**.

### Examples

#### Quick reference (natural language → tool calls)

- **"Run api and auth services on local ports 3002, 3003"**  
  → `list_k8s_services({})` then `start_k8s_port_forward({ services: [{ serviceName: "api", localPort: 3002 }, { serviceName: "auth", localPort: 3003 }] })`

- **"Run order service from shared services namespace in local port 3000"**  
  → `start_k8s_port_forward({ services: [{ serviceName: "order", namespace: "shared-services", localPort: 3000 }] })`

- **"Run order service from shared services namespace and remote port 3000 in local port 3000"**  
  → `start_k8s_port_forward({ services: [{ serviceName: "order", namespace: "shared-services", localPort: 3000, remotePort: 3000 }] })`

- **"Run api service in qa environment on local port 3001"**  
  → `start_k8s_port_forward({ services: [{ serviceName: "api", environment: "qa", localPort: 3001 }] })`

- **"Run auth service in prod environment from production namespace on local port 3002"**  
  → `start_k8s_port_forward({ services: [{ serviceName: "auth", environment: "prod", namespace: "production", localPort: 3002 }] })`

- **"Stop all port-forwards"**  
  → `stop_k8s_port_forward({})`

#### Detailed workflow example

**User**: _"Run the frontend service in qa on port 3001"_

**AI workflow**:

1. Call `list_k8s_services({})` to find the exact service name.
2. Receive list containing e.g. `frontend: qa (ns: ...), dev (ns: ...)`.
3. Call `start_k8s_port_forward({ services: [{ serviceName: "frontend", environment: "qa", localPort: 3001 }] })`.
4. Result: port-forwards run in the MCP server process; if `includeLogs` is true, logs open in a separate window. The tool result includes `http://localhost:3001` and the exact kubectl commands.

<details>
<summary><b>Build from source</b></summary>

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

</details>
