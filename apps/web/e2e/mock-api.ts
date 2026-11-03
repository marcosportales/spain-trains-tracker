import { createServer, type Server } from 'node:http';
import {
  ALERT,
  DELAY_BY_HOUR,
  NO_TRACK,
  PUNCTUALITY_RANKING,
  RUN,
  RUN_DETAIL,
  SERVICE_DATE,
  STATION_BOARD,
  STATION_CODE,
  STATIONS,
  SUGGESTIONS,
  search,
  sightingWindow,
} from './fixtures.js';

/**
 * The slice of the API the web app calls, served from the fixtures: no database, no worker.
 * `/live/stream` sends the snapshot and then a heartbeat every second, like an API between ingest cycles.
 */
export function startMockApi(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const json = (body: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/live/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const lineFilter = url.searchParams.get('line');
      const snapshot = {
        cycleId: 1,
        generatedAt: RUN.observedAt,
        runs: lineFilter && lineFilter !== RUN.lineCode ? [] : [RUN],
      };
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      const heartbeat = setInterval(() => res.write('event: heartbeat\ndata: {}\n\n'), 1000);
      req.on('close', () => clearInterval(heartbeat));
      return;
    }
    if (url.pathname === '/sightings')
      return json(sightingWindow(new Date(url.searchParams.get('from') ?? 0)));
    if (url.pathname === '/stations') return json(STATIONS);
    if (url.pathname === '/lines/geometry') return json(NO_TRACK);
    if (url.pathname === '/stats/punctuality') return json(PUNCTUALITY_RANKING);
    if (url.pathname === '/stats/delay-by-hour') return json(DELAY_BY_HOUR);
    if (url.pathname === '/alerts') return json([ALERT]);
    if (url.pathname === '/search/suggestions') return json(SUGGESTIONS);
    if (url.pathname === '/search') return json(search(url.searchParams.get('q') ?? ''));
    if (url.pathname === `/runs/${SERVICE_DATE}/${RUN.trainNumber}`) return json(RUN_DETAIL);
    if (url.pathname === `/stations/${STATION_CODE}/board`) return json(STATION_BOARD);
    json({ message: 'Not found' }, 404);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
