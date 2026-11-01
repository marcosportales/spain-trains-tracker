import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStationBoard } from './station-board-api';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (status: number, body: unknown = {}) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchStationBoard', () => {
  it('requests the Station board route and returns the payload', async () => {
    const fetchMock = stubFetch(200, { departures: [] });
    expect(await fetchStationBoard('60000', 'http://api')).toEqual({ departures: [] });
    expect(fetchMock).toHaveBeenCalledWith('http://api/stations/60000/board', {
      cache: 'no-store',
    });
  });

  it.each([404, 400])('is undefined on %i', async (status) => {
    stubFetch(status);
    expect(await fetchStationBoard('60000', 'http://api')).toBeUndefined();
  });

  it('throws on server errors', async () => {
    stubFetch(500);
    await expect(fetchStationBoard('60000', 'http://api')).rejects.toThrow('500');
  });
});
