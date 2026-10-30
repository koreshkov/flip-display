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
const hingeGap = 0.026;
// The pins the flaps turn on stick out into the margin at both sides.
const pinRadius = 0.01;
const pinColor = "#55534f";
// Metal shines more than the satin flaps.
const pinSpecular = 8;
const edgeColor = "#0c0c0c";
// Clearance between the flaps and the hole, showing the housing around them.
const flapMargin = 0.03;
const cornerRadius = 0.035;
const housingColor = "#0e0e0e";
// The flaps hanging behind the bottom one peek out below it, each layer a
// little lower and further back.
const stackCount = 0;
const stackStep = 0.012;
const stackSpacing = 0.006;
const stackShade = 0.12;
// No two segments are assembled alike: each sits slightly off its nominal
// place, and every flap is printed a little off and differs in shade.
const positionJitter = 0.004;
const rotationJitter = 0.005;
const printJitter = 0.012;
const shadeJitter = 0.12;
// Worn print: blotchy ink and a few thin scratches through it on each flap.
const inkGrain = 0.18;
const scratchStrength = 0.55;
// Width of the soft edge of the shadow the board casts into each hole.
const shadowPenumbra = 0.08;
// Share of the direct light the board's shadow blocks; fill light and light
// bouncing off the board still reach into it.
const shadowStrength = 0.5;
// Ambient light left at the edges of a hole, recessed behind the board.
const edgeOcclusion = 0.8;
// Satin finish: a broad, faint highlight that glints as the flaps fall.
const shininess = 64;
const specularStrength = 0.025;

// Each segment is built from three solid flaps, told apart by `part`:
// 0 - the upright top flap, showing the next character
// 1 - the hanging bottom flap, showing the current character
// 2 - the falling flap: current character's top half on its front, next
//     character's bottom half on its back. It sits in front of the other
//     two and rotates about the hinge line, landing exactly over flap 1.
// 3 - the housing plate behind the flaps, seen around them.
// 4 - the hinge pins at both sides.
// 5 - the stack of flaps behind the bottom flap; `layer` counts back from 1.
// `face` tells the printed front (0) and back (1) from the bare edges (2).
const vertexShader = /* glsl */ `
  #include <common>

  attribute float part;
  attribute float face;
  attribute float layer;
  attribute vec2 chars;
  attribute float progress;
  attribute float seed;

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
  varying vec3 vPosition;
  varying float vLayer;
  varying float vSeed;

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

    if (part > 1.5 && part < 2.5) {
      float c = cos(vAngle);
      float s = sin(vAngle);
      mat2 rotation = mat2(c, s, -s, c);
      transformed.z -= hingeZ;
      transformed.yz = rotation * transformed.yz;
      transformed.z += hingeZ;
      normalDirection.yz = rotation * normalDirection.yz;
    }

    vUv = uv;
    vPosition = position;
    vLocal = transformed;
    vNormal = normalDirection;
    vPart = part;
    vFace = face;
    vLayer = layer;
    vSeed = seed;
    vChars = chars;
    vec4 world = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>

  uniform sampler2D atlas;
  uniform vec2 atlasGrid;
  uniform vec3 edgeColor;
  uniform vec3 lightDirection;
  uniform vec2 holeSize;
  uniform float holeZ;
  uniform float shadowPenumbra;
  uniform float shadowStrength;
  uniform float edgeOcclusion;
  uniform float shininess;
  uniform float specularStrength;
  uniform vec2 flapSize;
  uniform float cornerRadius;
  uniform vec3 housingColor;
  uniform vec3 pinColor;
  uniform float pinSpecular;
  uniform float stackStep;
  uniform float stackShade;
  uniform float printJitter;
  uniform float shadeJitter;
  uniform float inkGrain;
  uniform float scratchStrength;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vPart;
  varying float vFace;
  varying vec2 vChars;
  varying float vAngle;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vPosition;
  varying float vLayer;
  varying float vSeed;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  float valueNoise(vec2 p, float seed) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(vec3(i, seed)), hash(vec3(i + vec2(1.0, 0.0), seed)), f.x),
      mix(hash(vec3(i + vec2(0.0, 1.0), seed)), hash(vec3(i + 1.0, seed)), f.x),
      f.y
    );
  }

  // Up to four thin straight scratches per flap, tapered at both ends.
  // p is in cell units with square aspect.
  float scratches(vec2 p, vec3 flap) {
    float amount = 0.0;
    for (int i = 0; i < 4; i++) {
      vec3 key = flap + 10.0 + float(i) * 7.0;
      if (hash(key) < 0.45) continue;
      vec2 start = vec2(hash(key + 1.0) * 0.67, hash(key + 2.0));
      float angle = hash(key + 3.0) * PI;
      float len = mix(0.05, 0.3, hash(key + 4.0));
      vec2 direction = vec2(cos(angle), sin(angle));
      float along = clamp(dot(p - start, direction), 0.0, len);
      float offset = length(p - start - direction * along);
      float width = mix(0.001, 0.0025, hash(key + 5.0)) * sin(PI * along / len);
      amount = max(
        amount, 1.0 - smoothstep(width, width + fwidth(offset), offset)
      );
    }
    return amount;
  }

  // Distance inside the hole outline, negative outside of it.
  float insideHole(vec2 p) {
    vec2 inside = holeSize / 2.0 - abs(p);
    return min(inside.x, inside.y);
  }

  // Signed distance to a rectangle with rounded corners, centred at 0.
  float roundedRect(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  vec3 atlasColor(float index, vec2 uv) {
    index = floor(index + 0.5);
    vec2 cell = vec2(mod(index, atlasGrid.x), floor(index / atlasGrid.x));
    return texture2D(atlas, vec2(
      (cell.x + uv.x) / atlasGrid.x,
      1.0 - (cell.y + 1.0 - uv.y) / atlasGrid.y
    )).rgb;
  }

  void main() {
    // Round the flaps' outer corners, measured before the flap rotates.
    // Stacked flaps reach lower, which moves their bottom corners down.
    vec2 extension = vec2(0.0, vLayer * stackStep / 2.0);
    if ((vPart < 2.5 || vPart > 4.5) && roundedRect(
      vPosition.xy + extension, flapSize / 2.0 + extension, cornerRadius
    ) > 0.0) {
      discard;
    }

    vec3 color = edgeColor;

    if (vPart > 4.5) {
      // Only the blank bottom edges of the stack show: each in the shadow
      // of the flap in front at the top, catching light at its edge.
      if (vFace < 1.5) {
        float bottom = -flapSize.y / 2.0 - vLayer * stackStep;
        float shown = clamp((vPosition.y - bottom) / stackStep, 0.0, 1.0);
        color = atlasColor(0.0, vec2(0.5, 0.1)) * mix(2.5, 0.3, shown);
      }
    } else if (vPart > 3.5) {
      color = pinColor;
    } else if (vPart > 2.5) {
      color = housingColor;
    } else if (vFace < 1.5) {
      vec2 uv = vUv;
      float index = vPart < 0.5 ? vChars.y : vChars.x;
      if (vPart > 1.5 && vFace > 0.5) {
        // The back of the falling flap ends up upside down at the bottom.
        index = vChars.y;
        uv.y = 1.0 - uv.y;
      }
      // Every flap is its own print: one character's half on one segment.
      vec3 flap = vec3(vSeed, floor(index + 0.5), step(0.5, uv.y));
      vec2 misprint = vec2(hash(flap), hash(flap + 1.0)) - 0.5;
      color = atlasColor(index, uv + misprint * printJitter) *
        (1.0 + (hash(flap + 2.0) - 0.5) * shadeJitter);

      // Wear shows on the light ink only, the dark flap hides it.
      vec2 cellPoint = uv * vec2(2.0 / 3.0, 1.0);
      float ink = smoothstep(0.05, 0.4, color.g);
      float grain = 0.6 * valueNoise(cellPoint * 40.0, flap.x + flap.y) +
        0.4 * valueNoise(cellPoint * 160.0, flap.x - flap.y);
      color *= 1.0 - ink * inkGrain * grain;
      color = mix(
        color,
        atlasColor(0.0, vec2(0.5, 0.1)),
        ink * scratchStrength * scratches(cellPoint, flap)
      );
    }

    // Follow the ray towards the light up to the board: if it leaves
    // through the hole, the point is lit, otherwise the board shades it.
    vec3 towardsBoard = vLocal +
      lightDirection * (holeZ - vLocal.z) / lightDirection.z;
    float shadow = 1.0 - shadowStrength * smoothstep(
      shadowPenumbra, -shadowPenumbra, insideHole(towardsBoard.xy)
    );
    // Less ambient light reaches the hole edges, deep behind the board.
    float occlusion = mix(
      edgeOcclusion, 1.0, smoothstep(0.0, 0.12, insideHole(vLocal.xy))
    );

    vec3 normal = normalize(vNormal);
    float facing = dot(normal, lightDirection);
    float diffuse = max(facing, 0.0);
    float light = 0.3 * occlusion + 0.75 * diffuse * shadow;
    light *= 1.0 - stackShade * vLayer;

    // Faces turned away from the light get no highlight.
    vec3 halfway = normalize(lightDirection + normalize(cameraPosition - vWorld));
    float specular = specularStrength * shadow * step(0.0, facing) *
      pow(max(dot(normal, halfway), 0.0), shininess);
    if (vPart > 3.5) specular *= pinSpecular;

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
    layers: number[];
    indices: number[];
  },
  [x0, x1, y0, y1, z0, z1]: number[],
  part: number,
  layer = 0,
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
      target.layers.push(layer);
    }
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// Repeatable pseudo-random number in [0, 1) for a segment, so the board looks
// the same after every resize or remount.
function random(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createSegmentGeometry(count: number) {
  const x = segmentWidth / 2 - flapMargin;
  const top = segmentHeight / 2 - flapMargin;
  const gap = hingeGap / 2;
  const t = flapThickness;
  const data = {
    positions: [],
    normals: [],
    uvs: [],
    parts: [],
    faces: [],
    layers: [],
    indices: [],
  };

  // The falling flap's front face is at z = 0, the still flaps sit right
  // behind it. Rotating about its own mid-thickness keeps it on that layer.
  addBox(data, [-x, x, gap, top, -2 * t, -t], 0);
  addBox(data, [-x, x, -top, -gap, -2 * t, -t], 1);
  addBox(data, [-x, x, gap, top, -t, 0], 2);
  for (let layer = 1; layer <= stackCount; layer++) {
    const front = -2 * t - (layer - 1) * stackSpacing - 0.001;
    addBox(
      data,
      [-x, x, -top - layer * stackStep, -gap, front - stackSpacing / 2, front],
      5,
      layer,
    );
  }
  const housingFront = -2 * t - stackCount * stackSpacing - 0.005;
  addBox(
    data,
    [
      -segmentWidth / 2,
      segmentWidth / 2,
      -segmentHeight / 2,
      segmentHeight / 2,
      housingFront - 0.01,
      housingFront,
    ],
    3,
  );
  // Centred on the falling flap's hinge axis, z = -t / 2.
  for (const side of [-1, 1]) {
    const [x0, x1] = [side * x, side * (segmentWidth / 2 - 0.005)].sort(
      (a, b) => a - b,
    );
    addBox(
      data,
      [x0, x1, -pinRadius, pinRadius, -t / 2 - pinRadius, -t / 2 + pinRadius],
      4,
    );
  }

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
  geometry.setAttribute("layer", new Float32BufferAttribute(data.layers, 1));
  geometry.setAttribute(
    "chars",
    new InstancedBufferAttribute(new Float32Array(count * 2), 2).setUsage(
      DynamicDrawUsage,
    ),
  );
  geometry.setAttribute(
    "seed",
    new InstancedBufferAttribute(
      Float32Array.from({ length: count }, (_, i) => random(i, 0)),
      1,
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
  // CSS color of the characters.
  letterColor: string;
  // Called once every flap has landed after `lines` changed, and once the
  // board is at rest after this callback itself changes.
  onSettled?: () => void;
  // Called each frame in which flaps hit the stop, e.g. to play the clack.
  onFlapsLanded?: (count: number, delta: number) => void;
  // Position of the scene's directional light, which lights the flaps.
  lightPosition: [x: number, y: number, z: number];
};

export function Segments({
  rows,
  columns,
  lines,
  charset,
  letterColor,
  onSettled,
  onFlapsLanded,
  lightPosition,
}: SegmentsProps) {
  const count = rows * columns;
  const mesh = useRef<InstancedMesh>(null);
  const atlas = useCharacterAtlas(charset, letterColor);
  const settled = useRef(false);
  const onSettledRef = useRef(onSettled);
  useLayoutEffect(() => {
    onSettledRef.current = onSettled;
    settled.current = false;
  }, [onSettled]);
  const onFlapsLandedRef = useRef(onFlapsLanded);
  useLayoutEffect(() => {
    onFlapsLandedRef.current = onFlapsLanded;
  }, [onFlapsLanded]);

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
          shadowStrength: { value: shadowStrength },
          edgeOcclusion: { value: edgeOcclusion },
          shininess: { value: shininess },
          specularStrength: { value: specularStrength },
          flapSize: {
            value: new Vector2(
              segmentWidth - 2 * flapMargin,
              segmentHeight - 2 * flapMargin,
            ),
          },
          cornerRadius: { value: cornerRadius },
          housingColor: { value: new Color(housingColor) },
          pinColor: { value: new Color(pinColor) },
          pinSpecular: { value: pinSpecular },
          stackStep: { value: stackStep },
          stackShade: { value: stackShade },
          printJitter: { value: printJitter },
          shadeJitter: { value: shadeJitter },
          inkGrain: { value: inkGrain },
          scratchStrength: { value: scratchStrength },
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
    settled.current = false;
  }, [segments, lines, charset, rows, columns]);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new Matrix4();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const i = row * columns + column;
        const [x, y] = getSegmentCenter(row, column, rows, columns);
        const jitter = (salt: number) => random(i, salt) * 2 - 1;
        matrix
          .makeRotationZ(jitter(1) * rotationJitter)
          .setPosition(
            x + jitter(2) * positionJitter,
            y + jitter(3) * positionJitter,
            -segmentDepth,
          );
        mesh.current.setMatrixAt(i, matrix);
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [rows, columns, atlas]);

  useFrame((_, delta) => {
    // Hold the flaps until they can be seen.
    if (!atlas) return;
    const { current, target, progress, duration } = segments;
    const chars = geometry.getAttribute("chars") as InstancedBufferAttribute;
    const progressAttribute = geometry.getAttribute(
      "progress",
    ) as InstancedBufferAttribute;
    let changed = false;
    let landed = 0;

    for (let i = 0; i < count; i++) {
      if (current[i] === target[i] && progress[i] === 0) continue;

      // Flip through the drum in order until the target comes up. The flap
      // that reveals the target also settles before the segment rests.
      // A flap lands when its progress passes 1, before any settling.
      let from = progress[i];
      progress[i] += delta / duration[i];
      for (;;) {
        const next = (current[i] + 1) % charset.length;
        const end = next === target[i] ? 1 + settleLength : 1;
        if (from < 1 && progress[i] >= 1) landed++;
        if (progress[i] < end) break;
        current[i] = next;
        progress[i] = next === target[i] ? 0 : progress[i] - end;
        from = 0;
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

    if (landed > 0) onFlapsLandedRef.current?.(landed, delta);
    if (changed) {
      chars.needsUpdate = true;
      progressAttribute.needsUpdate = true;
    } else if (!settled.current) {
      settled.current = true;
      onSettledRef.current?.();
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
