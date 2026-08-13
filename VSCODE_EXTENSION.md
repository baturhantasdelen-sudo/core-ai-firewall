# Nexus Shield VS Code Extension

Install the **Nexus Shield** extension for real-time PII and secret detection directly in VS Code / Cursor.

## Features

- **Real-time protection** — 300ms debounced scan on `onDidChangeTextDocument`
- **Red squiggles** — `DiagnosticSeverity.Error` for TCKN, IBAN, secrets, and more
- **Quick Fix** — `Mask with Nexus Shield` replaces values with `[MASKED_TCKN]`, `[MASKED_SECRET]`, etc.
- **Local engine** — sub-10ms in-process scanning (default)
- **Optional API mode** — route scans through `POST /api/v1/scan` with your API key

## Project location

```
packages/vscode-extension/
├── package.json          # Extension manifest (publisher: nexus-shield)
├── src/
│   ├── extension.ts      # Activation, commands, status bar
│   ├── diagnostics.ts    # Debounced DiagnosticCollection
│   ├── quickFix.ts       # CodeActionProvider
│   ├── scanner.ts        # Local policy engine
│   └── apiClient.ts      # Optional remote API
└── out/                  # Compiled JavaScript (generated)
```

## Build from source

```powershell
cd packages/vscode-extension
npm install
npm run compile
```

Verify TypeScript output:

```powershell
npm run lint
```

Run scanner unit tests:

```powershell
npm test
```

## Debug in Extension Development Host

1. Open `packages/vscode-extension` in VS Code / Cursor.
2. Run **Terminal → Run Build Task** (default: `npm run compile`).
3. Press **F5** — launches a new window with the extension loaded.
4. Open a file containing test data, e.g.:

```typescript
const tckn = "10000000146";
const api_key = "sk-proj-1234567890abcdef1234567890abcdef";
```

5. Confirm red diagnostics and use **Ctrl+.** → **Mask with Nexus Shield**.

## Package as VSIX

Install the packaging tool once:

```powershell
npm install -g @vscode/vsce
```

From `packages/vscode-extension`:

```powershell
npm run package
```

This produces `nexus-shield-vscode-0.1.0.vsix`.

## Install VSIX locally

```powershell
code --install-extension nexus-shield-vscode-0.1.0.vsix
```

For Cursor:

```powershell
cursor --install-extension nexus-shield-vscode-0.1.0.vsix
```

Or use the command palette: **Extensions: Install from VSIX…**

## Commands reference

| VS Code Command | ID |
|-----------------|-----|
| Nexus Shield: Scan Current File | `nexus-shield.scanFile` |
| Nexus Shield: Toggle Real-time Protection | `nexus-shield.toggleRealtime` |

## Optional remote API mode

Add to your user `settings.json`:

```json
{
  "nexusShield.useRemoteApi": true,
  "nexusShield.apiKey": "nex_your_api_key",
  "nexusShield.apiUrl": "https://nexus-shield-dashboard.vercel.app/api/v1/scan",
  "nexusShield.profile": "TR"
}
```

When the API is unreachable, the extension falls back to the local engine automatically.

## Publish to Marketplace (maintainers)

1. Create publisher `nexus-shield` on [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage).
2. Generate a Personal Access Token with **Marketplace → Manage** scope.
3. Run:

```powershell
vsce login nexus-shield
vsce publish
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No diagnostics | Ensure **Real-time Protection** is ON (status bar shield icon) |
| Quick Fix missing | Click inside the squiggled range, then **Ctrl+.** |
| Remote scan fails | Check API key; local engine fallback should still run |
| Compile errors | Use Node.js 18+ and run `npm install` again |

---

**Nexus Shield** · [Dashboard](https://nexus-shield-dashboard.vercel.app) · [API Docs](https://nexus-shield-dashboard.vercel.app/api/v1/scan)
