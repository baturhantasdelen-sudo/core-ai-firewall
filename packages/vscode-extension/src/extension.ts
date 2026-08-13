import * as vscode from 'vscode';
import { NexusShieldDiagnostics } from './diagnostics';
import { registerQuickFixProvider } from './quickFix';

let diagnosticsManager: NexusShieldDiagnostics | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

function updateStatusBar(): void {
  if (!statusBarItem || !diagnosticsManager) return;

  const enabled = diagnosticsManager.isRealtimeEnabled();
  statusBarItem.text = enabled ? '$(shield) Nexus Shield: ON' : '$(shield) Nexus Shield: OFF';
  statusBarItem.tooltip = enabled
    ? 'Real-time PII & secret protection is active'
    : 'Real-time protection is disabled';
  statusBarItem.backgroundColor = enabled
    ? undefined
    : new vscode.ThemeColor('statusBarItem.warningBackground');
}

export function activate(context: vscode.ExtensionContext): void {
  diagnosticsManager = new NexusShieldDiagnostics(updateStatusBar);

  const config = vscode.workspace.getConfiguration('nexusShield');
  diagnosticsManager.setRealtimeEnabled(config.get<boolean>('realtimeEnabled', true));

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'nexus-shield.toggleRealtime';
  statusBarItem.show();
  updateStatusBar();

  context.subscriptions.push(
    diagnosticsManager,
    statusBarItem,
    registerQuickFixProvider(diagnosticsManager),
    vscode.workspace.onDidChangeTextDocument((event) => {
      diagnosticsManager?.scheduleScan(event.document);
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      diagnosticsManager?.scheduleScan(document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnosticsManager?.clearDocument(document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('nexusShield')) return;
      const next = vscode.workspace.getConfiguration('nexusShield');
      diagnosticsManager?.setRealtimeEnabled(next.get<boolean>('realtimeEnabled', true));
      updateStatusBar();
    }),
    vscode.commands.registerCommand('nexus-shield.scanFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showWarningMessage('Nexus Shield: No active editor to scan.');
        return;
      }

      const matches = await diagnosticsManager!.scanDocument(editor.document);
      const secrets = matches.filter((match) => match.category === 'secret').length;
      const pii = matches.filter((match) => match.category === 'pii').length;

      void vscode.window.showInformationMessage(
        `Nexus Shield scan complete — ${matches.length} finding(s): ${pii} PII, ${secrets} secret(s).`,
      );
    }),
    vscode.commands.registerCommand('nexus-shield.toggleRealtime', async () => {
      if (!diagnosticsManager) return;

      const next = !diagnosticsManager.isRealtimeEnabled();
      diagnosticsManager.setRealtimeEnabled(next);
      await vscode.workspace
        .getConfiguration('nexusShield')
        .update('realtimeEnabled', next, vscode.ConfigurationTarget.Global);

      updateStatusBar();
      void vscode.window.showInformationMessage(
        `Nexus Shield real-time protection ${next ? 'enabled' : 'disabled'}.`,
      );
    }),
  );

  for (const document of vscode.workspace.textDocuments) {
    diagnosticsManager.scheduleScan(document);
  }
}

export function deactivate(): void {
  diagnosticsManager?.dispose();
  diagnosticsManager = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
