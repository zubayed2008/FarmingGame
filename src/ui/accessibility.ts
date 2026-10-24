import { getCropStage, getPlotLabel } from "../game/selectors";
import type { GameState } from "../game/types";
import { element, makeButton } from "./panels";

export function createLiveRegion(): HTMLParagraphElement {
  const region = element("p", "live-region");
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  return region;
}

export function createPlotControls(
  state: GameState,
  onPlotSelected: (plotId: number) => void
): HTMLUListElement {
  const list = element("ul", "plot-controls");
  list.setAttribute("aria-label", "Farm plots");

  for (const plot of state.plots) {
    const item = element("li");
    const label = getPlotLabel(plot);
    const stage = getCropStage(plot);
    const action = stage === "empty" ? "Plant" : stage === "dry" ? "Water" : stage === "ripe" ? "Harvest" : "Check";
    item.append(
      makeButton(`${action} · ${label}`, () => onPlotSelected(plot.id), {
        ariaLabel: `${action} ${label}`
      })
    );
    list.append(item);
  }

  return list;
}
