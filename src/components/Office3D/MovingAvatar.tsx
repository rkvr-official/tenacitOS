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

  // ---- Pick new wander targets (only when not working/thinking) ----
  useEffect(() => {
    if (state.status === 'working' || state.status === 'thinking') return;

    const pickTarget = () => {
      // Mostly roam near desk (keeps identity), occasionally roam anywhere (room feels alive)
      const roamGlobal = Math.random() < 0.05;

      const sampleRoom = () => {
        const x = officeBounds.minX + 0.8 + Math.random() * (officeBounds.maxX - officeBounds.minX - 1.6);
        const z = officeBounds.minZ + 0.8 + Math.random() * (officeBounds.maxZ - officeBounds.minZ - 1.6);
        return new Vector3(x, 0.6, z);
      };

      const sampleNearDesk = () => {
        const radius = state.status === 'idle' ? 2.2 : 1.4;
        const center = anchors.desk;
        let p = randomAround(center, radius);

        // Avoid hanging out behind the desk in the chair zone (chair is at z+1.8)
        const maxZ = anchors.desk.z + 0.7;
        if (p.z > maxZ) p.z = maxZ;
        return p;
      };

      const maxHop = roamGlobal ? 4.0 : 2.4; // prevent huge walks in a single target

      let attempts = 0;
      let newPos: Vector3;
      const farFromObstacles = (p: Vector3) => {
        // avoid targets hugging furniture; reduces "walking into desk" behavior
        for (const o of obstacles) {
          const d = distXZ(p, o.position);
          if (d < o.radius + 1.05) return false;
        }
        return true;
      };

      do {
        newPos = roamGlobal ? sampleRoom() : sampleNearDesk();
        attempts++;
        if (newPos.distanceTo(currentPos.current) > maxHop) continue;
        if (!farFromObstacles(newPos)) continue;
      } while ((!isPositionFree(newPos) || !isPathFree(currentPos.current, newPos)) && attempts < 80);

      if (attempts < 80) setTargetPos(newPos);
    };

    const intervalMs = (() => {
      switch (state.status) {
        case 'idle':
          return 4500 + Math.random() * 4500; // 4.5-9s (slower, more natural)
        case 'error':
          return 16000 + Math.random() * 12000; // mostly still
        default:
          return 9000 + Math.random() * 9000;
      }
    })();

    const t = setTimeout(pickTarget, 800);
    const i = setInterval(pickTarget, intervalMs);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [state.status, anchors.idleCenter, officeBounds.minX, officeBounds.maxX, officeBounds.minZ, officeBounds.maxZ]);

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

    // Desired direction
    const toTarget = new Vector3().subVectors(targetPos, currentPos.current);
    toTarget.y = 0;
    const dist = toTarget.length();
    if (dist < 0.06) {
      walkingRef.current = false;
      return;
    }

    const desiredDir = toTarget.normalize();

    // Steering avoidance (repel from obstacles/avatars + walls)
    const avoid = new Vector3(0, 0, 0);
    const influenceObstacle = 2.1;
    const influenceAvatar = 1.6;

    for (const obstacle of obstacles) {
      const d = distXZ(currentPos.current, obstacle.position) - obstacle.radius;
      if (d < influenceObstacle) {
        const away = new Vector3(currentPos.current.x - obstacle.position.x, 0, currentPos.current.z - obstacle.position.z);
        const len = away.length();
        if (len > 1e-3) {
          away.multiplyScalar(1 / len);
          const s = (influenceObstacle - d) / influenceObstacle;
          avoid.add(away.multiplyScalar(s * s * 1.9));
        }
      }
    }

    for (const [otherId, otherPos] of otherAvatarPositions.entries()) {
      if (otherId === agent.id) continue;
      const d = distXZ(currentPos.current, otherPos);
      if (d < influenceAvatar) {
        const away = new Vector3(currentPos.current.x - otherPos.x, 0, currentPos.current.z - otherPos.z);
        const len = away.length();
        if (len > 1e-3) {
          away.multiplyScalar(1 / len);
          const s = (influenceAvatar - d) / influenceAvatar;
          avoid.add(away.multiplyScalar(s * s * 1.2));
        }
      }
    }

    // Wall repulsion
    const margin = 1.1;
    const k = 1.1;
    if (currentPos.current.x < officeBounds.minX + margin) avoid.x += (officeBounds.minX + margin - currentPos.current.x) * k;
    if (currentPos.current.x > officeBounds.maxX - margin) avoid.x -= (currentPos.current.x - (officeBounds.maxX - margin)) * k;
    if (currentPos.current.z < officeBounds.minZ + margin) avoid.z += (officeBounds.minZ + margin - currentPos.current.z) * k;
    if (currentPos.current.z > officeBounds.maxZ - margin) avoid.z -= (currentPos.current.z - (officeBounds.maxZ - margin)) * k;

    const steer = desiredDir.clone().add(avoid).normalize();

    // Step size: small, smooth.
    const maxSpeed = state.status === 'idle' ? 0.45 : 0.32; // units/sec
    const maxStep = 0.032; // cap per frame
    const stepLen = Math.min(maxStep, maxSpeed * delta);

    // Try multiple directions so they naturally go around desks instead of pushing into them.
    const dirs: Vector3[] = [];
    const perp = new Vector3(-steer.z, 0, steer.x).normalize();
    dirs.push(steer.clone());
    dirs.push(steer.clone().add(perp.clone().multiplyScalar(0.65)).normalize());
    dirs.push(steer.clone().add(perp.clone().multiplyScalar(-0.65)).normalize());
    dirs.push(perp.clone());
    dirs.push(perp.clone().multiplyScalar(-1));

    let moved = false;
    let chosenStep = new Vector3(0, 0, 0);

    for (const d of dirs) {
      const p = currentPos.current.clone().add(d.clone().multiplyScalar(stepLen));
      if (isPositionFree(p) && isPathFree(currentPos.current, p)) {
        chosenStep = d.clone().multiplyScalar(stepLen);
        currentPos.current.copy(p);
        moved = true;
        break;
      }
    }

    if (moved) {
      stuckFramesRef.current = 0;
      groupRef.current.position.copy(currentPos.current);
      onPositionUpdate(agent.id, currentPos.current.clone());

      const angle = Math.atan2(chosenStep.x, chosenStep.z);
      groupRef.current.rotation.y = angle;
      walkingRef.current = true;
    } else {
      walkingRef.current = false;
      stuckFramesRef.current += 1;

      // If stuck for ~2 seconds, pick a brand new target (prevents endless "driving" into a desk).
      if (stuckFramesRef.current > 120) {
        stuckFramesRef.current = 0;
        const side = randomAround(currentPos.current, 1.4);
        if (isPositionFree(side) && isPathFree(currentPos.current, side)) setTargetPos(side);
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
