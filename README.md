# Kubernetes Port Forward MCP

A Model Context Protocol (MCP) server that provides tools for discovering Kubernetes services and running `kubectl port-forward` sessions (optionally with separate log windows). It is designed for MCP clients/LLMs that translate natural language into structured tool calls.

## Kubernetes Port Forward MCP vs `kubectl port-forward`

This package provides an **MCP interface** on top of the standard `kubectl` workflow.

- **`kubectl`**: Best when you already know exact namespace/pod/ports and prefer manual control.
- **MCP**: Best when an agent should discover services and run one or many port-forwards via tool calls.

## Key Features

- **Service discovery**: list namespaces and infer services (short name → environments → namespace) from running pods.
- **Multi-service in one session**: start multiple port-forwards with one tool call.
- **LLM-friendly API**: `start_k8s_port_forward` accepts an array so each service can use different `namespace`, `environment`, `localPort`, and `remotePort`.
- **Optional logs**: open `kubectl logs -f` in a separate OS-level terminal window per service.

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Getting Started](#getting-started)
- [Examples](#examples)
- [Tools](#tools)
- [Output and Logs](#output-and-logs)
- [Configuration](#configuration)
- [Validation and Debugging](#validation-and-debugging)

## Requirements

- Node.js 18 or newer
- `kubectl` installed and configured with access to your cluster
- VS Code, Cursor, Windsurf, Claude Desktop, Cline, or any other MCP client

## Quick Start

1. Add this server to your MCP client (use the config in Getting Started below).
2. Ask your assistant: "List available Kubernetes services."
3. Ask your assistant: "Run api service on local port 3002."
4. Open the returned URL (for example `http://localhost:3002`).
5. When finished, ask: "Stop all port-forwards."

## Getting Started

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

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522k8s-port-forward%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522k8s-port-forward-mcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522k8s-port-forward%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522k8s-port-forward-mcp%2540latest%2522%255D%257D)

<details>
<summary>Amp</summary>

Add via the Amp VS Code extension settings screen or by updating your settings.json file:

```json
"amp.mcpServers": {
  "k8s-port-forward": {
    "command": "npx",
    "args": [
      "-y",
      "k8s-port-forward-mcp@latest"
    ]
  }
}
```

**Amp CLI Setup:**

Add via the `amp mcp add` command below:

```bash
amp mcp add k8s-port-forward -- npx -y k8s-port-forward-mcp@latest
```

</details>

<details>
<summary>Antigravity</summary>

Add via the Antigravity settings or by updating your configuration file:

```json
{
  "mcpServers": {
    "k8s-port-forward": {
      "command": "npx",
      "args": ["-y", "k8s-port-forward-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary>Claude Code</summary>

Use the Claude Code CLI to add the Kubernetes Port Forward MCP server:

```bash
claude mcp add k8s-port-forward npx -y k8s-port-forward-mcp@latest
```

</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use the standard config above.

</details>

<details>
<summary>Cline</summary>

Follow the instruction in the section [Configuring MCP Servers](https://docs.cline.bot/mcp/configuring-mcp-servers)

**Example: Local Setup**

Add the following to your [`cline_mcp_settings.json`](https://docs.cline.bot/mcp/configuring-mcp-servers#editing-mcp-settings-files) file:

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
<summary>Codex</summary>

Use the Codex CLI to add the Kubernetes Port Forward MCP server:

```bash
codex mcp add k8s-port-forward npx "-y" "k8s-port-forward-mcp@latest"
```

Alternatively, create or edit the configuration file `~/.codex/config.toml` and add:

```toml
[mcp_servers.k8s-port-forward]
command = "npx"
args = ["-y", "k8s-port-forward-mcp@latest"]
```

For more information, see the [Codex MCP documentation](https://github.com/openai/codex/blob/main/codex-rs/config.md#mcp_servers).

</details>

<details>
<summary>Copilot</summary>

Use the Copilot CLI to interactively add the Kubernetes Port Forward MCP server:

```bash
/mcp add
```

Alternatively, create or edit the configuration file `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "k8s-port-forward": {
      "type": "local",
      "command": "npx",
      "tools": ["*"],
      "args": ["-y", "k8s-port-forward-mcp@latest"]
    }
  }
}
```

For more information, see the [Copilot CLI documentation](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli).

</details>

<details>
<summary>Cursor</summary>

#### Click the button to install:

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=k8s-port-forward&config=eyJjb21tYW5kIjoibnB4IC15IGs4cy1wb3J0LWZvcndhcmQtbWNwQGxhdGVzdCJ9)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx -y k8s-port-forward-mcp@latest`. You can also verify config or add command arguments via clicking `Edit`.

</details>

<details>
<summary>Factory</summary>

Use the Factory CLI to add the Kubernetes Port Forward MCP server:

```bash
droid mcp add k8s-port-forward "npx -y k8s-port-forward-mcp@latest"
```

Alternatively, type `/mcp` within Factory droid to open an interactive UI for managing MCP servers.

For more information, see the [Factory MCP documentation](https://docs.factory.ai/cli/configuration/mcp).

</details>

<details>
<summary>Gemini CLI</summary>

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use the standard config above.

</details>

<details>
<summary>Goose</summary>

#### Click the button to install:

[![Install in Goose](https://block.github.io/goose/img/extension-install-dark.svg)](https://block.github.io/goose/extension?cmd=npx&arg=-y&arg=k8s-port-forward-mcp%40latest&id=k8s-port-forward&name=Kubernetes%20Port%20Forward&description=Start%20and%20manage%20Kubernetes%20port-forward%20sessions%20through%20MCP)

#### Or install manually:

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name to your liking, use type `STDIO`, and set the `command` to `npx -y k8s-port-forward-mcp@latest`. Click "Add Extension".

</details>

<details>
<summary>Kiro</summary>

Follow the MCP Servers [documentation](https://kiro.dev/docs/mcp/). For example in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "k8s-port-forward": {
      "command": "npx",
      "args": ["-y", "k8s-port-forward-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary>LM Studio</summary>

#### Click the button to install:

[![Add MCP Server k8s-port-forward to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=k8s-port-forward&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIms4cy1wb3J0LWZvcndhcmQtbWNwQGxhdGVzdCJdfQ%3D%3D)

#### Or install manually:

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.

</details>

<details>
<summary>opencode</summary>

Follow the MCP Servers [documentation](https://opencode.ai/docs/mcp-servers/). For example in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "k8s-port-forward": {
      "type": "local",
      "command": ["npx", "-y", "k8s-port-forward-mcp@latest"],
      "enabled": true
    }
  }
}
```

</details>

<details>
<summary>Qodo Gen</summary>

Open [Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen) chat panel in VSCode or IntelliJ -> Connect more tools -> + Add new MCP -> Paste the standard config above.

Click <code>Save</code>.

</details>

<details>
<summary>VS Code</summary>

#### Click the button to install:

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522k8s-port-forward%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522k8s-port-forward-mcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522k8s-port-forward%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522k8s-port-forward-mcp%2540latest%2522%255D%257D)

#### Or install manually:

Follow the MCP install [guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server), use the standard config above. You can also install the Kubernetes Port Forward MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"k8s-port-forward","command":"npx","args":["-y","k8s-port-forward-mcp@latest"]}'
```

After installation, the Kubernetes Port Forward MCP server will be available for use with your GitHub Copilot agent in VS Code.

</details>

<details>
<summary>Warp</summary>

Go to `Settings` -> `AI` -> `Manage MCP Servers` -> `+ Add` to [add an MCP Server](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server). Use the standard config above.

Alternatively, use the slash command `/add-mcp` in the Warp prompt and paste the standard config from above:

```js
{
  "mcpServers": {
    "k8s-port-forward": {
      "command": "npx",
      "args": [
        "-y",
        "k8s-port-forward-mcp@latest"
      ]
    }
  }
}
```

</details>

<details>
<summary>Windsurf</summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

</details>

## Examples

### Quick reference (natural language → tool calls)

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

### Detailed workflow example

**User**: _"Run the frontend service in qa on port 3001"_

**AI workflow**:

1. Call `list_k8s_services({})` to find the exact service name.
2. Receive list containing e.g. `frontend: qa (ns: ...), dev (ns: ...)`.
3. Call `start_k8s_port_forward({ services: [{ serviceName: "frontend", environment: "qa", localPort: 3001 }] })`.
4. Result: port-forwards run in the MCP server process; if `includeLogs` is true, logs open in a separate window. The tool result includes `http://localhost:3001` and the exact kubectl commands.

## Tools

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

## Validation and Debugging

Since the MCP server spawns actual `kubectl` processes in the background, you may want to verify what's running and see the exact commands being executed.

#### Checking running kubectl processes

**Windows (PowerShell):**

```powershell
# List all kubectl processes
tasklist /fi "imagename eq kubectl.exe"

# See the exact commands with process IDs
Get-CimInstance Win32_Process -Filter "Name='kubectl.exe'" | Select-Object ProcessId,CommandLine
```

**Linux/macOS:**

```bash
# List all kubectl processes
ps aux | grep kubectl

# See the exact commands with process IDs
ps -ef | grep kubectl
```

This helps you:

- **Verify port-forwards are actually running**
- **See the exact namespaces and ports being used**
- **Identify stuck processes that might need manual termination**
- **Debug connectivity issues by examining the actual commands**

### Common failures and fixes

- [ ] **Port already in use**: choose another local port or stop the conflicting process.
- [ ] **Connection refused**: verify service name, namespace, and selected environment.
- [ ] **No logs window**: set `includeLogs: true` in the port-forward request.
- [ ] **Stuck process**: terminate by PID (`taskkill /PID <pid>` on Windows, `kill <pid>` on Linux/macOS).
