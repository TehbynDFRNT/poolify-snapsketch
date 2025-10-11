export type CopingOption = 'none' | '400x400' | '400x600' | '600x400';

export interface Point {
  x: number;
  y: number;
}

export interface PaverSize {
  width: number;
  height: number;
}

export interface CopingPaver {
  id: string;
  position: Point;
  size: PaverSize;
  rotation: number;
  type: 'corner' | 'full' | 'stripe';
  corner?: 'NW' | 'NE' | 'SE' | 'SW';
  side?: 'north' | 'south' | 'east' | 'west';
  sequence?: number;
  cutWidth?: number;
  originalWidth?: number;
  pairIndex?: 0 | 1;
}

export interface CopingLayout {
  cornerPavers: CopingPaver[];
  fullPavers: CopingPaver[];
  stripePavers: CopingPaver[];
  groutWidth: 5;
  measurements: {
    totalPavers: number;
    cornerPavers: 4;
    fullPavers: number;
    stripePavers: number;
    sides: {
      north: { fullPavers: number; stripeWidth: number };
      south: { fullPavers: number; stripeWidth: number };
      east: { fullPavers: number; stripeWidth: number };
      west: { fullPavers: number; stripeWidth: number };
    };
    totalArea: number;
    copingPerimeter: number;
  };
}

/**
 * CORNER-FIRST COPING ALGORITHM
 * 
 * Methodology:
 * 1. Place 4 corner pavers FIRST (aligned with waterline)
 * 2. Work from each corner toward center with full-size pavers
 * 3. Fill remaining gap in center with UNIFORM stripe pattern (2 equal cuts)
 * 4. Always use 5mm grout lines (professional standard)
 */
export function generateCopingLayout(
  poolOutline: Point[],
  cornerSize: PaverSize,
  fullSize: PaverSize
): CopingLayout {
  
  const GROUT_WIDTH = 5; // mm - always 5mm for professional finish
  
  const layout: CopingLayout = {
    cornerPavers: [],
    fullPavers: [],
    stripePavers: [],
    groutWidth: GROUT_WIDTH,
    measurements: {
      totalPavers: 0,
      cornerPavers: 4,
      fullPavers: 0,
      stripePavers: 0,
      sides: {
        north: { fullPavers: 0, stripeWidth: 0 },
        south: { fullPavers: 0, stripeWidth: 0 },
        east: { fullPavers: 0, stripeWidth: 0 },
        west: { fullPavers: 0, stripeWidth: 0 },
      },
      totalArea: 0,
      copingPerimeter: 0,
    },
  };

  // STEP 1: Find corners (assuming rectangular pool)
  const corners = findCorners(poolOutline);

  // STEP 2: Place corner pavers FIRST (corner-first methodology)
  const cornerPositions = ['NW', 'NE', 'SE', 'SW'] as const;
  corners.forEach((corner, index) => {
    layout.cornerPavers.push({
      id: `corner-${cornerPositions[index]}`,
      position: corner,
      size: cornerSize,
      rotation: getCornerRotation(cornerPositions[index]),
      type: 'corner',
      corner: cornerPositions[index],
    });
  });

  // STEP 3: For each side, work from corners toward center
  const sides = [
    { name: 'north' as const, start: corners[0], end: corners[1] },
    { name: 'east' as const, start: corners[1], end: corners[2] },
    { name: 'south' as const, start: corners[2], end: corners[3] },
    { name: 'west' as const, start: corners[3], end: corners[0] },
  ];

  sides.forEach(side => {
    const sideLength = distance(side.start, side.end);
    const angle = Math.atan2(side.end.y - side.start.y, side.end.x - side.start.x);
    
    // Start from first corner
    let distanceFromStart = cornerSize.width + GROUT_WIDTH;
    let startPaverCount = 0;

    // Lay full pavers from start corner toward center
    while (distanceFromStart + fullSize.width + GROUT_WIDTH < sideLength / 2) {
      const position = {
        x: side.start.x + Math.cos(angle) * distanceFromStart,
        y: side.start.y + Math.sin(angle) * distanceFromStart,
      };

      layout.fullPavers.push({
        id: `full-${side.name}-start-${startPaverCount}`,
        position,
        size: fullSize,
        rotation: (angle * 180) / Math.PI,
        type: 'full',
        side: side.name,
        sequence: startPaverCount + 1,
      });

      distanceFromStart += fullSize.width + GROUT_WIDTH;
      startPaverCount++;
    }

    // Same from end corner toward center
    let distanceFromEnd = cornerSize.width + GROUT_WIDTH;
    let endPaverCount = 0;

    while (distanceFromEnd + fullSize.width + GROUT_WIDTH < sideLength / 2) {
      const position = {
        x: side.end.x - Math.cos(angle) * distanceFromEnd,
        y: side.end.y - Math.sin(angle) * distanceFromEnd,
      };

      layout.fullPavers.push({
        id: `full-${side.name}-end-${endPaverCount}`,
        position,
        size: fullSize,
        rotation: (angle * 180) / Math.PI,
        type: 'full',
        side: side.name,
        sequence: endPaverCount + 1,
      });

      distanceFromEnd += fullSize.width + GROUT_WIDTH;
      endPaverCount++;
    }

    // STEP 4: Calculate stripe pavers in middle (UNIFORM PATTERN)
    const totalFullPavers = startPaverCount + endPaverCount;
    const remainingGap = sideLength - distanceFromStart - distanceFromEnd;
    
    // Divide remaining gap into 2 equal stripe pavers (uniform)
    const stripePaverWidth = (remainingGap - GROUT_WIDTH) / 2;

    // Add first stripe paver
    const stripe1Position = {
      x: side.start.x + Math.cos(angle) * distanceFromStart,
      y: side.start.y + Math.sin(angle) * distanceFromStart,
    };

    layout.stripePavers.push({
      id: `stripe-${side.name}-1`,
      position: stripe1Position,
      size: { width: stripePaverWidth, height: fullSize.height },
      rotation: (angle * 180) / Math.PI,
      type: 'stripe',
      side: side.name,
      cutWidth: stripePaverWidth,
      originalWidth: fullSize.width,
      pairIndex: 0,
    });

    // Add second stripe paver (mirror of first)
    const stripe2Position = {
      x: stripe1Position.x + Math.cos(angle) * (stripePaverWidth + GROUT_WIDTH),
      y: stripe1Position.y + Math.sin(angle) * (stripePaverWidth + GROUT_WIDTH),
    };

    layout.stripePavers.push({
      id: `stripe-${side.name}-2`,
      position: stripe2Position,
      size: { width: stripePaverWidth, height: fullSize.height },
      rotation: (angle * 180) / Math.PI,
      type: 'stripe',
      side: side.name,
      cutWidth: stripePaverWidth,
      originalWidth: fullSize.width,
      pairIndex: 1,
    });

    // Record measurements for this side
    layout.measurements.sides[side.name] = {
      fullPavers: totalFullPavers,
      stripeWidth: stripePaverWidth,
    };
  });

  // STEP 5: Calculate totals
  layout.measurements.fullPavers = layout.fullPavers.length;
  layout.measurements.stripePavers = layout.stripePavers.length;
  layout.measurements.totalPavers = 
    layout.cornerPavers.length + 
    layout.fullPavers.length + 
    layout.stripePavers.length;

  // Calculate total area and perimeter
  layout.measurements.totalArea = calculateTotalArea(layout);
  layout.measurements.copingPerimeter = calculatePerimeter(poolOutline);

  return layout;
}

// Helper functions
function findCorners(outline: Point[]): Point[] {
  // For rectangular pools, find the 4 corners
  if (outline.length === 4) {
    return outline;
  }
  
  // For complex shapes, detect corners based on angle changes
  // Find points with significant direction changes (> 45 degrees)
  const corners: Point[] = [];
  const threshold = Math.PI / 4; // 45 degrees
  
  for (let i = 0; i < outline.length; i++) {
    const prev = outline[(i - 1 + outline.length) % outline.length];
    const curr = outline[i];
    const next = outline[(i + 1) % outline.length];
    
    const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    const angleDiff = Math.abs(angle2 - angle1);
    
    if (angleDiff > threshold && angleDiff < Math.PI * 2 - threshold) {
      corners.push(curr);
    }
  }
  
  // If we found exactly 4 corners, great! Otherwise return first 4 points
  return corners.length === 4 ? corners : outline.slice(0, 4);
}

function getCornerRotation(corner: 'NW' | 'NE' | 'SE' | 'SW'): number {
  // Align pavers with waterline at each corner
  const rotations = {
    'NW': 0,
    'NE': 90,
    'SE': 180,
    'SW': 270,
  };
  return rotations[corner];
}

function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function calculateTotalArea(layout: CopingLayout): number {
  let area = 0;
  
  // Corner pavers
  layout.cornerPavers.forEach(p => {
    area += (p.size.width * p.size.height) / 1000000; // mm² to m²
  });
  
  // Full pavers
  layout.fullPavers.forEach(p => {
    area += (p.size.width * p.size.height) / 1000000;
  });
  
  // Stripe pavers (use actual cut width)
  layout.stripePavers.forEach(p => {
    area += ((p.cutWidth || p.size.width) * p.size.height) / 1000000;
  });
  
  return area;
}

function calculatePerimeter(outline: Point[]): number {
  let perimeter = 0;
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    perimeter += distance(outline[i], outline[next]);
  }
  return perimeter / 1000; // mm to m
}

/**
 * Generate coping layout for a given coping option
 * Supports: none, 400x400, 400x600, 600x400
 * All options use 400x400 corner pavers
 */
export function generateCopingForOption(
  poolOutline: Array<{x: number, y: number}>,
  option: CopingOption,
  groutWidth: number = 5
): any | null {
  
  if (option === 'none') {
    return null;
  }

  // All options use 400×400 corners
  const cornerSize = { width: 400, height: 400 };
  
  let fullSize: PaverSize;
  switch (option) {
    case '400x400':
      fullSize = { width: 400, height: 400 };
      break;
    case '400x600':
      fullSize = { width: 400, height: 600 };
      break;
    case '600x400':
      fullSize = { width: 600, height: 400 };
      break;
  }

  // Use existing generateCopingLayout function
  return generateCopingLayout(poolOutline, cornerSize, fullSize);
}
