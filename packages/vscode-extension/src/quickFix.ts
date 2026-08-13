import * as vscode from 'vscode';
import { maskTokenForRule } from './labels';
import type { NexusShieldDiagnostics } from './diagnostics';

const QUICK_FIX_TITLE = 'Mask with Nexus Shield';

export class NexusShieldQuickFixProvider implements vscode.CodeActionProvider {
  constructor(private readonly diagnosticsManager: NexusShieldDiagnostics) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const uri = document.uri.toString();
    const matches = this.diagnosticsManager.getMatches(uri);

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'Nexus Shield') continue;

      const match = matches.find((candidate) => {
        const lineIndex = candidate.line - 1;
        return (
          lineIndex === diagnostic.range.start.line &&
          diagnostic.range.start.character >= candidate.column - 1 &&
          diagnostic.range.start.character <= candidate.column - 1 + candidate.matched.length
        );
      });

      if (!match) continue;

      const action = new vscode.CodeAction(
        QUICK_FIX_TITLE,
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        diagnostic.range,
        maskTokenForRule(match.ruleId, match.type),
      );
      actions.push(action);
    }

    if (actions.length === 0 && matches.length > 0) {
      for (const match of matches) {
        if (!range.intersection(
          new vscode.Range(
            match.line - 1,
            match.column - 1,
            match.line - 1,
            match.column - 1 + match.matched.length,
          ),
        )) {
          continue;
        }

        const action = new vscode.CodeAction(
          QUICK_FIX_TITLE,
          vscode.CodeActionKind.QuickFix,
        );
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
          document.uri,
          new vscode.Range(
            match.line - 1,
            match.column - 1,
            match.line - 1,
            match.column - 1 + match.matched.length,
          ),
          maskTokenForRule(match.ruleId, match.type),
        );
        actions.push(action);
      }
    }

    return actions;
  }
}

export function registerQuickFixProvider(
  diagnosticsManager: NexusShieldDiagnostics,
): vscode.Disposable {
  return vscode.languages.registerCodeActionsProvider(
    { scheme: 'file' },
    new NexusShieldQuickFixProvider(diagnosticsManager),
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
  );
}
