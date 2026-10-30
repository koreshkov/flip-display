import { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { MathUtils, Path, PerspectiveCamera, Shape } from "three";
import type { ExtrudeGeometryOptions } from "three";

const segmentWidth = 0.6;
const segmentHeight = 0.9;
const horizontalSpacing = 0.1;
const verticalSpacing = 0.3;
const padding = 0.6;
const thickness = 0.05;
const bevelSize = 0.04;
const bevelThickness = 0.04;
// Extra board beyond the viewport edges, so no gaps show while resizing.
const buffer = 1;

// Negative offset keeps the bevel inside the nominal outline, so the holes
// widen towards the front and the chamfer faces the viewer.
const extrudeOptions: ExtrudeGeometryOptions = {
  depth: thickness,
  bevelEnabled: true,
  bevelSize,
  bevelThickness,
  bevelOffset: -bevelSize,
  bevelSegments: 4,
};

type BoardProps = {
  rows?: number;
  columns?: number;
};

export function Board({ rows = 5, columns = 12 }: BoardProps) {
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) =>
    state.size.height ? state.size.width / state.size.height : 1,
  );

  // The segments plus padding is the area that must always stay visible.
  const width =
    columns * segmentWidth + (columns - 1) * horizontalSpacing + 2 * padding;
  const height =
    rows * segmentHeight + (rows - 1) * verticalSpacing + 2 * padding;

  // Viewport size at the board's front face once the visible area fits it.
  const viewportHeight = Math.max(height, width / aspect);
  const viewportWidth = viewportHeight * aspect;

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const halfFov = MathUtils.degToRad(camera.fov / 2);
    camera.position.set(0, 0, viewportHeight / 2 / Math.tan(halfFov));
  }, [camera, viewportHeight]);

  const shape = useMemo(() => {
    const left = -width / 2;
    const top = height / 2;
    const outerX = viewportWidth / 2 + buffer;
    const outerY = viewportHeight / 2 + buffer;

    const board = new Shape()
      .moveTo(-outerX, -outerY)
      .lineTo(outerX, -outerY)
      .lineTo(outerX, outerY)
      .lineTo(-outerX, outerY)
      .closePath();

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = left + padding + column * (segmentWidth + horizontalSpacing);
        const y = top - padding - row * (segmentHeight + verticalSpacing);
        board.holes.push(
          new Path()
            .moveTo(x, y)
            .lineTo(x + segmentWidth, y)
            .lineTo(x + segmentWidth, y - segmentHeight)
            .lineTo(x, y - segmentHeight)
            .closePath(),
        );
      }
    }

    return board;
  }, [rows, columns, width, height, viewportWidth, viewportHeight]);

  return (
    <mesh position-z={-(thickness + bevelThickness)}>
      <extrudeGeometry args={[shape, extrudeOptions]} />
      <meshPhysicalMaterial
        color="#1a1a1a"
        roughness={0.2}
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
}
