import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

export function SplitFlipDisplay() {
  return (
    <div className="fixed inset-0 bg-neutral-950">
      <Canvas>
        <PerspectiveCamera makeDefault position={[3, 3, 5]} fov={50} />
        <OrbitControls />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={2} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      </Canvas>
    </div>
  )
}
