import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTrackGeometry } from './lines-api';

afterEach(() => vi.unstubAllGlobals());

const stub = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchTrackGeometry', () => {
  it('requests /lines/geometry', async () => {
    const body = { type: 'FeatureCollection', features: [] };
    const fetchMock = stub({ ok: true, json: async () => body });
    await expect(fetchTrackGeometry('http://api')).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith('http://api/lines/geometry', undefined);
  });

  it('rejects a failed response', async () => {
    stub({ ok: false, status: 500 });
    await expect(fetchTrackGeometry('http://api')).rejects.toThrow('500');
  });
});
