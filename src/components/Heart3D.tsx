import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function HeartModel({ heartRate }: { heartRate: number }) {
  const heartRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/heart.glb');
  const beatScale = useRef(1);
  const lastBeat = useRef(0);

  useFrame((state, delta) => {
    if (!heartRef.current) return;

    // Calculate beat interval based on heart rate (beats per minute)
    const beatInterval = 60 / heartRate; // seconds per beat
    const time = state.clock.getElapsedTime();

    // Check if it's time for a new beat
    if (time - lastBeat.current >= beatInterval) {
      beatScale.current = 1.2; // Expand
      lastBeat.current = time;
    }

    // Smoothly return to normal size
    beatScale.current = THREE.MathUtils.lerp(beatScale.current, 1, delta * 4);

    // Apply the scale
    heartRef.current.scale.setScalar(beatScale.current);

    // Gentle rotation
    heartRef.current.rotation.y += delta * 0.5;
  });

  return (
    <group ref={heartRef} dispose={null}>
      <primitive 
        object={scene} 
        scale={[0.01, 0.01, 0.01]}
        material={new THREE.MeshStandardMaterial({
          color: '#ff4444',
          roughness: 0.3,
          metalness: 0.7,
        })}
      />
    </group>
  );
}

export function Heart3D({ heartRate }: { heartRate: number }) {
  return (
    <Suspense fallback={null}>
      <HeartModel heartRate={heartRate} />
    </Suspense>
  );
}