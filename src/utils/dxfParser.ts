import DxfParser from 'dxf-parser';

export interface DXFPoolData {
  name: string;
  outline: Array<{ x: number; y: number }>;
  zoneOfInfluence: Array<{ x: number; y: number }> | null;
  deepEndPosition: { x: number; y: number } | null;
  shallowEndPosition: { x: number; y: number } | null;
  boundingBox: { width: number; height: number };
}

/**
 * Parse a DXF file and extract pool geometry
 * @param file - The DXF file to parse
 * @param scale - Scale divider (default 100 for 1:100 scale DXF in mm)
 * @returns Parsed pool data
 */
export async function parseDXFPool(
  file: File,
  scale: number = 100
): Promise<DXFPoolData> {
  const text = await file.text();
  const parser = new DxfParser();
  
  try {
    const dxf = parser.parseSync(text);
    
    if (!dxf) {
      throw new Error('Failed to parse DXF file');
    }

    // Extract pool outline from layer "0"
    const outline = extractLayerGeometry(dxf, '0', scale);
    
    if (!outline || outline.length < 3) {
      throw new Error('Pool outline not found on layer 0 or invalid geometry');
    }

    // Extract zone of influence from "BOUNDARY" layer (optional)
    const zoneOfInfluence = extractLayerGeometry(dxf, 'BOUNDARY', scale);

    // Calculate bounding box
    const boundingBox = calculateBoundingBox(outline);

    // Try to detect deep/shallow end positions from TEXT entities
    const { deepEnd, shallowEnd } = extractEndPositions(dxf, scale);

    // Get pool name from filename (without extension)
    const name = file.name.replace(/\.[^/.]+$/, '');

    return {
      name,
      outline,
      zoneOfInfluence: zoneOfInfluence && zoneOfInfluence.length > 0 ? zoneOfInfluence : null,
      deepEndPosition: deepEnd,
      shallowEndPosition: shallowEnd,
      boundingBox,
    };
  } catch (error) {
    throw new Error(`Failed to parse DXF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract geometry from a specific layer
 */
export function extractLayerGeometry(
  dxf: any,
  layerName: string,
  scale: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  
  if (!dxf.entities) {
    return points;
  }

  // Find entities on the specified layer
  const entities = dxf.entities.filter((entity: any) => entity.layer === layerName);

  entities.forEach((entity: any) => {
    if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
      // Extract vertices from polyline
      entity.vertices?.forEach((vertex: any) => {
        points.push({
          x: Math.round(vertex.x / scale),
          y: Math.round(vertex.y / scale),
        });
      });
    } else if (entity.type === 'LINE') {
      // Extract start and end points from line
      points.push(
        {
          x: Math.round(entity.vertices[0].x / scale),
          y: Math.round(entity.vertices[0].y / scale),
        },
        {
          x: Math.round(entity.vertices[1].x / scale),
          y: Math.round(entity.vertices[1].y / scale),
        }
      );
    } else if (entity.type === 'ARC') {
      // Sample arc into line segments
      const arcPoints = sampleArc(entity, scale);
      points.push(...arcPoints);
    }
  });

  return points;
}

/**
 * Sample an arc entity into discrete points
 */
function sampleArc(arc: any, scale: number, segments: number = 20): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const startAngle = (arc.startAngle * Math.PI) / 180;
  const endAngle = (arc.endAngle * Math.PI) / 180;
  const angleStep = (endAngle - startAngle) / segments;

  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + angleStep * i;
    points.push({
      x: Math.round((arc.center.x + arc.radius * Math.cos(angle)) / scale),
      y: Math.round((arc.center.y + arc.radius * Math.sin(angle)) / scale),
    });
  }

  return points;
}

/**
 * Calculate bounding box from outline points
 */
function calculateBoundingBox(outline: Array<{ x: number; y: number }>): { width: number; height: number } {
  const xs = outline.map(p => p.x);
  const ys = outline.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}

/**
 * Try to extract deep/shallow end positions from TEXT entities
 */
function extractEndPositions(
  dxf: any,
  scale: number
): { deepEnd: { x: number; y: number } | null; shallowEnd: { x: number; y: number } | null } {
  let deepEnd = null;
  let shallowEnd = null;

  if (!dxf.entities) {
    return { deepEnd, shallowEnd };
  }

  const textEntities = dxf.entities.filter((entity: any) => entity.type === 'TEXT' || entity.type === 'MTEXT');

  textEntities.forEach((entity: any) => {
    const text = entity.text?.toUpperCase() || '';
    
    if (text.includes('DEEP') || text.includes('DE')) {
      deepEnd = {
        x: Math.round(entity.startPoint.x / scale),
        y: Math.round(entity.startPoint.y / scale),
      };
    } else if (text.includes('SHALLOW') || text.includes('SE')) {
      shallowEnd = {
        x: Math.round(entity.startPoint.x / scale),
        y: Math.round(entity.startPoint.y / scale),
      };
    }
  });

  return { deepEnd, shallowEnd };
}
