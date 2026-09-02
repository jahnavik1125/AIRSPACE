/**
 * AIRSPACE — Master Handwriting & Stroke Rendering Engine
 * Implements gap interpolation, double-exponential temporal smoothing,
 * velocity-adaptive ink dynamics, and expanded professional pen shaders.
 */

export interface StrokePoint {
  x: number;
  y: number;
  t: number;
  width?: number;
}

export type PenStyle =
  | "marker"
  | "brush"
  | "neon"
  | "highlighter"
  | "glow"
  | "precision"
  | "smooth";

export type PenEffect = "none" | "glow" | "neon" | "smooth" | "spark" | "flow";

export interface PenSettings {
  color: string;
  size: number;
  opacity: number;
  style: PenStyle;
  effect?: PenEffect;
}

export class StrokeFilter {
  private prevSmoothed: StrokePoint | null = null;
  private prevRaw: StrokePoint | null = null;

  reset() {
    this.prevSmoothed = null;
    this.prevRaw = null;
  }

  filter(rawX: number, rawY: number, time: number, baseWidth: number): StrokePoint[] {
    if (!this.prevSmoothed || !this.prevRaw) {
      const initial: StrokePoint = { x: rawX, y: rawY, t: time, width: baseWidth };
      this.prevSmoothed = initial;
      this.prevRaw = initial;
      return [initial];
    }

    const dist = Math.hypot(rawX - this.prevSmoothed.x, rawY - this.prevSmoothed.y);
    const dt = Math.max(1, time - this.prevSmoothed.t);

    // Adaptive alpha: higher responsiveness for fast motion, strong stabilization for deliberate writing
    const velocity = dist / dt; // px/ms
    const alpha = Math.min(0.82, Math.max(0.60, 0.60 + velocity * 0.12));

    const smoothX = alpha * rawX + (1 - alpha) * this.prevSmoothed.x;
    const smoothY = alpha * rawY + (1 - alpha) * this.prevSmoothed.y;

    // Velocity-aware thickness tapering (natural ink deposition)
    const velocityFactor = Math.max(0.65, Math.min(1.4, 1.25 - velocity * 0.18));
    const width = baseWidth * velocityFactor;

    const resultPoints: StrokePoint[] = [];

    // GAP INTERPOLATION: If tracking jumped or dropped a frame (e.g. fast stroke > 25px),
    // interpolate intermediate points to prevent straight-line artifacts and jagged corners
    if (dist > 28) {
      const steps = Math.min(4, Math.floor(dist / 14));
      for (let s = 1; s <= steps; s++) {
        const ratio = s / (steps + 1);
        resultPoints.push({
          x: this.prevSmoothed.x + (smoothX - this.prevSmoothed.x) * ratio,
          y: this.prevSmoothed.y + (smoothY - this.prevSmoothed.y) * ratio,
          t: this.prevSmoothed.t + dt * ratio,
          width: this.prevSmoothed.width! + (width - this.prevSmoothed.width!) * ratio
        });
      }
    }

    const currentPoint: StrokePoint = {
      x: smoothX,
      y: smoothY,
      t: time,
      width
    };

    resultPoints.push(currentPoint);
    this.prevSmoothed = currentPoint;
    this.prevRaw = { x: rawX, y: rawY, t: time };

    return resultPoints;
  }
}

/**
 * Render smooth continuous stroke using spline interpolation and specified pen style
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  settings: PenSettings,
  isLive: boolean = false
) {
  if (!points || points.length < 2) return;

  const { color, size, opacity, style, effect = "none" } = settings;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1. NEON INK: Bright saturated laser aura + solid white core
  if (style === "neon" || effect === "neon") {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 2.2;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2.8;
    drawSplinePath(ctx, points);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, size * 0.4);
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 1.4;
    drawSplinePath(ctx, points);
    ctx.stroke();
  }
  // 2. GLOW PEN: Soft ambient volumetric light
  else if (style === "glow" || effect === "glow") {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 1.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2.5;
    drawSplinePath(ctx, points);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.shadowBlur = size * 0.5;
    drawSplinePath(ctx, points);
    ctx.stroke();
  }
  // 3. HIGHLIGHTER: Semi-transparent wide rectangular ribbon
  else if (style === "highlighter") {
    ctx.globalAlpha = Math.min(opacity, 0.45);
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 2.2;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    drawSplinePath(ctx, points);
    ctx.stroke();
  }
  // 4. BRUSH / FLOW: Dynamic velocity-tapered brush strokes
  else if (style === "brush" || effect === "flow") {
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const segmentWidth = Math.max(2, p2.width || size);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = segmentWidth;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.8;
      ctx.stroke();
    }
  }
  // 5. PRECISION PEN: Clean razor line
  else if (style === "precision") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.6);
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    drawSplinePath(ctx, points);
    ctx.stroke();
  }
  // 6. MARKER / SMOOTH (DEFAULT): Rich anti-aliased marker handwriting with soft edge
  else {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.shadowColor = color;
    ctx.shadowBlur = isLive ? size * 2.0 : size * 1.0;
    drawSplinePath(ctx, points);
    ctx.stroke();
  }

  // Sparkle accents if spark effect active
  if (effect === "spark") {
    for (let i = 0; i < points.length; i += 6) {
      const pt = points[i];
      ctx.beginPath();
      ctx.arc(pt.x + (Math.sin(i) * size * 0.5), pt.y + (Math.cos(i) * size * 0.5), 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draw smooth quadratic bezier path through midpoints
 */
function drawSplinePath(ctx: CanvasRenderingContext2D, points: StrokePoint[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
}
