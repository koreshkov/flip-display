import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Board } from "./Board";
import { ConfigModal } from "./ConfigModal";
import type { DisplayConfig } from "./ConfigModal";
import { Overlay } from "./Overlay";

export function SplitFlipDisplay() {
  const [config, setConfig] = useState<DisplayConfig>({
    rows: 5,
    columns: 12,
    message: "",
  });
  const [configOpen, setConfigOpen] = useState(false);

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
        <Board rows={config.rows} columns={config.columns} />
      </Canvas>
      <Overlay onOpenConfig={() => setConfigOpen(true)} />
      {configOpen && (
        <ConfigModal
          config={config}
          onSave={setConfig}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  );
}
