import { useEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace, Vector2 } from "three";

export const atlasColumns = 8;
// Same 2:3 aspect as a segment.
const cellWidth = 128;
const cellHeight = 192;
const flapColor = "#161616";
const glyphColor = "#f1eee4";
const font = `700 ${cellHeight * 0.62}px "Roboto Condensed", "Arial Narrow", sans-serif`;

// One cell per character, in charset order, left to right and top to bottom.
function createAtlas(charset: string) {
  const rows = Math.ceil(charset.length / atlasColumns);
  const canvas = document.createElement("canvas");
  canvas.width = atlasColumns * cellWidth;
  canvas.height = rows * cellHeight;

  const context = canvas.getContext("2d")!;
  context.fillStyle = flapColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = glyphColor;
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  // Share one baseline so every glyph sits like on a real flap set.
  const capHeight = context.measureText("H").actualBoundingBoxAscent;
  [...charset].forEach((character, index) => {
    const x = (index % atlasColumns) * cellWidth;
    const y = Math.floor(index / atlasColumns) * cellHeight;
    context.fillText(
      character,
      x + cellWidth / 2,
      y + (cellHeight + capHeight) / 2,
    );
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.userData.grid = new Vector2(atlasColumns, rows);
  return texture;
}

export function useCharacterAtlas(charset: string) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: CanvasTexture | undefined;
    // Draw only once the font is ready, otherwise the fallback gets baked in.
    document.fonts
      .load(font)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        created = createAtlas(charset);
        setTexture(created);
      });
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [charset]);

  return texture;
}
