'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import VoxelAvatar from './VoxelAvatar';
import NameTag from './NameTag';
import type { AgentConfig, AgentState } from './agentsConfig';

interface Obstacle {
  position: Vector3;
  radius: number;
}

interface MovingAvatarProps {
  agent: AgentConfig;
  state: AgentState;
  officeBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  obstacles: Obstacle[];
  otherAvatarPositions: Map<string, Vector3>;
  onPositionUpdate: (id: string, pos: Vector3) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const distXZ = (a: Vector3, b: Vector3) => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

// Global per-page-load spawn reservations to avoid initial overlaps (no agent-to-agent coordination needed).
const SPAWN_RESERVATIONS = new Map<string, Vector3>();
const isSpawnReservedFree = (id: string, p: Vector3) => {
  for (const [otherId, otherPos] of SPAWN_RESERVATIONS.entries()) {
    if (otherId === id) continue;
    if (distXZ(p, otherPos) < 1.1) return false;
  }
  return true;
};

export default function MovingAvatar({
  agent,
  state,
  officeBounds,
  obstacles,
  otherAvatarPositions,
  onPositionUpdate,
}: MovingAvatarProps) {
  const groupRef = useRef<Group>(null);
  const walkingRef = useRef(false);
  const stuckFramesRef = useRef(0);
  const yieldUntilRef = useRef(0);

  // Pathing: follow a graph of walkable waypoints (corridors) instead of pushing into desks.
  const routeRef = useRef<Vector3[]>([]);
  const goalRef = useRef<Vector3 | null>(null);
  const waypointGraphRef = useRef<{ nodes: Vector3[]; edges: number[][] } | null>(null);

  // Desk + chair anchors (must match AgentDesk chair placement)
  const anchors = useMemo(() => {
    const desk = new Vector3(agent.position[0], 0.6, agent.position[2]);

    // In AgentDesk:
    //  <group scale={2}><VoxelChair position={[0,0,0.9]} ... /></group>
    // So chair world offset ~= z + 0.9*2 = +1.8
    // Seat height is ~0.80 in world units (VoxelChair seat at y=0.4 scaled by 2).
    // Place seated avatars slightly above that so they sit cleanly without clipping.
    const chair = new Vector3(agent.position[0], 0.82, agent.position[2] + 1.8);

    // Walk anchor in front of the desk (monitor is at z=-0.5, so "front" is -Z).
    // This keeps non-working agents from spawning in the chair zone.
    const walk = new Vector3(agent.position[0], 0.6, agent.position[2] - 2.2);
    walk.x = clamp(walk.x, officeBounds.minX + 1.0, officeBounds.maxX - 1.0);
    walk.z = clamp(walk.z, officeBounds.minZ + 1.0, officeBounds.maxZ - 1.0);

    return { desk, chair, walk };
  }, [agent.position, officeBounds.minX, officeBounds.maxX, officeBounds.minZ, officeBounds.maxZ]);

  // ---- Collision helpers ----
  const isStaticFree = (pos: Vector3): boolean => {
    // static collisions: furniture only
    const minDistanceToObstacle = 0.75;
    for (const obstacle of obstacles) {
      const distance = distXZ(pos, obstacle.position);
      if (distance < obstacle.radius + minDistanceToObstacle) return false;
    }
    return true;
  };

  const isPositionFree = (pos: Vector3): boolean => {
    // dynamic collisions: furniture + other avatars
    const minDistanceToAvatar = 0.7;

    if (!isStaticFree(pos)) return false;

    for (const [otherId, otherPos] of otherAvatarPositions.entries()) {
      if (otherId === agent.id) continue;
      const distance = distXZ(pos, otherPos);
      if (distance < minDistanceToAvatar) return false;
    }

    return true;
  };

  const isStaticPathFree = (from: Vector3, to: Vector3): boolean => {
    const length = distXZ(from, to);
    const samples = Math.max(12, Math.min(44, Math.floor(length / 0.2)));
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const probe = from.clone().lerp(to, t);
      if (!isStaticFree(probe)) return false;
    }
    return true;
  };

  const isPathFree = (from: Vector3, to: Vector3): boolean => {
    // dynamic version (includes avatar avoidance)
    const length = distXZ(from, to);
    const samples = Math.max(12, Math.min(44, Math.floor(length / 0.2)));
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const probe = from.clone().lerp(to, t);
      if (!isPositionFree(probe)) return false;
    }
    return true;
  };

  const randomAround = (center: Vector3, radius: number) => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const x = center.x + Math.cos(angle) * r;
    const z = center.z + Math.sin(angle) * r;
    return new Vector3(
      clamp(x, officeBounds.minX, officeBounds.maxX),
      0.6,
      clamp(z, officeBounds.minZ, officeBounds.maxZ)
    );
  };

  const nearestNodeIndex = (nodes: Vector3[], p: Vector3): number => {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < nodes.length; i++) {
      const d = distXZ(nodes[i], p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const buildWaypointGraph = (): { nodes: Vector3[]; edges: number[][] } => {
    // Dense corridor sampling: generates many possible walkable points, then connects locally.
    // This makes pathing robust (few "stuck" cases) while still respecting furniture obstacles.
    const nodes: Vector3[] = [];

    const pad = 1.05;
    const step = 1.4;

    for (let x = officeBounds.minX + pad; x <= officeBounds.maxX - pad; x += step) {
      for (let z = officeBounds.minZ + pad; z <= officeBounds.maxZ - pad; z += step) {
        const p = new Vector3(Number(x.toFixed(2)), 0.6, Number(z.toFixed(2)));
        if (!isStaticFree(p)) continue;
        nodes.push(p);
      }
    }

    // Always include perimeter loop nodes as anchors.
    const loop = [
      new Vector3(officeBounds.minX + pad, 0.6, officeBounds.minZ + pad),
      new Vector3(officeBounds.maxX - pad, 0.6, officeBounds.minZ + pad),
      new Vector3(officeBounds.maxX - pad, 0.6, officeBounds.maxZ - pad),
      new Vector3(officeBounds.minX + pad, 0.6, officeBounds.maxZ - pad),
    ].filter(isStaticFree);
    nodes.push(...loop);

    const edges: number[][] = Array.from({ length: nodes.length }, () => []);

    const connect = (a: number, b: number) => {
      if (a === b) return;
      if (!edges[a].includes(b)) edges[a].push(b);
      if (!edges[b].includes(a)) edges[b].push(a);
    };

    // Connect each node to its nearest neighbors.
    const maxNeighborDist = 2.2;
    const k = 6;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const dists: Array<{ j: number; d: number }> = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = distXZ(a, nodes[j]);
        if (d <= maxNeighborDist) dists.push({ j, d });
      }
      dists.sort((x, y) => x.d - y.d);
      for (const { j } of dists.slice(0, k)) {
        if (isStaticPathFree(a, nodes[j])) connect(i, j);
      }
    }

    return { nodes, edges };
  };

  const bfsRoute = (graph: { nodes: Vector3[]; edges: number[][] }, start: number, goal: number): number[] | null => {
    if (start === goal) return [start];
    const q: number[] = [start];
    const prev = new Map<number, number>();
    prev.set(start, -1);

    while (q.length) {
      const v = q.shift()!;
      for (const n of graph.edges[v] || []) {
        if (prev.has(n)) continue;
        prev.set(n, v);
        if (n === goal) {
          // reconstruct
          const path: number[] = [];
          let cur = n;
          while (cur !== -1) {
            path.push(cur);
            cur = prev.get(cur)!;
          }
          path.reverse();
          return path;
        }
        q.push(n);
      }
    }

    return null;
  };

  // ---- Initial position ----
  // Spawn close to the agent's desk (not on the chair), with a fallback to any free spot in the room.
  const [initialPos] = useState(() => {
    const seated = state.status === 'working' || state.status === 'thinking';

    const randomRing = (center: Vector3, minR: number, maxR: number) => {
      const angle = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      return new Vector3(
        clamp(center.x + Math.cos(angle) * r, officeBounds.minX, officeBounds.maxX),
        0.6,
        clamp(center.z + Math.sin(angle) * r, officeBounds.minZ, officeBounds.maxZ)
      );
    };

    if (seated) {
      SPAWN_RESERVATIONS.set(agent.id, anchors.chair.clone());
      return anchors.chair.clone();
    }

    // Prefer spawning in front of the desk (walk anchor), not on the chair and not on the desk.
    for (let i = 0; i < 120; i++) {
      const candidate = randomRing(anchors.walk, 0.4, 1.3);
      if (!isSpawnReservedFree(agent.id, candidate)) continue;
      if (isPositionFree(candidate)) {
        SPAWN_RESERVATIONS.set(agent.id, candidate.clone());
        return candidate;
      }
    }

    // Fallback: any free room position
    for (let i = 0; i < 220; i++) {
      const x = officeBounds.minX + 1.0 + Math.random() * (officeBounds.maxX - officeBounds.minX - 2.0);
      const z = officeBounds.minZ + 1.0 + Math.random() * (officeBounds.maxZ - officeBounds.minZ - 2.0);
      const candidate = new Vector3(x, 0.6, z);
      if (!isSpawnReservedFree(agent.id, candidate)) continue;
      if (isPositionFree(candidate)) {
        SPAWN_RESERVATIONS.set(agent.id, candidate.clone());
        return candidate;
      }
    }

    const fallback = anchors.walk.clone();
    SPAWN_RESERVATIONS.set(agent.id, fallback.clone());
    return fallback;
  });

  const targetPosRef = useRef(initialPos.clone());
  const currentPos = useRef(initialPos.clone());

  const setTarget = (p: Vector3) => {
    targetPosRef.current = p.clone();
  };

  // Notificar posición inicial
  useEffect(() => {
    onPositionUpdate(agent.id, initialPos.clone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- State-driven anchoring: working/thinking snap to chair ----
  useEffect(() => {
    if (state.status === 'working' || state.status === 'thinking') {
      setTarget(anchors.chair.clone());
      currentPos.current.copy(anchors.chair);
      if (groupRef.current) {
        groupRef.current.position.copy(anchors.chair);
        groupRef.current.rotation.y = Math.PI; // face the desk/monitor
      }
      onPositionUpdate(agent.id, anchors.chair.clone());
    }
  }, [state.status, anchors.chair, agent.id, onPositionUpdate]);

  // ---- Pick new goals on a WALKABLE GRAPH (corridors) ----
  useEffect(() => {
    if (state.status === 'working' || state.status === 'thinking') return;

    if (!waypointGraphRef.current) {
      waypointGraphRef.current = buildWaypointGraph();
    }

    const pickGoal = () => {
      const graph = waypointGraphRef.current;
      if (!graph || graph.nodes.length < 2) return;

      // Mostly roam near own desk, occasionally roam anywhere.
      const roamGlobal = Math.random() < 0.12;

      const near = graph.nodes
        .map((p, idx) => ({ idx, d: distXZ(p, anchors.desk) }))
        .filter((x) => x.d < 4.2);

      const pickFrom = roamGlobal || near.length === 0
        ? graph.nodes.map((_, idx) => idx)
        : near.map((x) => x.idx);

      const goalIdx = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      const startIdx = nearestNodeIndex(graph.nodes, currentPos.current);

      const routeIdxs = bfsRoute(graph, startIdx, goalIdx);
      if (!routeIdxs || routeIdxs.length === 0) return;

      const routeNodes = routeIdxs.map((i) => graph.nodes[i].clone());
      if (routeNodes.length && distXZ(routeNodes[0], currentPos.current) < 0.35) routeNodes.shift();

      goalRef.current = graph.nodes[goalIdx].clone();
      routeRef.current = routeNodes;

      if (routeRef.current.length) setTarget(routeRef.current[0]);
    };

    const intervalMs = (() => {
      switch (state.status) {
        case 'idle':
          return 5200 + Math.random() * 5200;
        case 'error':
          return 14000 + Math.random() * 12000;
        default:
          return 9200 + Math.random() * 9200;
      }
    })();

    const t = setTimeout(pickGoal, 600);
    const i = setInterval(pickGoal, intervalMs);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [state.status, anchors.desk, officeBounds.minX, officeBounds.maxX, officeBounds.minZ, officeBounds.maxZ]);

  // ---- Move towards target with steering (more natural: avoid walking straight into objects) ----
  useFrame((_frameState, delta) => {
    if (!groupRef.current) return;

    const seatedNow = state.status === 'working' || state.status === 'thinking';
    const seatedPos = anchors.chair.clone().add(new Vector3(0, 0, -0.12));

    if (seatedNow) {
      groupRef.current.position.copy(seatedPos);
      groupRef.current.rotation.y = Math.PI;
      walkingRef.current = false;
      return;
    }

    const now = Date.now();
    if (yieldUntilRef.current > now) {
      walkingRef.current = false;
      return;
    }

    const targetPos = targetPosRef.current;

    // Follow route waypoints: keep target updated to the next waypoint
    if (routeRef.current.length) {
      const next = routeRef.current[0];
      if (distXZ(next, targetPosRef.current) > 0.05) setTarget(next);
    }

    const toTarget = new Vector3().subVectors(targetPosRef.current, currentPos.current);
    toTarget.y = 0;
    const dist = toTarget.length();

    // Advance route when we reach a waypoint.
    if (dist < 0.22) {
      if (routeRef.current.length) routeRef.current.shift();
      if (routeRef.current.length) {
        setTarget(routeRef.current[0]);
      }
      walkingRef.current = false;
      return;
    }

    // Step towards target.
    const dir = toTarget.normalize();

    const maxSpeed = state.status === 'idle' ? 0.42 : 0.30;
    const stepLen = Math.min(0.026, maxSpeed * delta);

    const left = new Vector3(-dir.z, 0, dir.x).normalize();
    const dirs = [
      dir.clone(),
      dir.clone().add(left.clone().multiplyScalar(0.85)).normalize(),
      dir.clone().add(left.clone().multiplyScalar(-0.85)).normalize(),
      left.clone(),
      left.clone().multiplyScalar(-1),
    ];

    let moved = false;
    let step = new Vector3(0, 0, 0);

    for (const d of dirs) {
      const candidate = currentPos.current.clone().add(d.clone().multiplyScalar(stepLen));
      if (isPositionFree(candidate) && isPathFree(currentPos.current, candidate)) {
        step = d.clone().multiplyScalar(stepLen);
        currentPos.current.copy(candidate);
        moved = true;
        break;
      }
    }

    if (moved) {
      stuckFramesRef.current = 0;
      groupRef.current.position.copy(currentPos.current);
      onPositionUpdate(agent.id, currentPos.current.clone());
      groupRef.current.rotation.y = Math.atan2(step.x, step.z);
      walkingRef.current = true;
    } else {
      walkingRef.current = false;
      stuckFramesRef.current += 1;

      // If we're blocked by another avatar in a corridor, yield (prevents deadlocks).
      if (stuckFramesRef.current > 12) {
        let closest: { id: string; d: number } | null = null;
        for (const [otherId, otherPos] of otherAvatarPositions.entries()) {
          if (otherId === agent.id) continue;
          const d = distXZ(currentPos.current, otherPos);
          if (d < 0.95 && (!closest || d < closest.d)) closest = { id: otherId, d };
        }
        if (closest && agent.id > closest.id) {
          yieldUntilRef.current = Date.now() + 900 + Math.floor(Math.random() * 700);
          stuckFramesRef.current = 0;
          return;
        }
      }

      // If stuck for ~1.5s, abandon route so next interval picks a new one.
      if (stuckFramesRef.current > 90) {
        stuckFramesRef.current = 0;
        routeRef.current = [];
        goalRef.current = null;
      }
    }
  });

  // Walking state (for animation)
  const walking = walkingRef.current;

  return (
    <group ref={groupRef} scale={2.4}>
      <VoxelAvatar
        agent={agent}
        position={[0, 0, 0]}
        isWorking={state.status === 'working'}
        isThinking={state.status === 'thinking'}
        isError={state.status === 'error'}
        isWalking={walking}
        seated={state.status === 'working' || state.status === 'thinking'}
      />
      <NameTag text={`${agent.emoji} ${agent.name}`} offset={[0, 1.15, 0]} />
    </group>
  );
}
