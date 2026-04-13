import { Plugin, PointElement } from 'chart.js';

export interface SelectedPointLabelPluginOptions {
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  datasetIndex?: number;
  display?: boolean;
  font?: {
    family?: string;
    size?: number;
    weight?: string | number;
  };
  offset?: number;
  paddingX?: number;
  paddingY?: number;
  pointIndex?: number;
  text?: string | string[];
  textColor?: string;
}

export const selectedPointLabelPlugin: Plugin = {
  id: 'selectedPointLabel',
  afterDatasetsDraw(chart, _args, rawOptions) {
    if (!chart.chartArea) {
      return;
    }

    const options = rawOptions as SelectedPointLabelPluginOptions | undefined;
    if (!options?.display) {
      return;
    }

    const datasetIndex = options.datasetIndex ?? 0;
    const pointIndex = options.pointIndex ?? 0;
    const lines = Array.isArray(options.text)
      ? options.text.filter((line): line is string => Boolean(line))
      : options.text
        ? [options.text]
        : [];

    if (!lines.length) {
      return;
    }

    const meta = chart.getDatasetMeta(datasetIndex);
    const point = meta.data?.[pointIndex] as PointElement | undefined;
    if (!point) {
      return;
    }

    const pointPosition = typeof point.getProps === 'function'
      ? point.getProps(['x', 'y'], true)
      : { x: point.x, y: point.y };

    const pointX = Number(pointPosition.x ?? point.x ?? 0);
    const pointY = Number(pointPosition.y ?? point.y ?? 0);
    const { left, right, top, bottom } = chart.chartArea;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const xDirection = pointX >= centerX ? -1 : 1;
    const yDirection = pointY >= centerY ? -1 : 1;
    const offset = options.offset ?? 12;
    const paddingX = options.paddingX ?? 8;
    const paddingY = options.paddingY ?? 5;
    const borderRadius = options.borderRadius ?? 6;
    const borderWidth = options.borderWidth ?? 0;
    const fontSize = options.font?.size ?? 11;
    const fontWeight = options.font?.weight ?? 600;
    const fontFamily = options.font?.family ?? "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
    const lineHeight = fontSize * 1.2;

    const { ctx } = chart;
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    const textWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, ctx.measureText(line).width), 0);
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = lines.length * lineHeight + paddingY * 2;

    let boxX = pointX + xDirection * offset + (xDirection < 0 ? -boxWidth : 0);
    let boxY = pointY + yDirection * offset + (yDirection < 0 ? -boxHeight : 0);

    boxX = Math.min(Math.max(boxX, left + 4), right - boxWidth - 4);
    boxY = Math.min(Math.max(boxY, top + 4), bottom - boxHeight - 4);

    ctx.fillStyle = options.backgroundColor ?? '#ffffff';
    ctx.strokeStyle = options.borderColor ?? options.backgroundColor ?? '#ffffff';
    ctx.lineWidth = borderWidth;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, borderRadius);
    ctx.fill();
    if (borderWidth > 0) {
      ctx.stroke();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = options.textColor ?? '#000000';
    ctx.textBaseline = 'middle';

    lines.forEach((line, index) => {
      const textY = boxY + paddingY + lineHeight * index + lineHeight / 2;
      ctx.fillText(line, boxX + paddingX, textY);
    });

    ctx.restore();
  },
  defaults: {
    display: false
  }
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}
