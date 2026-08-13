export interface ChangedFile {
  filename: string;
  status: string;
  patch?: string;
}

export interface MappedPatchLine {
  /** Actual line number in the new file version */
  lineNumber: number;
  content: string;
  kind: 'added';
}

const HUNK_HEADER_REGEX = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parses unified diff hunks and returns only added/modified lines with their
 * real file line numbers (not patch-relative positions).
 */
export function parseAddedLinesFromPatch(patch: string): MappedPatchLine[] {
  const addedLines: MappedPatchLine[] = [];
  let newLineNumber = 0;

  for (const line of patch.split('\n')) {
    const hunkMatch = HUNK_HEADER_REGEX.exec(line);
    if (hunkMatch) {
      newLineNumber = Number(hunkMatch[1]) - 1;
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('\\')) {
      continue;
    }

    if (line.startsWith('+')) {
      newLineNumber += 1;
      addedLines.push({
        lineNumber: newLineNumber,
        content: line.slice(1),
        kind: 'added',
      });
      continue;
    }

    if (line.startsWith('-')) {
      continue;
    }

    // Context line — occupies a line in the new file.
    newLineNumber += 1;
  }

  return addedLines;
}

/**
 * Legacy helper: reconstructs file content with blank padding so legacy
 * line counters stay aligned. Prefer `parseAddedLinesFromPatch` + engine
 * line-aware scanning for PR diff workflows.
 */
export function addedLinesFromPatch(patch: string): string {
  const outputLines: string[] = [];

  const setLine = (lineNumber: number, content: string): void => {
    while (outputLines.length < lineNumber) {
      outputLines.push('');
    }
    outputLines[lineNumber - 1] = content;
  };

  let newLineNumber = 0;

  for (const line of patch.split('\n')) {
    const hunkMatch = HUNK_HEADER_REGEX.exec(line);
    if (hunkMatch) {
      newLineNumber = Number(hunkMatch[1]) - 1;
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('\\')) {
      continue;
    }

    if (line.startsWith('+')) {
      newLineNumber += 1;
      setLine(newLineNumber, line.slice(1));
      continue;
    }

    if (line.startsWith('-')) {
      continue;
    }

    newLineNumber += 1;
    setLine(newLineNumber, outputLines[newLineNumber - 1] ?? '');
  }

  return outputLines.join('\n');
}

export function scannableContentFor(file: ChangedFile): string {
  if (!file.patch) {
    return '';
  }

  return addedLinesFromPatch(file.patch);
}

export function scannableAddedLinesFor(file: ChangedFile): MappedPatchLine[] {
  if (!file.patch) return [];
  return parseAddedLinesFromPatch(file.patch);
}
