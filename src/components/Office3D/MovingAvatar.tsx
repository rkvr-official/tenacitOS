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

    // Standing/wandering anchor: keep agents near their DESK (not at the chair).
    // We'll pick targets around the desk but bias towards the front-side so they don't hover in the chair zone.
    const idleCenter = desk.clone();

    return { desk, chair, idleCenter };
  }, [agent.position]);

  // ---- Collision helpers ----
  const isPositionFree = (pos: Vector3): boolean => {
    const minDistanceToObstacle = 1.35; // stricter distance to furniture/desks
    const minDistanceToAvatar = 1.0; // distance between avatars

    const distXZ = (a: Vector3, b: Vector3) => {
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      return Math.sqrt(dx * dx + dz * dz);
    };

    const ownDesk = new Vector3(agent.position[0], 0, agent.position[2]);

    for (const obstacle of obstacles) {
      // Obstacles are defined on y=0 while avatars float around y=0.6.
      // Use XZ distance only to make collisions consistent.
      // Also: don't over-block the agent around its own desk, or it will never find a valid idle wander spot.
      const distance = distXZ(pos, obstacle.position);
      const isOwnDesk = distXZ(obstacle.position, ownDesk) < 0.01;
      const extra = isOwnDesk ? 0.35 : minDistanceToObstacle;
      if (distance < obstacle.radius + extra) return false;
    }

    for (const [otherId, otherPos] of otherAvatarPositions.entries()) {
      if (otherId === agent.id) continue;
      const distance = distXZ(pos, otherPos);
      if (distance < minDistanceToAvatar) return false;
    }

    return true;
  };

  const isPathFree = (from: Vector3, to: Vector3): boolean => {
    // Dynamic sampling: longer segments need more probes to avoid "cutting" through desks.
    const length = distXZ(from, to);
    const samples = Math.max(10, Math.min(36, Math.floor(length / 0.22)));
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
    // Generate a corridor grid and filter points that are collision-free.
    // This gives us a stable walkable graph so agents don't "drive" into desks.
    const xs = [-6, -3, 0, 3, 6].filter((x) => x >= officeBounds.minX + 0.8 && x <= officeBounds.maxX - 0.8);
    const zs = [-6, -3, 0, 3, 6].filter((z) => z >= officeBounds.minZ + 0.8 && z <= officeBounds.maxZ - 0.8);

    const nodes: Vector3[] = [];
    for (const x of xs) {
      for (const z of zs) {
        const p = new Vector3(x, 0.6, z);
        // Slightly stricter than normal: waypoints should never be near furniture.
        if (!isPositionFree(p)) continue;
        nodes.push(p);
      }
    }

    // If too few nodes (tight office), fall back to a perimeter loop.
    if (nodes.length < 8) {
      const pad = 1.1;
      const loop = [
        new Vector3(officeBounds.minX + pad, 0.6, officeBounds.minZ + pad),
        new Vector3(officeBounds.maxX - pad, 0.6, officeBounds.minZ + pad),
        new Vector3(officeBounds.maxX - pad, 0.6, officeBounds.maxZ - pad),
        new Vector3(officeBounds.minX + pad, 0.6, officeBounds.maxZ - pad),
      ].filter(isPositionFree);
      nodes.push(...loop);
    }

    const edges: number[][] = Array.from({ length: nodes.length }, () => []);

    const connect = (a: number, b: number) => {
      if (a === b) return;
      if (!edges[a].includes(b)) edges[a].push(b);
      if (!edges[b].includes(a)) edges[b].push(a);
    };

    // Connect nearest neighbors along rows/cols.
    const eps = 1e-3;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const sameX = Math.abs(a.x - b.x) < eps;
        const sameZ = Math.abs(a.z - b.z) < eps;
        if (!sameX && !sameZ) continue;
        const d = distXZ(a, b);
        if (d > 3.2) continue; // only local neighbors
        if (!isPathFree(a, b)) continue;
        connect(i, j);
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
    // Seated agents start at chair; otherwise spawn around desk.
    const seated = state.status === 'working' || state.status === 'thinking';
    const base = seated ? anchors.chair : anchors.desk;

    const randomRing = (center: Vector3, minR: number, maxR: number) => {
      const angle = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      return new Vector3(
        clamp(center.x + Math.cos(angle) * r, officeBounds.minX, officeBounds.maxX),
        0.6,
        clamp(center.z + Math.sin(angle) * r, officeBounds.minZ, officeBounds.maxZ)
      );
    };

    // 1) Try near-desk ring
    for (let i = 0; i < 40; i++) {
      const candidate = seated ? base.clone() : randomRing(base, 0.9, 1.8);
      if (isPositionFree(candidate)) return candidate;
    }

    // 2) Fallback: any free room position
    for (let i = 0; i < 80; i++) {
      const x = officeBounds.minX + 0.8 + Math.random() * (officeBounds.maxX - officeBounds.minX - 1.6);
      const z = officeBounds.minZ + 0.8 + Math.random() * (officeBounds.maxZ - officeBounds.minZ - 1.6);
      const candidate = new Vector3(x, 0.6, z);
      if (isPositionFree(candidate)) return candidate;
    }

    return seated ? base.clone() : anchors.idleCenter.clone();
  });

  const [targetPos, setTargetPos] = useState(initialPos);
  const currentPos = useRef(initialPos.clone());

  // Notificar posición inicial
  useEffect(() => {
    onPositionUpdate(agent.id, initialPos.clone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- State-driven anchoring: working/thinking snap to chair ----
  useEffect(() => {
    if (state.status === 'working' || state.status === 'thinking') {
      setTargetPos(anchors.chair.clone());
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

      if (routeRef.current.length) setTargetPos(routeRef.current[0]);
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

    // Follow route waypoints.
    // keep target updated to the next waypoint
    if (routeRef.current.length) {
      const next = routeRef.current[0];
      // Avoid hammering state updates every frame.
      if (distXZ(next, targetPos) > 0.05) setTargetPos(next);
    }

    const toTarget = new Vector3().subVectors(targetPos, currentPos.current);
    toTarget.y = 0;
    const dist = toTarget.length();

    // Advance route when we reach a waypoint.
    if (dist < 0.22) {
      if (routeRef.current.length) routeRef.current.shift();
      if (routeRef.current.length) {
        setTargetPos(routeRef.current[0]);
      }
      walkingRef.current = false;
      return;
    }

    // Step towards target.
    const dir = toTarget.normalize();

    const maxSpeed = state.status === 'idle' ? 0.42 : 0.30;
    const stepLen = Math.min(0.028, maxSpeed * delta);
    const step = dir.multiplyScalar(stepLen);
    const candidate = currentPos.current.clone().add(step);

    if (isPositionFree(candidate) && isPathFree(currentPos.current, candidate)) {
      stuckFramesRef.current = 0;
      currentPos.current.copy(candidate);
      groupRef.current.position.copy(currentPos.current);
      onPositionUpdate(agent.id, currentPos.current.clone());
      groupRef.current.rotation.y = Math.atan2(step.x, step.z);
      walkingRef.current = true;
    } else {
      walkingRef.current = false;
      stuckFramesRef.current += 1;

      // If stuck, re-route by picking a new goal.
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
