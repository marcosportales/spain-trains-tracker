import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTrainHistory } from './train-history-api';

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (status: number, body: unknown = {}) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchTrainHistory', () => {
  it('requests the history of a Train number and returns the payload', async () => {
    const body = { trainNumber: '03063', days: 30, runs: [] };
    const fetchMock = stubFetch(200, body);
    expect(await fetchTrainHistory('03063', 30, 'http://api')).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith('http://api/trains/03063/history?days=30', {
      cache: 'no-store',
    });
  });
  it('is undefined on server errors', async () => {
    stubFetch(500);
    expect(await fetchTrainHistory('03063', 30, 'http://api')).toBeUndefined();
  });
  it('is undefined when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    expect(await fetchTrainHistory('03063', 30, 'http://api')).toBeUndefined();
  });
});
