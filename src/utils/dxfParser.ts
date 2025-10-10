export interface DxfPoint {
  x: number;
  y: number;
}

export interface DxfLine {
  start: DxfPoint;
  end: DxfPoint;
}

export interface DxfText {
  content: string;
  position: DxfPoint;
}

export interface ParsedPool {
  name: string;
  outlinePoints: DxfPoint[];
  dimensions: {
    length: number; // mm
    width: number; // mm
  };
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/**
 * Parse DXF file content and extract pool shapes
 */
export const parseDxfFile = (content: string): ParsedPool[] => {
  const lines = content.split('\n').map(line => line.trim());
  const entities = extractEntities(lines);
  
  // Extract text labels (pool names)
  const textEntities = entities.filter(e => e.type === 'TEXT');
  const lineEntities = entities.filter(e => e.type === 'LINE');
  
  // Group lines by proximity to form shapes
  const shapes = groupLinesIntoShapes(lineEntities as DxfLine[]);
  
  // Match shapes with their labels
  const pools: ParsedPool[] = [];
  
  for (const shape of shapes) {
    // Find the closest text label to this shape
    const shapeCenterY = (shape.bounds.minY + shape.bounds.maxY) / 2;
    const closestText = findClosestText(textEntities as DxfText[], shapeCenterY);
    
    const pool: ParsedPool = {
      name: closestText?.content || 'Unknown Pool',
      outlinePoints: shape.points.map(p => ({
        x: Math.round(p.x * 1000), // Convert meters to mm
        y: Math.round(p.y * 1000)
      })),
      dimensions: {
        length: Math.round((shape.bounds.maxX - shape.bounds.minX) * 1000),
        width: Math.round((shape.bounds.maxY - shape.bounds.minY) * 1000)
      },
      bounds: shape.bounds
    };
    
    pools.push(pool);
  }
  
  // Sort pools by Y position (top to bottom)
  pools.sort((a, b) => b.bounds.minY - a.bounds.minY);
  
  return pools;
};

/**
 * Extract entities (TEXT, LINE) from DXF content
 */
const extractEntities = (lines: string[]): any[] => {
  const entities: any[] = [];
  let i = 0;
  let inEntitiesSection = false;
  
  while (i < lines.length) {
    const line = lines[i];
    
    if (line === 'ENTITIES') {
      inEntitiesSection = true;
      i++;
      continue;
    }
    
    if (line === 'ENDSEC' && inEntitiesSection) {
      break;
    }
    
    if (inEntitiesSection && line === 'TEXT') {
      const text = parseTextEntity(lines, i);
      if (text) {
        entities.push({ type: 'TEXT', ...text });
        i = text.nextIndex;
      }
    } else if (inEntitiesSection && line === 'LINE') {
      const lineData = parseLineEntity(lines, i);
      if (lineData) {
        entities.push({ type: 'LINE', ...lineData });
        i = lineData.nextIndex;
      }
    } else {
      i++;
    }
  }
  
  return entities;
};

/**
 * Parse TEXT entity from DXF lines
 */
const parseTextEntity = (lines: string[], startIndex: number): (DxfText & { nextIndex: number }) | null => {
  let x = 0, y = 0, content = '';
  let i = startIndex + 1;
  
  while (i < lines.length && lines[i] !== '0') {
    const code = lines[i];
    const value = lines[i + 1];
    
    if (code === '10') x = parseFloat(value);
    else if (code === '20') y = parseFloat(value);
    else if (code === '1') content = value.replace(/\^J/g, '').trim();
    
    i += 2;
  }
  
  if (content) {
    return {
      content,
      position: { x, y },
      nextIndex: i
    };
  }
  
  return null;
};

/**
 * Parse LINE entity from DXF lines
 */
const parseLineEntity = (lines: string[], startIndex: number): (DxfLine & { nextIndex: number }) | null => {
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  let i = startIndex + 1;
  
  while (i < lines.length && lines[i] !== '0') {
    const code = lines[i];
    const value = lines[i + 1];
    
    if (code === '10') x1 = parseFloat(value);
    else if (code === '20') y1 = parseFloat(value);
    else if (code === '11') x2 = parseFloat(value);
    else if (code === '21') y2 = parseFloat(value);
    
    i += 2;
  }
  
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    nextIndex: i
  };
};

/**
 * Group lines into closed shapes
 */
const groupLinesIntoShapes = (lines: DxfLine[]): any[] => {
  const shapes: any[] = [];
  const used = new Set<number>();
  const tolerance = 0.01; // 10mm tolerance in meters
  
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    
    const shape = buildShapeFromLine(lines, i, used, tolerance);
    if (shape && shape.points.length >= 4) {
      shapes.push(shape);
    }
  }
  
  return shapes;
};

/**
 * Build a closed shape starting from a line
 */
const buildShapeFromLine = (
  lines: DxfLine[],
  startIndex: number,
  used: Set<number>,
  tolerance: number
): { points: DxfPoint[]; bounds: any } | null => {
  const points: DxfPoint[] = [];
  const startLine = lines[startIndex];
  
  points.push(startLine.start);
  points.push(startLine.end);
  used.add(startIndex);
  
  let currentPoint = startLine.end;
  let iterations = 0;
  const maxIterations = 1000;
  
  while (iterations < maxIterations) {
    iterations++;
    
    // Check if we've closed the loop
    const distToStart = distance(currentPoint, startLine.start);
    if (points.length > 2 && distToStart < tolerance) {
      // Closed shape found
      const bounds = calculateBounds(points);
      return { points, bounds };
    }
    
    // Find the next connected line
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      
      const line = lines[i];
      
      if (distance(currentPoint, line.start) < tolerance) {
        points.push(line.end);
        currentPoint = line.end;
        used.add(i);
        found = true;
        break;
      } else if (distance(currentPoint, line.end) < tolerance) {
        points.push(line.start);
        currentPoint = line.start;
        used.add(i);
        found = true;
        break;
      }
    }
    
    if (!found) break;
  }
  
  return null;
};

/**
 * Calculate distance between two points
 */
const distance = (p1: DxfPoint, p2: DxfPoint): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate bounding box of points
 */
const calculateBounds = (points: DxfPoint[]) => {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  
  return { minX, maxX, minY, maxY };
};

/**
 * Find the closest text label to a given Y coordinate
 */
const findClosestText = (texts: DxfText[], targetY: number): DxfText | null => {
  if (texts.length === 0) return null;
  
  let closest = texts[0];
  let minDistance = Math.abs(texts[0].position.y - targetY);
  
  for (let i = 1; i < texts.length; i++) {
    const dist = Math.abs(texts[i].position.y - targetY);
    if (dist < minDistance) {
      minDistance = dist;
      closest = texts[i];
    }
  }
  
  return closest;
};
