import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRunDetail } from './run-detail-api';

const id = { serviceDate: '2026-10-31', trainNumber: '03063' };

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (status: number, body: unknown = {}) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchRunDetail', () => {
  it('requests the Run detail route and returns the payload', async () => {
    const fetchMock = stubFetch(200, { stops: [] });
    expect(await fetchRunDetail(id, 'http://api')).toEqual({ stops: [] });
    expect(fetchMock).toHaveBeenCalledWith('http://api/runs/2026-10-31/03063', {
      cache: 'no-store',
    });
  });

  it.each([404, 400])('is undefined on %i', async (status) => {
    stubFetch(status);
    expect(await fetchRunDetail(id, 'http://api')).toBeUndefined();
  });

  it('throws on server errors', async () => {
    stubFetch(500);
    await expect(fetchRunDetail(id, 'http://api')).rejects.toThrow('500');
  });
});
