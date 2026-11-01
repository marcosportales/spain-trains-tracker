/** One OpenStreetMap railway way: its vertices as `[lon, lat]`. */
export type OsmWay = readonly (readonly [number, number])[];

export interface TrackMatch {
  /** The drawn path, as `[lon, lat]` vertices, in the order of the Stations. */
  readonly path: [number, number][];
  /** How many of the given Stations lie on the path. */
  readonly matchedStations: number;
}

export interface TrackMatchOptions {
  /** A Station farther than this from every track vertex is not matched. Default 500 m. */
  readonly snapMeters?: number;
}

const DEFAULT_SNAP_METERS = 500;
const METERS_PER_DEGREE = 111_320;

/**
 * Map-matches Stations onto OpenStreetMap railway ways: each Station snaps to its nearest track
 * vertex, and consecutive Stations are joined by the shortest route along the track. A Station that
 * is too far from the track, or not connected to the rest of it, is left out. Returns undefined when
 * fewer than two Stations end up on the track.
 */
export function matchTrackGeometry(
  ways: readonly OsmWay[],
  stations: readonly { readonly lat: number; readonly lon: number }[],
  options: TrackMatchOptions = {},
): TrackMatch | undefined {
  const snapMeters = options.snapMeters ?? DEFAULT_SNAP_METERS;
  const graph = buildGraph(ways);
  if (graph.coords.length === 0) return undefined;

  const path: [number, number][] = [];
  let current: number | undefined;
  let matched = 0;
  for (const station of stations) {
    const node = nearestNode(graph, station.lat, station.lon, snapMeters);
    if (node === undefined) continue;
    if (current === undefined) {
      current = node;
      matched = 1;
      path.push(coordOf(graph, node));
      continue;
    }
    const route = shortestRoute(graph, current, node);
    if (route === undefined) continue;
    for (const vertex of route.slice(1)) path.push(coordOf(graph, vertex));
    current = node;
    matched++;
  }
  return matched >= 2 && path.length >= 2 ? { path, matchedStations: matched } : undefined;
}

interface Graph {
  readonly coords: [number, number][];
  readonly edges: { to: number; meters: number }[][];
}

const coordOf = (graph: Graph, node: number): [number, number] => {
  const [lon, lat] = graph.coords[node] as [number, number];
  return [lon, lat];
};

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * METERS_PER_DEGREE;
  const dLon = (lon2 - lon1) * METERS_PER_DEGREE * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLon);
}

/** Vertices are shared by coordinate: OSM ways meet at identical nodes. */
function buildGraph(ways: readonly OsmWay[]): Graph {
  const ids = new Map<string, number>();
  const coords: [number, number][] = [];
  const edges: Graph['edges'] = [];
  const idOf = ([lon, lat]: readonly [number, number]): number => {
    const key = `${lon.toFixed(7)},${lat.toFixed(7)}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = coords.length;
      ids.set(key, id);
      coords.push([lon, lat]);
      edges.push([]);
    }
    return id;
  };
  for (const way of ways) {
    for (let i = 1; i < way.length; i++) {
      const a = idOf(way[i - 1] as readonly [number, number]);
      const b = idOf(way[i] as readonly [number, number]);
      if (a === b) continue;
      const [lonA, latA] = coords[a] as [number, number];
      const [lonB, latB] = coords[b] as [number, number];
      const meters = distanceMeters(latA, lonA, latB, lonB);
      (edges[a] as Graph['edges'][number]).push({ to: b, meters });
      (edges[b] as Graph['edges'][number]).push({ to: a, meters });
    }
  }
  return { coords, edges };
}

function nearestNode(
  graph: Graph,
  lat: number,
  lon: number,
  maxMeters: number,
): number | undefined {
  let best: number | undefined;
  let bestMeters = maxMeters;
  graph.coords.forEach(([nodeLon, nodeLat], node) => {
    const meters = distanceMeters(lat, lon, nodeLat, nodeLon);
    if (meters <= bestMeters) {
      bestMeters = meters;
      best = node;
    }
  });
  return best;
}

/** Dijkstra with a binary heap. Returns the vertices from `from` to `to`, or undefined when unconnected. */
function shortestRoute(graph: Graph, from: number, to: number): number[] | undefined {
  if (from === to) return [from];
  const best = new Map<number, number>([[from, 0]]);
  const previous = new Map<number, number>();
  const heap: [number, number][] = [[0, from]]; // [meters, node]
  const settled = new Set<number>();
  while (heap.length > 0) {
    const [meters, node] = pop(heap);
    if (settled.has(node)) continue;
    settled.add(node);
    if (node === to) break;
    for (const edge of graph.edges[node] as Graph['edges'][number]) {
      const total = meters + edge.meters;
      if (total < (best.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        best.set(edge.to, total);
        previous.set(edge.to, node);
        push(heap, [total, edge.to]);
      }
    }
  }
  if (!settled.has(to)) return undefined;
  const route = [to];
  for (let node = to; node !== from; ) {
    node = previous.get(node) as number;
    route.push(node);
  }
  return route.reverse();
}

function push(heap: [number, number][], item: [number, number]): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if ((heap[parent] as [number, number])[0] <= (heap[i] as [number, number])[0]) break;
    [heap[parent], heap[i]] = [heap[i] as [number, number], heap[parent] as [number, number]];
    i = parent;
  }
}

function pop(heap: [number, number][]): [number, number] {
  const top = heap[0] as [number, number];
  const last = heap.pop() as [number, number];
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (
        l < heap.length &&
        (heap[l] as [number, number])[0] < (heap[smallest] as [number, number])[0]
      )
        smallest = l;
      if (
        r < heap.length &&
        (heap[r] as [number, number])[0] < (heap[smallest] as [number, number])[0]
      )
        smallest = r;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i] as [number, number], heap[smallest] as [number, number]];
      i = smallest;
    }
  }
  return top;
}
