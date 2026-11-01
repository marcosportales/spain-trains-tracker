import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStations } from './stations-api';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (status: number, body: unknown = []) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchStations', () => {
  it('requests the Stations route and returns the payload', async () => {
    const stations = [{ code: '60000', name: 'Atocha', lat: 40.4, lon: -3.7 }];
    const fetchMock = stubFetch(200, stations);
    expect(await fetchStations('http://api')).toEqual(stations);
    expect(fetchMock).toHaveBeenCalledWith('http://api/stations', undefined);
  });

  it('throws on server errors', async () => {
    stubFetch(500);
    await expect(fetchStations('http://api')).rejects.toThrow('500');
  });
});
