interface Point {
  x: number;
  y: number;
}

interface CopingPaver {
  id: string;
  position: Point;
  dimensions: { width: number; height: number };
  rotation: number;
  type: 'corner' | 'full' | 'stripe_cut';
  original_size: string;
  cut_width?: number;
  notes?: string;
}

interface CopingLayout {
  pavers: CopingPaver[];
  metadata: {
    total_pavers: number;
    corner_pavers: number;
    full_pavers: number;
    stripe_pavers: number;
    total_area_m2: number;
    grout_width_mm: number;
  };
  validation: {
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export async function generateCopingLayout(
  poolOutline: Point[],
  copingType: '400x400' | '600x400_h' | '600x400_v',
  copingWidth: number = 400,
  groutWidth: number = 5
): Promise<CopingLayout> {
  
  const paverSize = getPaverDimensions(copingType);
  const pavers: CopingPaver[] = [];

  // Remove duplicate closing point
  const points = poolOutline[0].x === poolOutline[poolOutline.length - 1].x &&
                 poolOutline[0].y === poolOutline[poolOutline.length - 1].y
    ? poolOutline.slice(0, -1)
    : poolOutline;

  // Assume 4 corners for rectangle
  const corners = points.slice(0, 4);

  // Place corner pavers
  corners.forEach((corner, index) => {
    pavers.push(createCornerPaver(corner, paverSize, index, copingWidth));
  });

  // Fill each side
  for (let i = 0; i < 4; i++) {
    const startCorner = corners[i];
    const endCorner = corners[(i + 1) % 4];
    const sidePavers = fillSide(startCorner, endCorner, paverSize, groutWidth, i);
    pavers.push(...sidePavers);
  }

  const metadata = calculateMetadata(pavers, groutWidth);
  const validation = validateCopingLayout(pavers);

  return {
    pavers,
    metadata,
    validation
  };
}

function getPaverDimensions(type: string) {
  switch(type) {
    case '400x400':
      return { width: 400, height: 400 };
    case '600x400_h':
      return { width: 600, height: 400 };
    case '600x400_v':
      return { width: 400, height: 600 };
    default:
      return { width: 400, height: 400 };
  }
}

function createCornerPaver(
  corner: Point,
  paverSize: { width: number; height: number },
  cornerIndex: number,
  copingWidth: number
): CopingPaver {
  const offset = copingWidth;
  let position = { ...corner };
  
  if (cornerIndex === 0) {
    position.x -= offset;
    position.y -= offset;
  } else if (cornerIndex === 1) {
    position.x += offset;
    position.y -= offset;
  } else if (cornerIndex === 2) {
    position.x += offset;
    position.y += offset;
  } else {
    position.x -= offset;
    position.y += offset;
  }

  return {
    id: crypto.randomUUID(),
    position,
    dimensions: paverSize,
    rotation: 0,
    type: 'corner',
    original_size: `${paverSize.width}x${paverSize.height}`,
    notes: `Corner paver ${cornerIndex + 1}`
  };
}

function fillSide(
  startCorner: Point,
  endCorner: Point,
  paverSize: { width: number; height: number },
  groutWidth: number,
  sideIndex: number
): CopingPaver[] {
  const pavers: CopingPaver[] = [];
  const sideLength = calculateDistance(startCorner, endCorner);
  const paverPlusGrout = paverSize.width + groutWidth;
  
  const maxFullPaversPerSide = Math.floor((sideLength / 2) / paverPlusGrout);
  
  // Full pavers from start
  for (let j = 1; j <= maxFullPaversPerSide; j++) {
    const paver = createFullPaver(
      startCorner,
      endCorner,
      j * paverPlusGrout,
      paverSize,
      sideIndex,
      'start',
      j
    );
    pavers.push(paver);
  }
  
  // Full pavers from end
  for (let j = 1; j <= maxFullPaversPerSide; j++) {
    const paver = createFullPaver(
      endCorner,
      startCorner,
      j * paverPlusGrout,
      paverSize,
      sideIndex,
      'end',
      j
    );
    pavers.push(paver);
  }
  
  const fullPaversLength = maxFullPaversPerSide * 2 * paverPlusGrout;
  const gap = sideLength - fullPaversLength - (paverSize.width * 2);
  
  if (gap > 0) {
    const stripePaverWidth = (gap - groutWidth) / 2;
    
    if (stripePaverWidth >= 150) {
      const stripe1 = createStripePaver(
        startCorner,
        endCorner,
        (maxFullPaversPerSide + 1) * paverPlusGrout,
        stripePaverWidth,
        paverSize.height,
        sideIndex,
        1
      );
      
      const stripe2 = createStripePaver(
        startCorner,
        endCorner,
        (maxFullPaversPerSide + 1) * paverPlusGrout + stripePaverWidth + groutWidth,
        stripePaverWidth,
        paverSize.height,
        sideIndex,
        2
      );
      
      pavers.push(stripe1, stripe2);
    }
  }
  
  return pavers;
}

function createFullPaver(
  startPoint: Point,
  endPoint: Point,
  offset: number,
  paverSize: { width: number; height: number },
  sideIndex: number,
  direction: 'start' | 'end',
  paverNum: number
): CopingPaver {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  const ux = dx / length;
  const uy = dy / length;
  
  const position = {
    x: startPoint.x + ux * offset,
    y: startPoint.y + uy * offset
  };

  return {
    id: crypto.randomUUID(),
    position,
    dimensions: paverSize,
    rotation: Math.atan2(dy, dx) * 180 / Math.PI,
    type: 'full',
    original_size: `${paverSize.width}x${paverSize.height}`,
    notes: `Full paver ${paverNum} - Side ${sideIndex + 1} ${direction}`
  };
}

function createStripePaver(
  startPoint: Point,
  endPoint: Point,
  offset: number,
  width: number,
  height: number,
  sideIndex: number,
  stripeNum: number
): CopingPaver {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  const ux = dx / length;
  const uy = dy / length;
  
  const position = {
    x: startPoint.x + ux * offset,
    y: startPoint.y + uy * offset
  };

  return {
    id: crypto.randomUUID(),
    position,
    dimensions: { width, height },
    rotation: Math.atan2(dy, dx) * 180 / Math.PI,
    type: 'stripe_cut',
    original_size: `${width}x${height}`,
    cut_width: width,
    notes: `Stripe paver ${stripeNum} - Side ${sideIndex + 1} (${Math.round(width)}mm)`
  };
}

function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function calculateMetadata(pavers: CopingPaver[], groutWidth: number) {
  const cornerCount = pavers.filter(p => p.type === 'corner').length;
  const fullCount = pavers.filter(p => p.type === 'full').length;
  const stripeCount = pavers.filter(p => p.type === 'stripe_cut').length;

  const totalArea = pavers.reduce((sum, paver) => {
    const area = (paver.dimensions.width * paver.dimensions.height) / 1000000;
    return sum + area;
  }, 0);

  return {
    total_pavers: pavers.length,
    corner_pavers: cornerCount,
    full_pavers: fullCount,
    stripe_pavers: stripeCount,
    total_area_m2: Math.round(totalArea * 100) / 100,
    grout_width_mm: groutWidth
  };
}

function validateCopingLayout(pavers: CopingPaver[]) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const stripePavers = pavers.filter(p => p.type === 'stripe_cut');
  stripePavers.forEach(sp => {
    if (sp.cut_width && sp.cut_width < 200) {
      warnings.push(`Stripe paver is narrow (${Math.round(sp.cut_width)}mm)`);
    }
    if (sp.cut_width && sp.cut_width < 150) {
      errors.push(`Stripe paver too narrow (${Math.round(sp.cut_width)}mm)`);
    }
  });

  const cornerCount = pavers.filter(p => p.type === 'corner').length;
  if (cornerCount !== 4) {
    errors.push(`Must have exactly 4 corner pavers (found ${cornerCount})`);
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings
  };
}
