import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { holeEdgeZ } from "./Board";
import { useCharacterAtlas } from "~/display/characterAtlas";
import {
  getSegmentCenter,
  segmentDepth,
  segmentHeight,
  segmentWidth,
} from "~/display/layout";

// Seconds for one flap to fall; each segment varies it a little.
const flipDuration = 0.1;
const flipDurationJitter = 0.15;
// The last flap before the target bounces on landing for this many flip
// durations.
const settleLength = 1.5;
// Radians the landing flap springs back up.
const bounceAngle = 0.12;
const flapThickness = 0.03;
// Space between the two halves around the hinge pin.
const hingeGap = 0.012;
const edgeColor = "#0c0c0c";
// Width of the soft edge of the shadow the board casts into each hole.
const shadowPenumbra = 0.05;
// Ambient light left at the edges of a hole, recessed behind the board.
const edgeOcclusion = 0.65;
// Satin finish: a broad, faint highlight that glints as the flaps fall.
const shininess = 64;
const specularStrength = 0.025;

// Each segment is built from three solid flaps, told apart by `part`:
// 0 - the upright top flap, showing the next character
// 1 - the hanging bottom flap, showing the current character
// 2 - the falling flap: current character's top half on its front, next
//     character's bottom half on its back. It sits in front of the other
//     two and rotates about the hinge line, landing exactly over flap 1.
// `face` tells the printed front (0) and back (1) from the bare edges (2).
const vertexShader = /* glsl */ `
  #include <common>

  attribute float part;
  attribute float face;
  attribute vec2 chars;
  attribute float progress;

  uniform float hingeZ;
  uniform float settleLength;
  uniform float bounceAngle;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vPart;
  varying float vFace;
  varying vec2 vChars;
  varying float vAngle;
  varying vec3 vLocal;
  varying vec3 vWorld;

  // Released from upright, the flap speeds up as it falls, then bounces
  // off the stop when it is the last one to drop.
  float flapAngle(float p) {
    if (p < 1.0) return PI * (0.35 * p + 0.65 * p * p);
    float u = clamp((p - 1.0) / settleLength, 0.0, 1.0);
    return PI - bounceAngle * abs(sin(2.0 * PI * u)) * (1.0 - u) * (1.0 - u);
  }

  void main() {
    vec3 transformed = position;
    vec3 normalDirection = normal;
    vAngle = flapAngle(progress);

    if (part > 1.5) {
      float c = cos(vAngle);
      float s = sin(vAngle);
      mat2 rotation = mat2(c, s, -s, c);
      transformed.z -= hingeZ;
      transformed.yz = rotation * transformed.yz;
      transformed.z += hingeZ;
      normalDirection.yz = rotation * normalDirection.yz;
    }

    vUv = uv;
    vLocal = transformed;
    vNormal = normalDirection;
    vPart = part;
    vFace = face;
    vChars = chars;
    vec4 world = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D atlas;
  uniform vec2 atlasGrid;
  uniform vec3 edgeColor;
  uniform vec3 lightDirection;
  uniform vec2 holeSize;
  uniform float holeZ;
  uniform float shadowPenumbra;
  uniform float edgeOcclusion;
  uniform float shininess;
  uniform float specularStrength;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vPart;
  varying float vFace;
  varying vec2 vChars;
  varying float vAngle;
  varying vec3 vLocal;
  varying vec3 vWorld;

  // Distance inside the hole outline, negative outside of it.
  float insideHole(vec2 p) {
    vec2 inside = holeSize / 2.0 - abs(p);
    return min(inside.x, inside.y);
  }

  void main() {
    vec3 color = edgeColor;

    if (vFace < 1.5) {
      vec2 uv = vUv;
      float index = vPart < 0.5 ? vChars.y : vChars.x;
      if (vPart > 1.5 && vFace > 0.5) {
        // The back of the falling flap ends up upside down at the bottom.
        index = vChars.y;
        uv.y = 1.0 - uv.y;
      }
      index = floor(index + 0.5);
      vec2 cell = vec2(mod(index, atlasGrid.x), floor(index / atlasGrid.x));
      color = texture2D(atlas, vec2(
        (cell.x + uv.x) / atlasGrid.x,
        1.0 - (cell.y + 1.0 - uv.y) / atlasGrid.y
      )).rgb;
    }

    // Follow the ray towards the light up to the board: if it leaves
    // through the hole, the point is lit, otherwise the board shades it.
    vec3 towardsBoard = vLocal +
      lightDirection * (holeZ - vLocal.z) / lightDirection.z;
    float shadow = smoothstep(
      -shadowPenumbra, shadowPenumbra, insideHole(towardsBoard.xy)
    );
    // Less ambient light reaches the hole edges, deep behind the board.
    float occlusion = mix(
      edgeOcclusion, 1.0, smoothstep(0.0, 0.12, insideHole(vLocal.xy))
    );

    vec3 normal = normalize(vNormal);
    float facing = dot(normal, lightDirection);
    float diffuse = max(facing, 0.0);
    float light = 0.3 * occlusion + 0.75 * diffuse * shadow;

    // Faces turned away from the light get no highlight.
    vec3 halfway = normalize(lightDirection + normalize(cameraPosition - vWorld));
    float specular = specularStrength * shadow * step(0.0, facing) *
      pow(max(dot(normal, halfway), 0.0), shininess);

    // The falling flap shades the still halves near the hinge, most when
    // it sticks straight out.
    if (vPart < 1.5) {
      float nearHinge = 1.0 - abs(vUv.y - 0.5) * 2.0;
      light *= 1.0 - 0.45 * sin(vAngle) * nearHinge * nearHinge;
    }

    gl_FragColor = vec4(color * light + specular, 1.0);
    #include <colorspace_fragment>
  }
`;

// Adds a closed box, one quad per side, wound counter-clockwise from outside.
function addBox(
  target: {
    positions: number[];
    normals: number[];
    uvs: number[];
    parts: number[];
    faces: number[];
    indices: number[];
  },
  [x0, x1, y0, y1, z0, z1]: number[],
  part: number,
) {
  const sides = [
    {
      face: 0,
      normal: [0, 0, 1],
      corners: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    },
    {
      face: 1,
      normal: [0, 0, -1],
      corners: [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
    },
    {
      face: 2,
      normal: [0, 1, 0],
      corners: [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
    },
    {
      face: 2,
      normal: [0, -1, 0],
      corners: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
    },
    {
      face: 2,
      normal: [1, 0, 0],
      corners: [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
    },
    {
      face: 2,
      normal: [-1, 0, 0],
      corners: [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
    },
  ];

  for (const { face, normal, corners } of sides) {
    const base = target.positions.length / 3;
    for (const [x, y, z] of corners) {
      target.positions.push(x, y, z);
      target.normals.push(...normal);
      // Character cell coordinates; v = 0.5 is the hinge line.
      target.uvs.push(x / segmentWidth + 0.5, y / segmentHeight + 0.5);
      target.parts.push(part);
      target.faces.push(face);
    }
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function createSegmentGeometry(count: number) {
  const x = segmentWidth / 2;
  const top = segmentHeight / 2;
  const gap = hingeGap / 2;
  const t = flapThickness;
  const data = {
    positions: [],
    normals: [],
    uvs: [],
    parts: [],
    faces: [],
    indices: [],
  };

  // The falling flap's front face is at z = 0, the still flaps sit right
  // behind it. Rotating about its own mid-thickness keeps it on that layer.
  addBox(data, [-x, x, gap, top, -2 * t, -t], 0);
  addBox(data, [-x, x, -top, -gap, -2 * t, -t], 1);
  addBox(data, [-x, x, gap, top, -t, 0], 2);

  const geometry = new BufferGeometry();
  geometry.setIndex(data.indices);
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(data.positions, 3),
  );
  geometry.setAttribute("normal", new Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(data.uvs, 2));
  geometry.setAttribute("part", new Float32BufferAttribute(data.parts, 1));
  geometry.setAttribute("face", new Float32BufferAttribute(data.faces, 1));
  geometry.setAttribute(
    "chars",
    new InstancedBufferAttribute(new Float32Array(count * 2), 2).setUsage(
      DynamicDrawUsage,
    ),
  );
  geometry.setAttribute(
    "progress",
    new InstancedBufferAttribute(new Float32Array(count), 1).setUsage(
      DynamicDrawUsage,
    ),
  );
  return geometry;
}

type SegmentsProps = {
  rows: number;
  columns: number;
  // One string per row, each `columns` long.
  lines: string[];
  // Characters on the drum, in flipping order; index 0 is the blank.
  charset: string;
  // Position of the scene's directional light, which lights the flaps.
  lightPosition: [x: number, y: number, z: number];
};

export function Segments({
  rows,
  columns,
  lines,
  charset,
  lightPosition,
}: SegmentsProps) {
  const count = rows * columns;
  const mesh = useRef<InstancedMesh>(null);
  const atlas = useCharacterAtlas(charset);

  const geometry = useMemo(() => createSegmentGeometry(count), [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        toneMapped: false,
        uniforms: {
          atlas: { value: null },
          atlasGrid: { value: new Vector2(1, 1) },
          edgeColor: { value: new Color(edgeColor) },
          lightDirection: { value: new Vector3(0, 0, 1) },
          hingeZ: { value: -flapThickness / 2 },
          settleLength: { value: settleLength },
          bounceAngle: { value: bounceAngle },
          holeSize: { value: new Vector2(segmentWidth, segmentHeight) },
          holeZ: { value: segmentDepth + holeEdgeZ },
          shadowPenumbra: { value: shadowPenumbra },
          edgeOcclusion: { value: edgeOcclusion },
          shininess: { value: shininess },
          specularStrength: { value: specularStrength },
        },
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    material.uniforms.lightDirection.value.set(...lightPosition).normalize();
  }, [material, lightPosition]);

  useLayoutEffect(() => {
    if (!atlas) return;
    material.uniforms.atlas.value = atlas;
    material.uniforms.atlasGrid.value = atlas.userData.grid;
  }, [material, atlas]);

  // Every segment starts blank whenever the grid or the drum changes.
  const segments = useMemo(
    () => ({
      current: new Uint8Array(count),
      target: new Uint8Array(count),
      progress: new Float32Array(count),
      duration: Float32Array.from(
        { length: count },
        () => flipDuration * (1 + (Math.random() * 2 - 1) * flipDurationJitter),
      ),
    }),
    [count, charset],
  );

  useLayoutEffect(() => {
    const chars = geometry.getAttribute("chars") as InstancedBufferAttribute;
    const progress = geometry.getAttribute(
      "progress",
    ) as InstancedBufferAttribute;
    (chars.array as Float32Array).fill(0);
    (progress.array as Float32Array).fill(0);
    chars.needsUpdate = true;
    progress.needsUpdate = true;
  }, [geometry, segments]);

  useLayoutEffect(() => {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const index = charset.indexOf(lines[row]?.[column] ?? " ");
        segments.target[row * columns + column] = Math.max(index, 0);
      }
    }
  }, [segments, lines, charset, rows, columns]);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new Matrix4();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const [x, y] = getSegmentCenter(row, column, rows, columns);
        matrix.makeTranslation(x, y, -segmentDepth);
        mesh.current.setMatrixAt(row * columns + column, matrix);
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [rows, columns, atlas]);

  useFrame((_, delta) => {
    const { current, target, progress, duration } = segments;
    const chars = geometry.getAttribute("chars") as InstancedBufferAttribute;
    const progressAttribute = geometry.getAttribute(
      "progress",
    ) as InstancedBufferAttribute;
    let changed = false;

    for (let i = 0; i < count; i++) {
      if (current[i] === target[i] && progress[i] === 0) continue;

      // Flip through the drum in order until the target comes up. The flap
      // that reveals the target also settles before the segment rests.
      progress[i] += delta / duration[i];
      for (;;) {
        const next = (current[i] + 1) % charset.length;
        const end = next === target[i] ? 1 + settleLength : 1;
        if (progress[i] < end) break;
        current[i] = next;
        progress[i] = next === target[i] ? 0 : progress[i] - end;
      }

      const resting = current[i] === target[i] && progress[i] === 0;
      chars.setXY(
        i,
        current[i],
        resting ? current[i] : (current[i] + 1) % charset.length,
      );
      progressAttribute.setX(i, progress[i]);
      changed = true;
    }

    if (changed) {
      chars.needsUpdate = true;
      progressAttribute.needsUpdate = true;
    }
  });

  if (!atlas) return null;

  return (
    <instancedMesh
      key={count}
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}
