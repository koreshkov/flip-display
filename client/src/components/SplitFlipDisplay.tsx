import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Board } from "./Board";
import { ConfigModal } from "./ConfigModal";
import type { DisplayConfig } from "./ConfigModal";
import { Overlay } from "./Overlay";
import { Segments } from "./Segments";
import {
  allCharacterGroups,
  getCharset,
  layoutMessage,
} from "~/display/characters";

const lightPosition: [number, number, number] = [3, 3, 8];

export function SplitFlipDisplay() {
  const [config, setConfig] = useState<DisplayConfig>({
    rows: 5,
    columns: 12,
    message: "HELLO WORLD",
    characterGroups: allCharacterGroups,
  });
  const [configOpen, setConfigOpen] = useState(false);

  const charset = useMemo(
    () => getCharset(config.characterGroups),
    [config.characterGroups],
  );
  const lines = useMemo(
    () => layoutMessage(config.message, config.rows, config.columns).lines,
    [config.message, config.rows, config.columns],
  );

  return (
    <div className="fixed inset-0 bg-neutral-500">
      <Canvas>
        <color attach="background" args={["#737373"]} />
        {/* Board moves the camera along z to fit its visible area. */}
        <PerspectiveCamera makeDefault rotation={[0, 0, 0]} fov={20} />
        <ambientLight intensity={0.3} />
        {/* Grazing angle: the flat face reflects away from the camera, while
            the bevels tilt towards the light and bounce it back. */}
        <directionalLight position={lightPosition} intensity={3} />
        <Board rows={config.rows} columns={config.columns} />
        <Segments
          rows={config.rows}
          columns={config.columns}
          lines={lines}
          charset={charset}
          lightPosition={lightPosition}
        />
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
