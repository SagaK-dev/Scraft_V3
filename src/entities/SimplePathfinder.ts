export interface NavigationPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PathfinderOptions {
  readonly maxNodes?: number;
  readonly maxPathLength?: number;
}

export type StandHeightSampler = (x: number, z: number, fromY: number) => number | null;

interface SearchNode extends NavigationPoint {
  readonly key: string;
  g: number;
  f: number;
  parent: string | null;
}

const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function findSimplePath(
  start: NavigationPoint,
  target: NavigationPoint,
  sampleStandY: StandHeightSampler,
  options: PathfinderOptions = {},
): NavigationPoint[] {
  validatePoint(start);
  validatePoint(target);
  const maxNodes = clampInteger(options.maxNodes ?? 128, 8, 1024, 'maxNodes');
  const maxPathLength = clampInteger(options.maxPathLength ?? 32, 1, 128, 'maxPathLength');
  const sx = Math.floor(start.x);
  const sz = Math.floor(start.z);
  const tx = Math.floor(target.x);
  const tz = Math.floor(target.z);
  if (sx === tx && sz === tz) return [];

  const startKey = key(sx, sz);
  const nodes = new Map<string, SearchNode>();
  const open = new Set<string>([startKey]);
  const closed = new Set<string>();
  const startNode: SearchNode = { x: sx + 0.5, y: start.y, z: sz + 0.5, key: startKey, g: 0, f: heuristic(sx, sz, tx, tz), parent: null };
  nodes.set(startKey, startNode);
  let best = startNode;
  let expanded = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const current = bestOpen(open, nodes);
    open.delete(current.key);
    closed.add(current.key);
    expanded += 1;
    if (heuristic(Math.floor(current.x), Math.floor(current.z), tx, tz) < heuristic(Math.floor(best.x), Math.floor(best.z), tx, tz)) best = current;
    if (Math.floor(current.x) === tx && Math.floor(current.z) === tz) {
      best = current;
      break;
    }

    for (const [dx, dz] of CARDINALS) {
      const nx = Math.floor(current.x) + dx;
      const nz = Math.floor(current.z) + dz;
      const nextKey = key(nx, nz);
      if (closed.has(nextKey)) continue;
      const y = sampleStandY(nx, nz, current.y);
      if (y === null || !Number.isFinite(y)) continue;
      const verticalCost = Math.abs(y - current.y) * 0.35;
      const tentativeG = current.g + 1 + verticalCost;
      const known = nodes.get(nextKey);
      if (known && tentativeG >= known.g - 1e-9) continue;
      const node: SearchNode = known ?? { x: nx + 0.5, y, z: nz + 0.5, key: nextKey, g: tentativeG, f: 0, parent: current.key };
      node.g = tentativeG;
      node.f = tentativeG + heuristic(nx, nz, tx, tz);
      node.parent = current.key;
      if (!known) nodes.set(nextKey, node);
      open.add(nextKey);
    }
  }

  if (best.key === startKey) return [];
  const reversed: NavigationPoint[] = [];
  let cursor: SearchNode | undefined = best;
  while (cursor && cursor.key !== startKey && reversed.length < maxPathLength) {
    reversed.push({ x: cursor.x, y: cursor.y, z: cursor.z });
    cursor = cursor.parent ? nodes.get(cursor.parent) : undefined;
  }
  reversed.reverse();
  return reversed;
}

function bestOpen(open: Set<string>, nodes: Map<string, SearchNode>): SearchNode {
  let best: SearchNode | null = null;
  for (const entry of open) {
    const node = nodes.get(entry);
    if (!node) continue;
    if (!best || node.f < best.f || (node.f === best.f && node.g < best.g) || (node.f === best.f && node.g === best.g && node.key < best.key)) best = node;
  }
  if (!best) throw new Error('Pathfinder open set became inconsistent.');
  return best;
}

function heuristic(x: number, z: number, tx: number, tz: number): number {
  return Math.abs(tx - x) + Math.abs(tz - z);
}

function key(x: number, z: number): string { return `${x},${z}`; }
function validatePoint(point: NavigationPoint): void { if (![point.x, point.y, point.z].every(Number.isFinite)) throw new RangeError('Navigation points must be finite.'); }
function clampInteger(value: number, min: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be an integer from ${min} to ${max}.`);
  return value;
}
