import { CROPS, PLOT_COUNT } from "../game/data";
import { getCropProgress, getCropRemainingMs, getCropStage, formatDuration } from "../game/selectors";
import type { CropSpecies, GameState } from "../game/types";
import { computeFarmLayout } from "./layout";

export interface FarmRenderer {
  resize: () => void;
  draw: (state: GameState, selectedSpecies: CropSpecies | null) => void;
}

export function createFarmRenderer(canvas: HTMLCanvasElement): FarmRenderer {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  let cssWidth = 0;
  let cssHeight = 0;

  const resize = (): void => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cssWidth = canvas.clientWidth;
    cssHeight = canvas.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) {
      return;
    }
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (state: GameState, selectedSpecies: CropSpecies | null): void => {
    if (canvas.clientWidth !== cssWidth || canvas.clientHeight !== cssHeight) {
      resize();
    }
    if (cssWidth === 0 || cssHeight === 0) {
      return;
    }

    context.clearRect(0, 0, cssWidth, cssHeight);
    const background = context.createLinearGradient(0, 0, 0, cssHeight);
    background.addColorStop(0, "#9fd88f");
    background.addColorStop(1, "#6fb767");
    context.fillStyle = background;
    context.fillRect(0, 0, cssWidth, cssHeight);

    const layout = computeFarmLayout(cssWidth, cssHeight, PLOT_COUNT);

    for (const rect of layout.rects) {
      const plot = state.plots.find((candidate) => candidate.id === rect.id);
      if (!plot) {
        continue;
      }
      const stage = getCropStage(plot);

      context.fillStyle = "#8a5a35";
      context.strokeStyle = stage === "ripe" ? "#ffd166" : "#6b4423";
      context.lineWidth = stage === "ripe" ? 4 : 2;
      context.beginPath();
      context.roundRect(rect.x, rect.y, rect.width, rect.height, 12);
      context.fill();
      context.stroke();

      context.fillStyle = "#5d3a1f";
      context.beginPath();
      context.roundRect(
        rect.x + 8,
        rect.y + 8,
        rect.width - 16,
        rect.height - 16,
        8
      );
      context.fill();

      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      if (plot.crop) {
        const config = CROPS[plot.crop.species];
        const progress = getCropProgress(plot);

        context.font = `${Math.round(Math.min(rect.width, rect.height) * 0.34)}px serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.globalAlpha = stage === "dry" ? 0.45 : 0.55 + progress * 0.45;
        context.fillText(stage === "ripe" ? config.emoji : progress > 0.5 ? "🌿" : "🌱", centerX, centerY - 4);
        context.globalAlpha = 1;

        if (stage === "ripe") {
          context.fillStyle = "#ffd166";
          context.font = "600 14px system-ui, sans-serif";
          context.fillText("READY", centerX, rect.y + rect.height - 14);
        } else if (stage === "growing") {
          context.fillStyle = "#f6f1e2";
          context.font = "600 13px system-ui, sans-serif";
          context.fillText(formatDuration(getCropRemainingMs(plot)), centerX, rect.y + rect.height - 14);
        } else {
          context.fillStyle = "#f6d7b0";
          context.font = "600 13px system-ui, sans-serif";
          context.fillText("Needs water", centerX, rect.y + rect.height - 14);
        }
      } else {
        context.fillStyle = "#d9b38c";
        context.font = "600 14px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(selectedSpecies ? `Plant ${CROPS[selectedSpecies].displayName}` : "Empty plot", centerX, centerY);
      }

      context.fillStyle = "rgb(255 255 255 / 65%)";
      context.font = "600 12px system-ui, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillText(`#${rect.id + 1}`, rect.x + 10, rect.y + 10);
    }
  };

  return { resize, draw };
}
