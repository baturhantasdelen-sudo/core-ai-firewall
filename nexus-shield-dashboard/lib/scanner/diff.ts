export interface ChangedFile {
  filename: string;
  status: string;
  patch?: string;
}

/**
 * Extracts only the *added* lines from a unified diff patch, stripping the
 * leading "+". We scan added lines rather than full file contents to (a)
 * avoid false positives on lines the PR/push didn't introduce and (b) avoid
 * extra GitHub API calls to fetch full blob contents for every changed file.
 */
export function addedLinesFromPatch(patch: string): string {
  return patch
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

export function scannableContentFor(file: ChangedFile): string {
  if (!file.patch) {
    return '';
  }

  return addedLinesFromPatch(file.patch);
}
