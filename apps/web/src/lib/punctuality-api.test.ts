import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDelayByHour, fetchPunctualityRanking } from './punctuality-api';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (status: number, body: unknown = {}) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchPunctualityRanking', () => {
  it('requests the ranking for a number of days', async () => {
    const fetchMock = stubFetch(200, { days: 30, lines: [] });
    expect(await fetchPunctualityRanking(30, 'http://api')).toEqual({ days: 30, lines: [] });
    expect(fetchMock).toHaveBeenCalledWith('http://api/stats/punctuality?days=30', {
      cache: 'no-store',
    });
  });
  it('throws on server errors', async () => {
    stubFetch(500);
    await expect(fetchPunctualityRanking(7, 'http://api')).rejects.toThrow('500');
  });
});

describe('fetchDelayByHour', () => {
  it('requests all Lines', async () => {
    const fetchMock = stubFetch(200, { hours: [] });
    await fetchDelayByHour({ days: 7 }, 'http://api');
    expect(fetchMock).toHaveBeenCalledWith('http://api/stats/delay-by-hour?days=7', {
      cache: 'no-store',
    });
  });
  it('requests one Line, URL-encoded', async () => {
    const fetchMock = stubFetch(200, { hours: [] });
    await fetchDelayByHour({ days: 7, lineCode: 'AVE MS' }, 'http://api');
    expect(fetchMock).toHaveBeenCalledWith('http://api/stats/delay-by-hour?days=7&line=AVE%20MS', {
      cache: 'no-store',
    });
  });
  it('throws on server errors', async () => {
    stubFetch(502);
    await expect(fetchDelayByHour({ days: 7 }, 'http://api')).rejects.toThrow('502');
  });
});
