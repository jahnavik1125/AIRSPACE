export interface VectorPoint {
  x: number;
  y: number;
  t?: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CanvasObject {
  id: string;
  type: "STROKE" | "LINE" | "CIRCLE" | "RECTANGLE" | "TRIANGLE" | "ARROW" | "TEXT";
  points: VectorPoint[];
  position: { x: number; y: number };
  boundingBox: BoundingBox;
  color: string;
  width: number;
  opacity: number;
}

export function exportToSVG(objects: CanvasObject[], width = 800, height = 600): string {
  let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
  svgContent += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  
  // Renders a dark slate background matching the web interface
  svgContent += `  <rect width="100%" height="100%" fill="#0f172a" />\n`;

  objects.forEach((obj) => {
    const strokeColor = obj.color || "#3b82f6";
    const strokeWidth = obj.width || 4;
    const opacity = obj.opacity !== undefined ? obj.opacity : 1.0;

    // Convert coordinates to canvas pixels space
    const pts = obj.points.map((p) => ({
      x: p.x * width,
      y: p.y * height
    }));

    if (pts.length === 0) return;

    if (obj.type === "STROKE" || obj.type === "TEXT") {
      // Draw smooth paths for freehand strokes
      if (pts.length < 2) return;
      let pathD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        pathD += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      }
      svgContent += `  <path d="${pathD}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" />\n`;
    } 
    else if (obj.type === "LINE") {
      const pStart = pts[0];
      const pEnd = pts[pts.length - 1];
      svgContent += `  <line x1="${pStart.x.toFixed(1)}" y1="${pStart.y.toFixed(1)}" x2="${pEnd.x.toFixed(1)}" y2="${pEnd.y.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" />\n`;
    } 
    else if (obj.type === "CIRCLE") {
      // Find radius and center from bounding box
      const minX = obj.boundingBox.minX * width;
      const maxX = obj.boundingBox.maxX * width;
      const minY = obj.boundingBox.minY * height;
      const maxY = obj.boundingBox.maxY * height;
      
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const r = Math.max(maxX - minX, maxY - minY) / 2;
      
      svgContent += `  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}" />\n`;
    } 
    else if (obj.type === "RECTANGLE") {
      const minX = obj.boundingBox.minX * width;
      const maxX = obj.boundingBox.maxX * width;
      const minY = obj.boundingBox.minY * height;
      const maxY = obj.boundingBox.maxY * height;
      
      const rx = minX;
      const ry = minY;
      const rw = maxX - minX;
      const rh = maxY - minY;
      
      svgContent += `  <rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}" />\n`;
    } 
    else if (obj.type === "TRIANGLE") {
      // Triangles simplified vertices
      const minX = obj.boundingBox.minX * width;
      const maxX = obj.boundingBox.maxX * width;
      const minY = obj.boundingBox.minY * height;
      const maxY = obj.boundingBox.maxY * height;
      
      const p1 = `${((minX + maxX) / 2).toFixed(1)},${minY.toFixed(1)}`;
      const p2 = `${maxX.toFixed(1)},${maxY.toFixed(1)}`;
      const p3 = `${minX.toFixed(1)},${maxY.toFixed(1)}`;
      
      svgContent += `  <polygon points="${p1} ${p2} ${p3}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}" stroke-linejoin="round" />\n`;
    } 
    else if (obj.type === "ARROW") {
      // Draw arrow shaft line and header head
      const pStart = pts[0];
      const pEnd = pts[pts.length - 1];
      
      // Calculate head tips vectors
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const angle = Math.atan2(dy, dx);
      const headLength = 15;
      
      const headX1 = pEnd.x - headLength * Math.cos(angle - Math.PI / 6);
      const headY1 = pEnd.y - headLength * Math.sin(angle - Math.PI / 6);
      const headX2 = pEnd.x - headLength * Math.cos(angle + Math.PI / 6);
      const headY2 = pEnd.y - headLength * Math.sin(angle + Math.PI / 6);
      
      let pathD = `M ${pStart.x.toFixed(1)} ${pStart.y.toFixed(1)} L ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)} `;
      pathD += `M ${headX1.toFixed(1)} ${headY1.toFixed(1)} L ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)} L ${headX2.toFixed(1)} ${headY2.toFixed(1)}`;
      
      svgContent += `  <path d="${pathD}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" />\n`;
    }
  });

  svgContent += `</svg>\n`;
  return svgContent;
}
