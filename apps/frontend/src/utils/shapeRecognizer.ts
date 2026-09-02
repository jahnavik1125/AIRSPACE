/**
 * AIRSPACE — Geometric Shape Recognizer
 * Evaluates hand-drawn stroke coordinate trajectories to classify
 * and snap rough drawings into clean geometric shapes:
 * - Circle
 * - Rectangle
 * - Triangle
 * - Line
 * - Arrow
 */

export interface Point {
  x: number;
  y: number;
  t?: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export type ShapeType = "CIRCLE" | "RECTANGLE" | "TRIANGLE" | "LINE" | "ARROW" | "UNKNOWN";

export interface RecognizedShapeResult {
  type: ShapeType;
  confidence: number;
  bbox: BoundingBox;
  cleanPoints?: Point[];
  details?: any;
}

function perpendicularDistance(pt: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLenSq = dx * dx + dy * dy;

  if (lineLenSq < 1e-6) {
    const ddx = pt.x - lineStart.x;
    const ddy = pt.y - lineStart.y;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  const t = Math.max(0, Math.min(1, ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / lineLenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  const distDx = pt.x - projX;
  const distDy = pt.y - projY;
  return Math.sqrt(distDx * distDx + distDy * distDy);
}

export function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  let dmax = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [start, end];
  }
}

export function calculateBoundingBox(points: Point[]): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  return { minX, maxX, minY, maxY, width, height, centerX, centerY };
}

export function recognizeShape(stroke: Point[]): RecognizedShapeResult {
  const N = stroke.length;
  if (N < 4) {
    return {
      type: "UNKNOWN",
      confidence: 0,
      bbox: calculateBoundingBox(stroke)
    };
  }

  const bbox = calculateBoundingBox(stroke);
  const maxDim = Math.max(bbox.width, bbox.height);

  if (maxDim < 20) {
    return { type: "UNKNOWN", confidence: 0, bbox };
  }

  const startPt = stroke[0];
  const endPt = stroke[N - 1];
  const dxStartEnd = endPt.x - startPt.x;
  const dyStartEnd = endPt.y - startPt.y;
  const distStartEnd = Math.sqrt(dxStartEnd * dxStartEnd + dyStartEnd * dyStartEnd);
  const isClosed = distStartEnd < maxDim * 0.35;

  // 1. Check for Line (open path with minimal perpendicular deviation)
  if (!isClosed) {
    let maxDev = 0;
    for (const p of stroke) {
      const dev = perpendicularDistance(p, startPt, endPt);
      if (dev > maxDev) maxDev = dev;
    }

    // Line check
    if (maxDev < maxDim * 0.14) {
      const cleanPoints: Point[] = [
        { x: startPt.x, y: startPt.y },
        { x: endPt.x, y: endPt.y }
      ];
      const confidence = Math.max(0.7, 1 - maxDev / (maxDim * 0.14));
      return { type: "LINE", confidence, bbox, cleanPoints };
    }

    // 2. Check for Arrow (straight shaft with a sharp turnaround or arrowhead near end)
    if (N > 12) {
      const shaftEndIdx = Math.floor(N * 0.7);
      const shaftStart = startPt;
      const shaftEnd = stroke[shaftEndIdx];

      let shaftDev = 0;
      for (let i = 0; i <= shaftEndIdx; i++) {
        const dev = perpendicularDistance(stroke[i], shaftStart, shaftEnd);
        if (dev > shaftDev) shaftDev = dev;
      }

      const shaftLen = Math.sqrt(
        (shaftEnd.x - shaftStart.x) ** 2 + (shaftEnd.y - shaftStart.y) ** 2
      );

      if (shaftDev < shaftLen * 0.25 && shaftLen > 30) {
        const angle = Math.atan2(shaftEnd.y - shaftStart.y, shaftEnd.x - shaftStart.x);
        const headLength = Math.min(25, shaftLen * 0.3);
        const headAngle = Math.PI / 6;

        const wing1: Point = {
          x: shaftEnd.x - headLength * Math.cos(angle - headAngle),
          y: shaftEnd.y - headLength * Math.sin(angle - headAngle)
        };
        const wing2: Point = {
          x: shaftEnd.x - headLength * Math.cos(angle + headAngle),
          y: shaftEnd.y - headLength * Math.sin(angle + headAngle)
        };

        const cleanPoints: Point[] = [
          shaftStart,
          shaftEnd,
          wing1,
          shaftEnd,
          wing2
        ];
        return { type: "ARROW", confidence: 0.85, bbox, cleanPoints };
      }
    }
  }

  // 3. Polygon check (RDP simplification to find sharp corners)
  const epsilon = maxDim * 0.08;
  const simplified = rdpSimplify(stroke, epsilon);
  const V = simplified.length;

  // Triangle: 3 corners + closed endpoint = 4 vertices
  if (isClosed && (V === 4 || V === 3)) {
    const pts = simplified.slice(0, 3);
    if (pts.length === 3) {
      const cleanPoints: Point[] = [...pts, pts[0]];
      return { type: "TRIANGLE", confidence: 0.88, bbox, cleanPoints };
    }
  }

  // Rectangle / Box: 4 corners + closed endpoint = 5 vertices
  if (isClosed && (V === 5 || V === 6)) {
    const cleanPoints: Point[] = [
      { x: bbox.minX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.maxY },
      { x: bbox.minX, y: bbox.maxY },
      { x: bbox.minX, y: bbox.minY }
    ];
    return { type: "RECTANGLE", confidence: 0.88, bbox, cleanPoints };
  }

  // 4. Check for Circle (closed curved path with uniform radial distance from centroid and smooth contour)
  if (isClosed && N >= 10) {
    const cx = bbox.centerX;
    const cy = bbox.centerY;
    let sumR = 0;
    const radii: number[] = [];

    for (const p of stroke) {
      const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      radii.push(r);
      sumR += r;
    }

    const meanR = sumR / N;
    let variance = 0;
    for (const r of radii) {
      variance += (r - meanR) ** 2;
    }
    const stdR = Math.sqrt(variance / N);
    const cv = stdR / (meanR || 1);

    if (cv < 0.22 && meanR > 15) {
      const cleanPoints: Point[] = [];
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        cleanPoints.push({
          x: cx + meanR * Math.cos(theta),
          y: cy + meanR * Math.sin(theta)
        });
      }
      return {
        type: "CIRCLE",
        confidence: Math.max(0.75, 1 - cv * 2.5),
        bbox,
        cleanPoints,
        details: { radius: meanR, cx, cy }
      };
    }
  }

  // Fallback for rough rectangles with extra jitter vertices
  if (isClosed && V >= 7 && V <= 8) {
    const cleanPoints: Point[] = [
      { x: bbox.minX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.maxY },
      { x: bbox.minX, y: bbox.maxY },
      { x: bbox.minX, y: bbox.minY }
    ];
    return { type: "RECTANGLE", confidence: 0.70, bbox, cleanPoints };
  }

  return { type: "UNKNOWN", confidence: 0, bbox };
}
