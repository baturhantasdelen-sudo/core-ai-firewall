export interface ChangedFile {
  filename: string;
  status: string;
  patch?: string;
}

const HUNK_HEADER_REGEX = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Extracts only the *added* lines from a unified diff patch, stripping the
 * leading "+". We scan added lines rather than full file contents to (a)
 * avoid false positives on lines the PR/push didn't introduce and (b) avoid
 * extra GitHub API calls to fetch full blob contents for every changed file.
 *
 * The returned string preserves each added line's *actual line number in
 * the new file* (not its position within the patch) by padding skipped
 * lines with blank placeholders. This keeps `scanContent`'s line-counting
 * logic correct so Check Run annotations point GitHub to the right line.
 */
export function addedLinesFromPatch(patch: string): string {
  const outputLines: string[] = [];
  let newLineNumber = 0;

  const setLine = (lineNumber: number, content: string): void => {
    while (outputLines.length < lineNumber) {
      outputLines.push('');
    }
    outputLines[lineNumber - 1] = content;
  };

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
      // Removed lines don't exist in the new file — don't advance the counter.
      continue;
    }

    // Context line (unchanged, kept for reference): still occupies a line in
    // the new file, so advance the counter to keep alignment, but we don't
    // need its content since we only scan additions.
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
