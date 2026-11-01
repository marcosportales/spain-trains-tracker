import { describe, expect, it, vi } from 'vitest';
import { OverpassRailways } from './overpass-railways.js';

const box = { south: 40, west: -4, north: 41, east: -3 };

describe('OverpassRailways', () => {
  it('asks for main-line rail ways in the box and returns their vertices as [lon, lat]', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        elements: [
          {
            type: 'way',
            geometry: [
              { lat: 40.1, lon: -3.5 },
              { lat: 40.2, lon: -3.4 },
            ],
          },
          { type: 'way', geometry: [{ lat: 40.3, lon: -3.3 }] }, // too short
          { type: 'node' },
        ],
      }),
    );
    const ways = await new OverpassRailways({
      fetch: fetchMock as never,
      delayMs: 0,
    }).mainLinesWithin(box);

    expect(ways).toEqual([
      [
        [-3.5, 40.1],
        [-3.4, 40.2],
      ],
    ]);
    const body = (fetchMock.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1]
      .body;
    expect(body.get('data')).toContain('["railway"="rail"][!"service"](40,-4,41,-3)');
  });

  it('fails when Overpass answers with an error', async () => {
    const failing = vi.fn(async () => new Response('busy', { status: 429 }));
    await expect(
      new OverpassRailways({ fetch: failing as never, delayMs: 0 }).mainLinesWithin(box),
    ).rejects.toThrow('429');
  });
});
