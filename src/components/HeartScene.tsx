import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { Heart3D } from './Heart3D';
import { Suspense } from 'react';

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-gray-500">Loading 3D Model...</div>
    </div>
  );
}

export function HeartScene({ heartRate }: { heartRate: number }) {
  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <Environment preset="sunset" />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Suspense fallback={null}>
          <Heart3D heartRate={heartRate} />
        </Suspense>
        <OrbitControls 
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
          target={[0, 0, 0]}
          dampingFactor={0.1}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
          panSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}