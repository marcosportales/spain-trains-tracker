export interface ManifestEntry {
  file: string;
  url: string;
  timestamp: string;
  etag: string | null;
  bytes: number;
  rowLimit?: number;
}

/** Keep the header line plus the first `rows` data lines, preserving line endings. */
export function trimDelimitedText(text: string, rows: number): string {
  let end = 0;
  for (let line = 0; line <= rows; line++) {
    const next = text.indexOf('\n', end);
    if (next === -1) return text;
    end = next + 1;
  }
  return text.slice(0, end);
}

export function fixtureDirName(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildManifestEntry(input: {
  file: string;
  url: string;
  response: Response;
  fetchedAt: Date;
  bytes: number;
  rowLimit?: number | undefined;
}): ManifestEntry {
  const entry: ManifestEntry = {
    file: input.file,
    url: input.url,
    timestamp: input.fetchedAt.toISOString(),
    etag: input.response.headers.get('etag'),
    bytes: input.bytes,
  };
  if (input.rowLimit !== undefined) entry.rowLimit = input.rowLimit;
  return entry;
}
