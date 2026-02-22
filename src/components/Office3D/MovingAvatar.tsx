'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Group, Vector3 } from 'three';
import VoxelAvatar from './VoxelAvatar';
import type { AgentConfig, AgentState } from './agentsConfig';

interface Obstacle {
  position: Vector3;
  radius: number;
}

interface MovingAvatarProps {
  agent: AgentConfig;
  state?: AgentState;
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

const FALLBACK_STATE: AgentState = { id: "unknown", status: "idle" };

export default function MovingAvatar({ 
  agent, 
  state, 
  officeBounds, 
  obstacles, 
  otherAvatarPositions,
  onPositionUpdate 
}: MovingAvatarProps) {
  const safeState = state ?? { ...FALLBACK_STATE, id: agent.id };
  const groupRef = useRef<Group>(null);
  
  // Initial position: deterministic near the agent's desk.
  // Random starts were causing avatar pile-ups before otherAvatarPositions is populated.
  const [initialPos] = useState(() => {
    const x = agent.position[0];
    const z = agent.position[2];
    return new Vector3(x, 0.6, z + 1.2);
  });

  const [targetPos, setTargetPos] = useState(initialPos);
  const currentPos = useRef(initialPos.clone());
  
  // Notificar posición inicial
  useEffect(() => {
    onPositionUpdate(agent.id, initialPos.clone());
  }, []);

  // Verificar si una posición está libre (sin colisiones)
  const isPositionFree = (pos: Vector3): boolean => {
    const minDistanceToObstacle = 1.5; // distancia mínima a muebles
    const minDistanceToAvatar = 1.2; // distancia mínima entre avatares

    // Verificar colisión con obstáculos
    for (const obstacle of obstacles) {
      const distance = pos.distanceTo(obstacle.position);
      if (distance < obstacle.radius + minDistanceToObstacle) {
        return false;
      }
    }

    // Verificar colisión con otros avatares
    for (const [otherId, otherPos] of otherAvatarPositions.entries()) {
      if (otherId === agent.id) continue;
      const distance = pos.distanceTo(otherPos);
      if (distance < minDistanceToAvatar) {
        return false;
      }
    }

    return true;
  };

  // When working/thinking: stay seated at the desk.
  useEffect(() => {
    if (safeState.status === 'working' || safeState.status === 'thinking') {
      // Keep avatar near the chair position (avoid desk/table clipping)
      setTargetPos(new Vector3(agent.position[0], 0.6, agent.position[2] + 1.8));
    }
  }, [agent.position[0], agent.position[2], safeState.status]);

  // Change wander target only when idle/error.
  useEffect(() => {
    if (safeState.status === 'working' || safeState.status === 'thinking') return;

    const getNewTarget = () => {
      let attempts = 0;
      let newPos: Vector3;

      // Intentar encontrar una posición libre (máximo 20 intentos)
      do {
        // Wander near own desk (keeps agents close to their station)
        const radius = 2.5;
        const x = agent.position[0] + (Math.random() - 0.5) * radius * 2;
        const z = agent.position[2] + (Math.random() - 0.5) * radius * 2;
        newPos = new Vector3(
          Math.max(officeBounds.minX, Math.min(officeBounds.maxX, x)),
          0.6,
          Math.max(officeBounds.minZ, Math.min(officeBounds.maxZ, z))
        );
        attempts++;
      } while (!isPositionFree(newPos) && attempts < 20);

      if (attempts < 20) {
        setTargetPos(newPos);
      }
    };

    // Idle: moverse más frecuentemente
    // Working: moverse menos
    // Thinking: moverse muy poco
    // Error: quedarse quieto
    const getInterval = () => {
      switch (safeState.status) {
        case 'idle':
          return 3000 + Math.random() * 3000; // 3-6s
        case 'working':
          return 8000 + Math.random() * 7000; // 8-15s
        case 'thinking':
          return 15000 + Math.random() * 10000; // 15-25s
        case 'error':
          return 30000; // casi quieto
        default:
          return 10000;
      }
    };

    // Primer objetivo después de montar
    const timeout = setTimeout(getNewTarget, 1000);
    const interval = setInterval(getNewTarget, getInterval());
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [safeState.status]);

  // Mover suavemente hacia el objetivo
  useFrame((frameState, delta) => {
    if (!groupRef.current) return;

    const speed = safeState.status === 'idle' ? 1.5 : 0.8; // idle se mueve más rápido
    const moveSpeed = delta * speed;

    // Calcular nueva posición
    const newPos = currentPos.current.clone().lerp(targetPos, moveSpeed);

    // Verificar si la nueva posición es válida
    if (isPositionFree(newPos)) {
      currentPos.current.copy(newPos);
      groupRef.current.position.copy(currentPos.current);

      // Notificar la nueva posición
      onPositionUpdate(agent.id, currentPos.current.clone());

      // Rotar hacia la dirección del movimiento
      const direction = new Vector3().subVectors(targetPos, currentPos.current);
      if (direction.length() > 0.1) {
        const angle = Math.atan2(direction.x, direction.z);
        groupRef.current.rotation.y = angle;
      }
    } else {
      // Si hay colisión, buscar nuevo objetivo (near own desk)
      const radius = 2.5;
      const x = agent.position[0] + (Math.random() - 0.5) * radius * 2;
      const z = agent.position[2] + (Math.random() - 0.5) * radius * 2;
      const newTarget = new Vector3(
        Math.max(officeBounds.minX, Math.min(officeBounds.maxX, x)),
        0.6,
        Math.max(officeBounds.minZ, Math.min(officeBounds.maxZ, z))
      );
      if (isPositionFree(newTarget)) {
        setTargetPos(newTarget);
      }
    }
  });

  return (
    <group ref={groupRef} scale={3}>
      <VoxelAvatar
        agent={agent}
        position={[0, 0, 0]}
        isWorking={safeState.status === 'working'}
        isThinking={safeState.status === 'thinking'}
        isError={safeState.status === 'error'}
      />
      {/* Name above the avatar's head */}
      <Text
        position={[0, 1.05, 0]}
        fontSize={0.12}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {agent.emoji} {agent.name}
      </Text>
    </group>
  );
}
