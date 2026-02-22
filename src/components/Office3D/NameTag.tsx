'use client';

import { Billboard, Text } from '@react-three/drei';

interface NameTagProps {
  text: string;
  /** Offset in local avatar space (meters) */
  offset?: [number, number, number];
  fontSize?: number;
}

export default function NameTag({
  text,
  offset = [0, 1.2, 0],
  fontSize = 0.18,
}: NameTagProps) {
  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false} position={offset}>
      <Text
        fontSize={fontSize}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {text}
      </Text>
    </Billboard>
  );
}
