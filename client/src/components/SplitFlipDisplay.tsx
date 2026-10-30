import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Board } from "./Board";

export function SplitFlipDisplay() {
  return (
    <div className="fixed inset-0 bg-neutral-500">
      <Canvas>
        <color attach="background" args={["#737373"]} />
        {/* Board moves the camera along z to fit its visible area. */}
        <PerspectiveCamera makeDefault rotation={[0, 0, 0]} fov={20} />
        <ambientLight intensity={0.3} />
        {/* Grazing angle: the flat face reflects away from the camera, while
            the bevels tilt towards the light and bounce it back. */}
        <directionalLight position={[3, 3, 8]} intensity={3} />
        <Board />
      </Canvas>
    </div>
  );
}
