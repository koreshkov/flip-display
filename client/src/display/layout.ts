export const segmentWidth = 0.6;
export const segmentHeight = 0.9;
export const horizontalSpacing = 0.1;
export const verticalSpacing = 0.3;
export const padding = 0.6;
// Segments sit this far behind the board face, so a flap swinging
// towards the viewer stays inside its hole.
export const segmentDepth = segmentHeight / 2 + 0.03;

// The segments plus padding: the area that must always stay visible.
export function getVisibleSize(rows: number, columns: number) {
  return {
    width:
      columns * segmentWidth + (columns - 1) * horizontalSpacing + 2 * padding,
    height: rows * segmentHeight + (rows - 1) * verticalSpacing + 2 * padding,
  };
}

export function getSegmentCenter(
  row: number,
  column: number,
  rows: number,
  columns: number,
): [x: number, y: number] {
  const { width, height } = getVisibleSize(rows, columns);
  return [
    -width / 2 +
      padding +
      column * (segmentWidth + horizontalSpacing) +
      segmentWidth / 2,
    height / 2 -
      padding -
      row * (segmentHeight + verticalSpacing) -
      segmentHeight / 2,
  ];
}
