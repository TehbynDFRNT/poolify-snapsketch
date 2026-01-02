/**
 * Pool Shape Templates for orthogonal (rectilinear) pool shapes
 * All shapes have 90-degree angles only
 */

export type PoolShapeType = 'rectangle' | 't-shape';

export interface Point {
  x: number;
  y: number;
}

export interface RectangleParams {
  length: number; // mm
  width: number;  // mm
}

export interface TShapeParams {
  mainLength: number;    // mm - main body length
  mainWidth: number;     // mm - main body width
  extensionLength: number; // mm - extension (bench) length
  extensionWidth: number;  // mm - extension (bench) width
  extensionPosition: 'center' | 'left' | 'right'; // where extension attaches
}

export type ShapeParams = RectangleParams | TShapeParams;

export interface PoolShapeTemplate {
  type: PoolShapeType;
  name: string;
  description: string;
  defaultParams: ShapeParams;
  generateOutline: (params: ShapeParams) => Point[];
  // Calculate overall dimensions for display
  getDimensions: (params: ShapeParams) => { length: number; width: number };
}

/**
 * Generate rectangle outline (4 vertices + closing point)
 */
function generateRectangleOutline(params: RectangleParams): Point[] {
  const { length, width } = params;
  return [
    { x: 0, y: 0 },
    { x: length, y: 0 },
    { x: length, y: width },
    { x: 0, y: width },
    { x: 0, y: 0 }, // close
  ];
}

/**
 * Generate T-shape outline (8 vertices + closing point)
 * The extension protrudes from the top edge of the main rectangle
 *
 * Shape looks like:
 *       ┌───────┐
 *       │  ext  │
 * ┌─────┴───────┴─────┐
 * │                   │
 * │    main body      │
 * │                   │
 * └───────────────────┘
 */
function generateTShapeOutline(params: TShapeParams): Point[] {
  const { mainLength, mainWidth, extensionLength, extensionWidth, extensionPosition } = params;

  // Calculate extension X position based on alignment
  let extStartX: number;
  if (extensionPosition === 'left') {
    extStartX = 0;
  } else if (extensionPosition === 'right') {
    extStartX = mainLength - extensionLength;
  } else {
    // center
    extStartX = (mainLength - extensionLength) / 2;
  }
  const extEndX = extStartX + extensionLength;

  // Build outline clockwise starting from bottom-left
  // Extension is at the top (negative Y direction from main body)
  return [
    { x: 0, y: extensionWidth },                    // bottom-left of main
    { x: 0, y: extensionWidth + mainWidth },        // top-left of main (bottom edge)
    { x: mainLength, y: extensionWidth + mainWidth }, // top-right of main (bottom edge)
    { x: mainLength, y: extensionWidth },           // bottom-right of main
    { x: extEndX, y: extensionWidth },              // where extension meets main (right)
    { x: extEndX, y: 0 },                           // top-right of extension
    { x: extStartX, y: 0 },                         // top-left of extension
    { x: extStartX, y: extensionWidth },            // where extension meets main (left)
    { x: 0, y: extensionWidth },                    // close back to start
  ];
}

export const POOL_SHAPE_TEMPLATES: Record<PoolShapeType, PoolShapeTemplate> = {
  'rectangle': {
    type: 'rectangle',
    name: 'Rectangle',
    description: 'Standard rectangular pool',
    defaultParams: {
      length: 7000,
      width: 3000,
    } as RectangleParams,
    generateOutline: (params) => generateRectangleOutline(params as RectangleParams),
    getDimensions: (params) => {
      const p = params as RectangleParams;
      return { length: p.length, width: p.width };
    },
  },
  't-shape': {
    type: 't-shape',
    name: 'T-Shape',
    description: 'Pool with bench/wading extension',
    defaultParams: {
      mainLength: 7000,
      mainWidth: 3000,
      extensionLength: 2000,
      extensionWidth: 1000,
      extensionPosition: 'center',
    } as TShapeParams,
    generateOutline: (params) => generateTShapeOutline(params as TShapeParams),
    getDimensions: (params) => {
      const p = params as TShapeParams;
      return {
        length: p.mainLength,
        width: p.mainWidth + p.extensionWidth
      };
    },
  },
};

/**
 * Validate that all angles in an outline are 90 degrees
 */
export function validateOrthogonalOutline(outline: Point[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const n = outline.length - 1; // exclude closing point

  if (n < 4) {
    errors.push('Outline must have at least 4 vertices');
    return { valid: false, errors };
  }

  for (let i = 0; i < n; i++) {
    const prev = outline[(i - 1 + n) % n];
    const curr = outline[i];
    const next = outline[(i + 1) % n];

    // Calculate vectors
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    // Dot product should be 0 for 90-degree angle
    const dot = v1.x * v2.x + v1.y * v2.y;
    const epsilon = 1; // Allow 1mm tolerance

    if (Math.abs(dot) > epsilon) {
      errors.push(`Vertex ${i + 1} is not at a 90-degree angle`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get default shallow/deep end positions for a shape
 */
export function getDefaultEndPositions(
  outline: Point[],
  shapeType: PoolShapeType,
  params: ShapeParams
): { shallow: Point; deep: Point } {
  if (shapeType === 'rectangle') {
    const p = params as RectangleParams;
    return {
      shallow: { x: 150, y: p.width / 2 },
      deep: { x: p.length - 150, y: p.width / 2 },
    };
  } else if (shapeType === 't-shape') {
    const p = params as TShapeParams;
    // Shallow end in extension, deep end at opposite side of main body
    return {
      shallow: { x: p.mainLength / 2, y: p.extensionWidth / 2 },
      deep: { x: p.mainLength / 2, y: p.extensionWidth + p.mainWidth - 150 },
    };
  }

  // Fallback
  return {
    shallow: { x: 150, y: 150 },
    deep: { x: 1000, y: 150 },
  };
}
