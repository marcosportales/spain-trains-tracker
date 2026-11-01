import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSearch } from './search-api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchSearch', () => {
  it('requests /search with the encoded query', async () => {
    const body = { query: 'a b', runs: [], stations: [], lines: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchSearch('a b&', 'http://api')).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith('http://api/search?q=a+b%26', undefined);
  });

  it('rejects a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(fetchSearch('ab', 'http://api')).rejects.toThrow('400');
  });
});
