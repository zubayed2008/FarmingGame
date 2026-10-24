import { PLOT_COLUMNS } from "../game/data";

export interface PlotRect {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FarmLayout {
  rects: PlotRect[];
  padding: number;
  gap: number;
}

export function computeFarmLayout(
  width: number,
  height: number,
  plotCount: number,
  columns = PLOT_COLUMNS
): FarmLayout {
  const padding = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  const gap = Math.max(6, Math.round(Math.min(width, height) * 0.03));
  const rows = Math.ceil(plotCount / columns);
  const cellWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const cellHeight = (height - padding * 2 - gap * (rows - 1)) / rows;

  const rects: PlotRect[] = Array.from({ length: plotCount }, (_, id) => {
    const column = id % columns;
    const row = Math.floor(id / columns);
    return {
      id,
      x: padding + column * (cellWidth + gap),
      y: padding + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight
    };
  });

  return { rects, padding, gap };
}

export function findPlotAt(layout: FarmLayout, x: number, y: number): PlotRect | null {
  return (
    layout.rects.find(
      (rect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
    ) ?? null
  );
}
