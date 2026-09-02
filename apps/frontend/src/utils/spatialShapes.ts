/**
 * AIRSPACE — Spatial Fingertip Vertices & Geometric Engine
 * Fingertips are vertices (small glowing dots).
 * Edges start and end strictly at fingertip vertices.
 * Live spatial preview follows fingers and dissolves naturally when fingers part.
 */

export interface FingertipPoint {
  id: string;
  name: "Thumb" | "Index" | "Middle" | "Ring" | "Pinky";
  handIdx: number;
  handedness: string;
  x: number;
  y: number;
  z: number;
  color: string;
  glow: string;
}

export interface ConfirmedShape {
  id: string;
  type: "line" | "triangle" | "quadrilateral" | "polygon" | "circle";
  points: { x: number; y: number }[];
  color: string;
  width: number;
  createdAt: number;
}

export const FINGERTIP_CONFIG = [
  { id: "thumb", tipIdx: 4, pipIdx: 2, mcpIdx: 1, name: "Thumb", color: "#ec4899", glow: "rgba(236, 72, 153, 0.9)" },
  { id: "index", tipIdx: 8, pipIdx: 6, mcpIdx: 5, name: "Index", color: "#06b6d4", glow: "rgba(6, 182, 212, 0.9)" },
  { id: "middle", tipIdx: 12, pipIdx: 10, mcpIdx: 9, name: "Middle", color: "#22c55e", glow: "rgba(34, 197, 94, 0.9)" },
  { id: "ring", tipIdx: 16, pipIdx: 14, mcpIdx: 13, name: "Ring", color: "#f59e0b", glow: "rgba(245, 158, 11, 0.9)" },
  { id: "pinky", tipIdx: 20, pipIdx: 18, mcpIdx: 17, name: "Pinky", color: "#a855f7", glow: "rgba(168, 85, 247, 0.9)" }
] as const;

/**
 * Extract active extended fingertips from detected hands
 */
export function extractFingertips(
  hands: any[],
  width: number,
  height: number
): { all: FingertipPoint[]; byHand: FingertipPoint[][] } {
  const all: FingertipPoint[] = [];
  const byHand: FingertipPoint[][] = [];

  if (!hands || hands.length === 0) return { all, byHand };

  hands.forEach((hand, hIdx) => {
    const handTips: FingertipPoint[] = [];
    const lm = hand.landmarks;
    if (!lm || lm.length < 21) return;

    const wrist = lm[0];

    FINGERTIP_CONFIG.forEach((cfg) => {
      const tip = lm[cfg.tipIdx];
      const pip = lm[cfg.pipIdx];
      const mcp = lm[cfg.mcpIdx];

      let isExtended = false;
      if (cfg.id === "thumb") {
        const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const dWristMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
        isExtended = dWristTip > dWristMcp * 1.15;
      } else {
        const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const dWristPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
        isExtended = dWristTip > dWristPip * 1.05;
      }

      if (isExtended) {
        // Mirrored selfie camera coordinates
        const x = (1 - tip.x) * width;
        const y = tip.y * height;
        const z = tip.z || 0;

        const pt: FingertipPoint = {
          id: `${hIdx}-${cfg.id}`,
          name: cfg.name as any,
          handIdx: hIdx,
          handedness: hand.handedness || (hIdx === 0 ? "Right" : "Left"),
          x,
          y,
          z,
          color: cfg.color,
          glow: cfg.glow
        };
        handTips.push(pt);
        all.push(pt);
      }
    });

    byHand.push(handTips);
  });

  return { all, byHand };
}

/**
 * Render live fingertip vertices and connecting laser edges.
 * Every edge begins and ends exactly at fingertip vertices.
 */
export function renderFingertipGeometry(
  ctx: CanvasRenderingContext2D,
  allTips: FingertipPoint[],
  byHand: FingertipPoint[][],
  animTime: number
): ConfirmedShape | null {
  if (allTips.length < 2) {
    // If only 1 or 0 fingertips, only draw single vertex dot
    allTips.forEach((tip) => renderVertexDot(ctx, tip, animTime));
    return null;
  }

  let liveCandidate: ConfirmedShape | null = null;

  // 1. Draw connecting laser edges strictly between fingertip vertices
  if (allTips.length === 2) {
    // Line between 2 fingertip vertices: POINT A ●────────● POINT B
    const p1 = allTips[0];
    const p2 = allTips[1];
    drawLaserEdge(ctx, p1, p2, animTime);

    liveCandidate = {
      id: `shape-${Date.now()}`,
      type: "line",
      points: [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }],
      color: p1.color,
      width: 3,
      createdAt: Date.now()
    };
  } else if (allTips.length === 3) {
    // Triangle: 3 vertices
    const p1 = allTips[0];
    const p2 = allTips[1];
    const p3 = allTips[2];

    drawLaserEdge(ctx, p1, p2, animTime);
    drawLaserEdge(ctx, p2, p3, animTime);
    drawLaserEdge(ctx, p3, p1, animTime);

    // Translucent holographic face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
    ctx.fill();
    ctx.restore();

    liveCandidate = {
      id: `shape-${Date.now()}`,
      type: "triangle",
      points: [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }, { x: p3.x, y: p3.y }, { x: p1.x, y: p1.y }],
      color: "#06b6d4",
      width: 3,
      createdAt: Date.now()
    };
  } else if (allTips.length === 4) {
    // Quadrilateral: 4 vertices
    const [p1, p2, p3, p4] = allTips;
    drawLaserEdge(ctx, p1, p2, animTime);
    drawLaserEdge(ctx, p2, p3, animTime);
    drawLaserEdge(ctx, p3, p4, animTime);
    drawLaserEdge(ctx, p4, p1, animTime);

    // Diagonal subtle beam
    drawSubtleEdge(ctx, p1, p3);
    drawSubtleEdge(ctx, p2, p4);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fillStyle = "rgba(168, 85, 247, 0.12)";
    ctx.fill();
    ctx.restore();

    liveCandidate = {
      id: `shape-${Date.now()}`,
      type: "quadrilateral",
      points: [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p3.x, y: p3.y },
        { x: p4.x, y: p4.y },
        { x: p1.x, y: p1.y }
      ],
      color: "#a855f7",
      width: 3,
      createdAt: Date.now()
    };
  } else {
    // Spatial Polygon Network: Connect sequential vertices & cross-hand links
    for (let i = 0; i < allTips.length; i++) {
      const nextIdx = (i + 1) % allTips.length;
      drawLaserEdge(ctx, allTips[i], allTips[nextIdx], animTime);
    }
    // Cross links across hands
    if (byHand.length >= 2) {
      const h1 = byHand[0];
      const h2 = byHand[1];
      h1.forEach((t1) => {
        h2.forEach((t2) => {
          if (t1.name === t2.name) {
            drawLaserEdge(ctx, t1, t2, animTime, 3.2);
          }
        });
      });
    }

    liveCandidate = {
      id: `shape-${Date.now()}`,
      type: "polygon",
      points: allTips.map((t) => ({ x: t.x, y: t.y })),
      color: "#3b82f6",
      width: 2.5,
      createdAt: Date.now()
    };
  }

  // 2. Render fingertip vertex nodes (small, sharp glowing dots)
  allTips.forEach((tip) => renderVertexDot(ctx, tip, animTime));

  return liveCandidate;
}

/**
 * Render single fingertip vertex node
 */
function renderVertexDot(ctx: CanvasRenderingContext2D, tip: FingertipPoint, animTime: number) {
  ctx.save();
  const pulseRadius = 12 + Math.sin(animTime * 3 + tip.x) * 2.5;

  // Luminous aura
  const aura = ctx.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, pulseRadius);
  aura.addColorStop(0, tip.glow);
  aura.addColorStop(1, "transparent");

  ctx.beginPath();
  ctx.arc(tip.x, tip.y, pulseRadius, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  // Solid node dot
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = tip.color;
  ctx.shadowColor = tip.color;
  ctx.shadowBlur = 12;
  ctx.fill();

  // White core center
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Outer coordinate ring
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw laser edge starting exactly at p1 and ending exactly at p2
 */
function drawLaserEdge(
  ctx: CanvasRenderingContext2D,
  p1: FingertipPoint,
  p2: FingertipPoint,
  animTime: number,
  baseWidth: number = 2.4
) {
  ctx.save();
  const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
  grad.addColorStop(0, p1.color);
  grad.addColorStop(1, p2.color);

  // Parallax depth offset shadow
  const depth = (p1.z + p2.z) * 8;
  ctx.beginPath();
  ctx.moveTo(p1.x + depth, p1.y + depth);
  ctx.lineTo(p2.x + depth, p2.y + depth);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Main laser line
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = grad;
  ctx.lineWidth = baseWidth;
  ctx.shadowColor = p1.color;
  ctx.shadowBlur = 14;
  ctx.stroke();

  // Animated traveling photon particle
  const pulsePos = (animTime * 0.8 + (p1.x + p2.y) * 0.003) % 1.0;
  const px = p1.x + (p2.x - p1.x) * pulsePos;
  const py = p1.y + (p2.y - p1.y) * pulsePos;

  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 8;
  ctx.fill();

  ctx.restore();
}

function drawSubtleEdge(ctx: CanvasRenderingContext2D, p1: FingertipPoint, p2: FingertipPoint) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.restore();
}

/**
 * Render confirmed persistent shapes
 */
export function renderConfirmedShapes(ctx: CanvasRenderingContext2D, shapes: ConfirmedShape[]) {
  shapes.forEach((shape) => {
    const pts = shape.points;
    if (pts.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

    ctx.fillStyle = "rgba(6, 182, 212, 0.10)";
    ctx.fill();

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.shadowColor = shape.color;
    ctx.shadowBlur = 16;
    ctx.stroke();

    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = shape.color;
      ctx.shadowBlur = 10;
      ctx.fill();
    });

    ctx.restore();
  });
}
