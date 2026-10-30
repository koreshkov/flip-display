import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { MathUtils, Path, PerspectiveCamera, Shape } from "three";
import type { ExtrudeGeometryOptions } from "three";
import {
  getSegmentCenter,
  getVisibleSize,
  segmentDepth,
  segmentHeight,
  segmentWidth,
} from "~/display/layout";

const thickness = 0.05;
const bevelSize = 0.04;
const bevelThickness = 0.04;
// The holes keep their nominal size from the back of the board up to this z;
// in front of it the bevel widens them. The front face is at z = 0.
export const holeEdgeZ = -bevelThickness;
// Extra board beyond the viewport edges, so no gaps show while resizing.
const buffer = 1;
// Approximate seconds for the camera to settle after the grid changes.
const cameraSmoothTime = 0.4;

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

  const { width, height } = getVisibleSize(rows, columns);

  // Viewport size at the board's front face once the visible area fits it.
  const viewportHeight = Math.max(height, width / aspect);

  // While the camera moves between two grid sizes, the board must cover the
  // larger of the two views, otherwise its outer edges slide into sight.
  const [coverHeight, setCoverHeight] = useState(viewportHeight);
  const cameraZ = useRef(0);
  const animating = useRef(false);
  const grid = useRef({ rows, columns });

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const halfFov = MathUtils.degToRad(camera.fov / 2);
    cameraZ.current = viewportHeight / 2 / Math.tan(halfFov);

    const gridChanged =
      grid.current.rows !== rows || grid.current.columns !== columns;
    grid.current = { rows, columns };

    // Animate grid changes; snap on mount and resize.
    if (gridChanged) {
      animating.current = true;
      setCoverHeight((current) => Math.max(current, viewportHeight));
    } else {
      animating.current = false;
      camera.position.set(0, 0, cameraZ.current);
      setCoverHeight(viewportHeight);
    }
  }, [camera, rows, columns, viewportHeight]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    const moving = easing.damp(
      camera.position,
      "z",
      cameraZ.current,
      cameraSmoothTime,
      delta,
    );
    if (!moving) {
      animating.current = false;
      setCoverHeight(viewportHeight);
    }
  });

  const shape = useMemo(() => {
    const outerX = (coverHeight * aspect) / 2 + buffer;
    const outerY = coverHeight / 2 + buffer;

    const board = new Shape()
      .moveTo(-outerX, -outerY)
      .lineTo(outerX, -outerY)
      .lineTo(outerX, outerY)
      .lineTo(-outerX, outerY)
      .closePath();

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const [centerX, centerY] = getSegmentCenter(row, column, rows, columns);
        const x = centerX - segmentWidth / 2;
        const y = centerY + segmentHeight / 2;
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
  }, [rows, columns, coverHeight, aspect]);

  return (
    <>
      <mesh position-z={-(thickness + bevelThickness)}>
        <extrudeGeometry args={[shape, extrudeOptions]} />
        <meshPhysicalMaterial
          color="#1a1a1a"
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      {/* Dark cavity behind the holes, seen around the recessed segments. */}
      <mesh position-z={-segmentDepth - 0.05}>
        <planeGeometry
          args={[coverHeight * aspect + 2 * buffer, coverHeight + 2 * buffer]}
        />
        <meshBasicMaterial color="#050505" />
      </mesh>
    </>
  );
}
