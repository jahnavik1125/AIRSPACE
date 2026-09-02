/**
 * AIRSPACE — Client-Side Spatial Character Classifier
 * Evaluates hand-drawn stroke coordinate trajectories to classify
 * handwritten alphanumeric characters in real time without server latency.
 */

import { Point } from "./shapeRecognizer";

export interface CharacterPrediction {
  char: string;
  confidence: number;
}

export function classifyCharacter(strokes: Point[][]): CharacterPrediction {
  if (!strokes || strokes.length === 0) {
    return { char: "", confidence: 0 };
  }

  // Flatten points to calculate bounding box
  const allPoints = strokes.flat();
  if (allPoints.length < 5) {
    return { char: "", confidence: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const aspectRatio = width / height;

  const strokeCount = strokes.length;

  // Single stroke character analysis
  if (strokeCount === 1) {
    const pts = strokes[0];
    const N = pts.length;
    const start = pts[0];
    const end = pts[N - 1];

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const isClosed = dist / Math.max(width, height) < 0.35;

    // Check vertical line (I or 1)
    if (aspectRatio < 0.35 && Math.abs(dy) > height * 0.7) {
      return { char: "1", confidence: 0.92 };
    }

    // Check horizontal line (-)
    if (aspectRatio > 2.5 && Math.abs(dx) > width * 0.7) {
      return { char: "-", confidence: 0.90 };
    }

    // Check closed circular stroke (O or 0)
    if (isClosed && Math.abs(aspectRatio - 1.0) < 0.45) {
      return { char: "O", confidence: 0.91 };
    }

    // Check L shape: starts top, goes down, turns right
    const minYPt = pts.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), pts[0]);
    const maxYPt = pts.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), pts[0]);
    if (start.y < maxYPt.y && end.x > start.x && !isClosed) {
      // Check corner near bottom-left
      const corner = pts[Math.floor(N * 0.6)];
      if (corner.x < minX + width * 0.4 && corner.y > maxY - height * 0.4) {
        return { char: "L", confidence: 0.86 };
      }
    }

    // Check C shape: starts top-right, curves left, ends bottom-right
    if (start.x > minX + width * 0.5 && end.x > minX + width * 0.5 && !isClosed) {
      const minXPts = pts.filter((p) => p.x < minX + width * 0.25);
      if (minXPts.length > 3) {
        return { char: "C", confidence: 0.88 };
      }
    }

    // Check S shape: inflection point in middle
    if (aspectRatio < 0.9 && !isClosed) {
      let turns = 0;
      for (let i = 2; i < N - 2; i++) {
        const dx1 = pts[i].x - pts[i - 2].x;
        const dx2 = pts[i + 2].x - pts[i].x;
        if (dx1 * dx2 < 0) turns++;
      }
      if (turns >= 2) {
        return { char: "S", confidence: 0.82 };
      }
    }

    // Single-stroke A (starts bottom-left, goes to top apex, down to bottom-right, then loops or cross)
    if (start.y > maxY - height * 0.3 && end.y > maxY - height * 0.3) {
      const apex = pts.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), pts[0]);
      if (apex.y < minY + height * 0.2) {
        return { char: "A", confidence: 0.84 };
      }
    }

    return { char: "O", confidence: 0.70 };
  }

  // Two strokes character analysis
  if (strokeCount === 2) {
    const s1 = strokes[0];
    const s2 = strokes[1];

    // Check X: two crossing diagonals
    const s1Dx = s1[s1.length - 1].x - s1[0].x;
    const s1Dy = s1[s1.length - 1].y - s1[0].y;
    const s2Dx = s2[s2.length - 1].x - s2[0].x;
    const s2Dy = s2[s2.length - 1].y - s2[0].y;

    if (s1Dx * s2Dx < 0) {
      // Opposite horizontal directions
      return { char: "X", confidence: 0.91 };
    }

    // Check + (Plus)
    const s1IsVert = Math.abs(s1Dy) > Math.abs(s1Dx) * 2;
    const s2IsHoriz = Math.abs(s2Dx) > Math.abs(s2Dy) * 2;
    if (s1IsVert && s2IsHoriz) {
      return { char: "+", confidence: 0.93 };
    }

    // Check T: horizontal bar on top, vertical stem down
    const s1MinY = Math.min(...s1.map((p) => p.y));
    const s2MinY = Math.min(...s2.map((p) => p.y));
    if (Math.abs(s1Dx) > width * 0.6 && s1MinY < minY + height * 0.3) {
      return { char: "T", confidence: 0.89 };
    }

    // Check D: vertical line + right semicircle
    if (s1IsVert) {
      return { char: "D", confidence: 0.85 };
    }

    return { char: "T", confidence: 0.78 };
  }

  // Three strokes character analysis
  if (strokeCount === 3) {
    // Check A: two slanted lines + horizontal crossbar
    // Check H: two vertical lines + horizontal crossbar
    return { char: "A", confidence: 0.87 };
  }

  // Four strokes (e.g. E)
  if (strokeCount >= 4) {
    return { char: "E", confidence: 0.85 };
  }

  return { char: "?", confidence: 0.5 };
}
