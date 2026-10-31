import { describe, expect, it } from 'vitest';
import {
  buildManifestEntry,
  fixtureDirName,
  isSafeEntryName,
  trimDelimitedText,
} from './fixtures.ts';

describe('trimDelimitedText', () => {
  it('keeps the header plus the first N data rows', () => {
    const text = 'a,b\n1,2\n3,4\n5,6\n';
    expect(trimDelimitedText(text, 2)).toBe('a,b\n1,2\n3,4\n');
  });

  it('returns the whole text when it has fewer rows than the limit', () => {
    expect(trimDelimitedText('a,b\n1,2\n', 10)).toBe('a,b\n1,2\n');
  });

  it('handles CRLF line endings without altering them', () => {
    expect(trimDelimitedText('a;b\r\n1;2\r\n3;4\r\n', 1)).toBe('a;b\r\n1;2\r\n');
  });

  it('keeps only the header when the limit is zero', () => {
    expect(trimDelimitedText('a,b\n1,2\n', 0)).toBe('a,b\n');
  });
});

describe('fixtureDirName', () => {
  it('formats a date as YYYY-MM-DD in UTC', () => {
    expect(fixtureDirName(new Date('2026-10-31T23:59:59Z'))).toBe('2026-10-31');
  });
});

describe('buildManifestEntry', () => {
  it('captures url, timestamp and etag from a response', () => {
    const response = new Response('x', { headers: { etag: '"abc"' } });
    const entry = buildManifestEntry({
      file: 'alerts.pb',
      url: 'https://example.test/alerts.pb',
      response,
      fetchedAt: new Date('2026-10-31T10:00:00Z'),
      bytes: 1,
    });
    expect(entry).toEqual({
      file: 'alerts.pb',
      url: 'https://example.test/alerts.pb',
      timestamp: '2026-10-31T10:00:00.000Z',
      etag: '"abc"',
      bytes: 1,
    });
  });

  it('records a null etag when the server sends none', () => {
    const entry = buildManifestEntry({
      file: 'a',
      url: 'u',
      response: new Response('x'),
      fetchedAt: new Date(0),
      bytes: 1,
    });
    expect(entry.etag).toBeNull();
  });

  it('includes the row limit for trimmed static files', () => {
    const entry = buildManifestEntry({
      file: 'cercanias/stops.txt',
      url: 'u',
      response: new Response('x'),
      fetchedAt: new Date(0),
      bytes: 1,
      rowLimit: 50,
    });
    expect(entry.rowLimit).toBe(50);
  });
});

describe('isSafeEntryName', () => {
  it('accepts plain relative names', () => {
    expect(isSafeEntryName('stops.txt')).toBe(true);
    expect(isSafeEntryName('sub/stops.txt')).toBe(true);
  });

  it('rejects absolute paths', () => {
    expect(isSafeEntryName('/etc/passwd.txt')).toBe(false);
    expect(isSafeEntryName('C:\\evil.txt')).toBe(false);
    expect(isSafeEntryName('\\evil.txt')).toBe(false);
  });

  it('rejects any parent-directory segment', () => {
    expect(isSafeEntryName('../x.txt')).toBe(false);
    expect(isSafeEntryName('a/../../x.txt')).toBe(false);
    expect(isSafeEntryName('a\\..\\x.txt')).toBe(false);
  });

  it('rejects empty names and NUL bytes', () => {
    expect(isSafeEntryName('')).toBe(false);
    expect(isSafeEntryName('a\0b.txt')).toBe(false);
  });

  it('allows dots inside segment names', () => {
    expect(isSafeEntryName('a..b/c.txt')).toBe(true);
  });
});
