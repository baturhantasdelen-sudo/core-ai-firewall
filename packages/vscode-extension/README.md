# Nexus Shield VS Code Extension

Real-time PII and secret scanning in your IDE using the Nexus Shield policy engine.

## Commands

| Command | Description |
|---------|-------------|
| `Nexus Shield: Scan Current File` | Run an immediate scan on the active editor |
| `Nexus Shield: Toggle Real-time Protection` | Enable/disable debounced live scanning |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `nexusShield.profile` | `TR` | Regional PII profile (`TR`, `US`, `GLOBAL`) |
| `nexusShield.realtimeEnabled` | `true` | Scan while typing (300ms debounce) |
| `nexusShield.useRemoteApi` | `false` | Use Nexus Shield cloud API |
| `nexusShield.apiUrl` | dashboard scan URL | Remote scan endpoint |
| `nexusShield.apiKey` | `""` | API key when remote scanning is enabled |

## Quick Fix

Use **Ctrl+.** on a highlighted finding and choose **Mask with Nexus Shield** to replace the value with tokens like `[MASKED_TCKN]`.

## Development

```bash
cd packages/vscode-extension
npm install
npm run compile
npm test
```

Press **F5** in VS Code with this folder open to launch an Extension Development Host.

## Package VSIX

```bash
npm run package
code --install-extension nexus-shield-vscode-0.1.0.vsix
```

See [VSCODE_EXTENSION.md](https://github.com/baturhantasdelen-sudo/core-ai-firewall/blob/main/VSCODE_EXTENSION.md) for the full setup guide.
