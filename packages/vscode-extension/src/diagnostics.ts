import * as vscode from 'vscode';
import { scanContentRemote } from './apiClient';
import { hoverMessage } from './labels';
import { scanContent } from './scanner';
import type { Profile, ScanMatch } from './types';

const DEBOUNCE_MS = 300;
const DIAGNOSTIC_SOURCE = 'Nexus Shield';

export class NexusShieldDiagnostics {
  private readonly collection: vscode.DiagnosticCollection;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly latestMatches = new Map<string, ScanMatch[]>();
  private realtimeEnabled = true;
  private readonly onMatchesUpdated: () => void;

  constructor(onMatchesUpdated: () => void) {
    this.collection = vscode.languages.createDiagnosticCollection('nexus-shield');
    this.onMatchesUpdated = onMatchesUpdated;
  }

  setRealtimeEnabled(enabled: boolean): void {
    this.realtimeEnabled = enabled;
    if (!enabled) {
      this.collection.clear();
      this.latestMatches.clear();
      this.onMatchesUpdated();
    } else {
      for (const document of vscode.workspace.textDocuments) {
        void this.scheduleScan(document);
      }
    }
  }

  isRealtimeEnabled(): boolean {
    return this.realtimeEnabled;
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.collection.dispose();
  }

  getMatches(uri: string): ScanMatch[] {
    return this.latestMatches.get(uri) ?? [];
  }

  async scanDocument(document: vscode.TextDocument): Promise<ScanMatch[]> {
    const config = vscode.workspace.getConfiguration('nexusShield');
    const profile = config.get<Profile>('profile', 'TR');
    const useRemoteApi = config.get<boolean>('useRemoteApi', false);
    const apiUrl = config.get<string>('apiUrl', '');
    const apiKey = config.get<string>('apiKey', '');

    let matches: ScanMatch[];

    if (useRemoteApi && apiKey) {
      try {
        matches = await scanContentRemote({
          content: document.getText(),
          filename: vscode.workspace.asRelativePath(document.uri),
          profile,
          apiUrl,
          apiKey,
        });
      } catch {
        matches = scanContent(
          document.getText(),
          vscode.workspace.asRelativePath(document.uri),
          profile,
        );
      }
    } else {
      matches = scanContent(
        document.getText(),
        vscode.workspace.asRelativePath(document.uri),
        profile,
      );
    }

    this.latestMatches.set(document.uri.toString(), matches);
    this.publishDiagnostics(document, matches);
    this.onMatchesUpdated();
    return matches;
  }

  scheduleScan(document: vscode.TextDocument): void {
    if (!this.realtimeEnabled) return;
    if (document.uri.scheme !== 'file') return;

    const key = document.uri.toString();
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      void this.scanDocument(document);
      this.timers.delete(key);
    }, DEBOUNCE_MS);

    this.timers.set(key, timer);
  }

  clearDocument(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    this.collection.delete(document.uri);
    this.latestMatches.delete(key);
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
    this.onMatchesUpdated();
  }

  private publishDiagnostics(document: vscode.TextDocument, matches: ScanMatch[]): void {
    const diagnostics = matches.map((match) => {
      const lineIndex = match.line - 1;
      const line = document.lineAt(Math.min(lineIndex, document.lineCount - 1));
      const startColumn = Math.max(0, Math.min(match.column - 1, line.text.length));
      const endColumn = Math.min(startColumn + match.matched.length, line.text.length);

      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(lineIndex, startColumn, lineIndex, endColumn),
        hoverMessage(match.type, match.category),
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostic.code = match.ruleId;
      return diagnostic;
    });

    this.collection.set(document.uri, diagnostics);
  }
}
