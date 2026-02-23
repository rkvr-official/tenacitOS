'use client';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

interface FirstPersonControlsProps {
  moveSpeed?: number;
  obstacles?: Array<{ x: number; z: number; radius: number }>;
}

export default function FirstPersonControls({ moveSpeed = 5, obstacles = [] }: FirstPersonControlsProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = true;
          break;
        case 'Space':
          moveState.current.up = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.down = true;
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = false;
          break;
        case 'Space':
          moveState.current.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.down = false;
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!controlsRef.current?.isLocked) return;

    const speed = moveSpeed * delta;

    velocity.current.set(0, 0, 0);

    if (moveState.current.forward) velocity.current.z -= speed;
    if (moveState.current.backward) velocity.current.z += speed;
    if (moveState.current.left) velocity.current.x -= speed;
    if (moveState.current.right) velocity.current.x += speed;
    if (moveState.current.up) velocity.current.y += speed;
    if (moveState.current.down) velocity.current.y -= speed;

    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, camera.up).normalize();

    const movement = new THREE.Vector3();
    movement.addScaledVector(cameraDirection, -velocity.current.z);
    movement.addScaledVector(cameraRight, velocity.current.x);
    movement.y = velocity.current.y;

    const nextPosition = camera.position.clone().add(movement);

    nextPosition.x = Math.max(-9, Math.min(9, nextPosition.x));
    nextPosition.y = Math.max(1, Math.min(8, nextPosition.y));
    nextPosition.z = Math.max(-8, Math.min(8, nextPosition.z));

    const cameraRadius = 0.45;
    let blocked = false;
    for (const obstacle of obstacles) {
      const dx = nextPosition.x - obstacle.x;
      const dz = nextPosition.z - obstacle.z;
      const minDist = obstacle.radius + cameraRadius;
      if (dx * dx + dz * dz < minDist * minDist) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      camera.position.copy(nextPosition);
    }
  });

  return <PointerLockControls ref={controlsRef} />;
}
