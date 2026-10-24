import { computeFarmLayout, findPlotAt, type FarmLayout } from "./layout";

export function attachPlotPointer(
  canvas: HTMLCanvasElement,
  plotCount: number,
  onPlotSelected: (plotId: number) => void
): () => void {
  const handlePointer = (event: PointerEvent): void => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }
    const x = ((event.clientX - bounds.left) / bounds.width) * bounds.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * bounds.height;
    const layout: FarmLayout = computeFarmLayout(bounds.width, bounds.height, plotCount);
    const rect = findPlotAt(layout, x, y);
    if (rect) {
      onPlotSelected(rect.id);
    }
  };

  canvas.addEventListener("pointerdown", handlePointer);
  return () => canvas.removeEventListener("pointerdown", handlePointer);
}
