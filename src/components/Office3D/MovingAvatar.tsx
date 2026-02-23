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

    // Small wander area around the working station (keeps agents near their desk)
    const idleCenter = chair.clone().add(new Vector3(0, 0, 0.4));

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

    for (const obstacle of obstacles) {
      // Obstacles are defined on y=0 while avatars float around y=0.6.
      // Use XZ distance only to make collisions consistent.
      const distance = distXZ(pos, obstacle.position);
      if (distance < obstacle.radius + minDistanceToObstacle) return false;
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

  // ---- Initial position: spawn at the agent's station (NOT random across the office) ----
  const [initialPos] = useState(() => {
    // Working/thinking should start seated, otherwise start near their chair
    const base = state.status === 'working' || state.status === 'thinking' ? anchors.chair : anchors.idleCenter;
    let pos = base.clone();

    // Nudge if colliding
    for (let i = 0; i < 10; i++) {
      if (isPositionFree(pos)) break;
      pos = randomAround(base, 1.0);
    }

    return pos;
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
      const radius = state.status === 'idle' ? 0.6 : 0.35; // smaller, more natural local movement
      const center = anchors.idleCenter;

      let attempts = 0;
      let newPos: Vector3;
      do {
        newPos = randomAround(center, radius);
        attempts++;
      } while (!isPositionFree(newPos) && attempts < 20);

      if (attempts < 20) setTargetPos(newPos);
    };

    const intervalMs = (() => {
      switch (state.status) {
        case 'idle':
          return 1600 + Math.random() * 1800; // 1.6-3.4s (more frequent micro-moves)
        case 'error':
          return 4500 + Math.random() * 2500; // 4.5-7s
        default:
          return 9000;
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
