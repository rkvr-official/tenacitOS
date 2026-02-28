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

export default function MovingAvatar({
  agent,
  state,
  officeBounds,
  obstacles,
  otherAvatarPositions,
  onPositionUpdate,
}: MovingAvatarProps) {
  const groupRef = useRef<Group>(null);

  // Desk + chair anchors (must match AgentDesk chair placement)
  const anchors = useMemo(() => {
    const desk = new Vector3(agent.position[0], 0.6, agent.position[2]);

    // In AgentDesk:
    //  <group scale={2}><VoxelChair position={[0,0,0.9]} ... /></group>
    // So chair world offset ~= z + 0.9*2 = +1.8
    const chair = new Vector3(agent.position[0], 0.6, agent.position[2] + 1.8);

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
    const samples = 4;
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
      // 80%: roam near desk (keeps identity), 20%: roam anywhere (room feels alive)
      const roamGlobal = Math.random() < 0.2;

      const sampleRoom = () => {
        const x = officeBounds.minX + 0.8 + Math.random() * (officeBounds.maxX - officeBounds.minX - 1.6);
        const z = officeBounds.minZ + 0.8 + Math.random() * (officeBounds.maxZ - officeBounds.minZ - 1.6);
        return new Vector3(x, 0.6, z);
      };

      const sampleNearDesk = () => {
        const radius = state.status === 'idle' ? 1.9 : 1.2;
        const center = anchors.desk;
        let p = randomAround(center, radius);

        // Avoid hanging out behind the desk in the chair zone (chair is at z+1.8)
        const maxZ = anchors.desk.z + 0.75;
        if (p.z > maxZ) p.z = maxZ;
        return p;
      };

      let attempts = 0;
      let newPos: Vector3;
      do {
        newPos = roamGlobal ? sampleRoom() : sampleNearDesk();
        attempts++;
      } while ((!isPositionFree(newPos) || !isPathFree(currentPos.current, newPos)) && attempts < 40);

      if (attempts < 40) setTargetPos(newPos);
    };

    const intervalMs = (() => {
      switch (state.status) {
        case 'idle':
          return 3000 + Math.random() * 3000; // 3-6s (like upstream)
        case 'error':
          return 12000 + Math.random() * 8000; // mostly still
        default:
          return 6000 + Math.random() * 6000;
      }
    })();

    const t = setTimeout(pickTarget, 800);
    const i = setInterval(pickTarget, intervalMs);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [state.status, anchors.idleCenter, officeBounds.minX, officeBounds.maxX, officeBounds.minZ, officeBounds.maxZ]);

  // ---- Move smoothly towards target ----
  useFrame((frameState, delta) => {
    if (!groupRef.current) return;

    // If seated, stay put
    if (state.status === 'working' || state.status === 'thinking') {
      groupRef.current.position.copy(anchors.chair);
      groupRef.current.rotation.y = Math.PI;
      return;
    }

    const speed = state.status === 'idle' ? 0.95 : 0.6;
    const moveLerp = Math.min(1, delta * speed);

    const newPos = currentPos.current.clone().lerp(targetPos, moveLerp);

    if (isPositionFree(newPos) && isPathFree(currentPos.current, newPos)) {
      currentPos.current.copy(newPos);
      groupRef.current.position.copy(currentPos.current);
      onPositionUpdate(agent.id, currentPos.current.clone());

      const direction = new Vector3().subVectors(targetPos, currentPos.current);
      if (direction.length() > 0.03) {
        const angle = Math.atan2(direction.x, direction.z);
        groupRef.current.rotation.y = angle;
      }
    } else {
      // Try a gentle sidestep when blocked to avoid robotic stuck behavior
      const sideStep = randomAround(currentPos.current, 0.5);
      if (isPositionFree(sideStep)) {
        setTargetPos(sideStep);
      }
    }
  });

  return (
    <group ref={groupRef} scale={3}>
      <VoxelAvatar
        agent={agent}
        position={[0, 0, 0]}
        isWorking={state.status === 'working'}
        isThinking={state.status === 'thinking'}
        isError={state.status === 'error'}
        seated={state.status === 'working' || state.status === 'thinking'}
      />
      <NameTag text={`${agent.emoji} ${agent.name}`} offset={[0, 1.05, 0]} />
    </group>
  );
}
