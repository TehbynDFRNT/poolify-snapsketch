import { Pool, CopingConfig, calculatePoolCoping } from './copingCalculation';
import { CopingPaverData } from '@/types/copingSelection';

/**
 * Generate paver data with unique IDs and classification for all base coping pavers
 */
export function generateCopingPaverData(
  pool: Pool,
  config: CopingConfig
): CopingPaverData[] {
  const calc = calculatePoolCoping(pool, config);
  const pavers: CopingPaverData[] = [];
  
  // Normalize config to support both legacy and new formats
  const tileX = (config.tile as any).x ?? (config.tile as any).along ?? 400;
  const tileY = (config.tile as any).y ?? (config.tile as any).inward ?? 400;
  
  // Helper to determine if a paver is at a corner - uses center point for better detection
  const isCornerPaver = (
    edge: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean => {
    const tolerance = 10; // mm - increased for better detection
    
    // Use paver center point for more reliable detection
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // Account for negative coordinates (pavers extending beyond pool origin)
    const poolLeft = 0;
    const poolRight = pool.length;
    const poolTop = 0;
    const poolBottom = pool.width;
    
    // Check if center is in a corner zone (both horizontally and vertically at edges)
    const isAtLeftEdge = centerX <= poolLeft + tolerance || centerX < 0;
    const isAtRightEdge = centerX >= poolRight - tolerance;
    const isAtTopEdge = centerY <= poolTop + tolerance || centerY < 0;
    const isAtBottomEdge = centerY >= poolBottom - tolerance;
    
    // Corner if at BOTH a horizontal and vertical edge
    return (isAtLeftEdge || isAtRightEdge) && (isAtTopEdge || isAtBottomEdge);
  };
  
  // Process each edge
  type EdgeKey = 'deepEnd' | 'shallowEnd' | 'leftSide' | 'rightSide';
  const edges: EdgeKey[] = ['deepEnd', 'shallowEnd', 'leftSide', 'rightSide'];
  
  edges.forEach((edge) => {
    const edgeData = calc[edge];
    const positions = edgeData.paverPositions;
    
    // Determine row count based on config
    const rowCount = edge === 'deepEnd' ? config.rows.deep :
                     edge === 'shallowEnd' ? config.rows.shallow :
                     config.rows.sides;
    
    positions.forEach((paver, idx) => {
      // Calculate row index from position
      // For horizontal edges (sides), rows go outward in Y
      // For vertical edges (ends), rows go outward in X
      let rowIndex = 0;
      if (edge === 'leftSide' || edge === 'rightSide') {
        // Sides: Y position determines row
        const rowDepth = tileY;
        if (Number.isFinite(rowDepth) && rowDepth > 0) {
          rowIndex = Math.floor(Math.abs(paver.y < 0 ? paver.y : paver.y - pool.width) / rowDepth);
        }
      } else {
        // Ends: X position determines row
        const rowDepth = tileX;
        if (Number.isFinite(rowDepth) && rowDepth > 0) {
          rowIndex = Math.floor(Math.abs(paver.x < 0 ? paver.x : paver.x - pool.length) / rowDepth);
        }
      }
      
      // Ensure rowIndex is valid
      rowIndex = Math.max(0, rowIndex);
      
      const isCorner = isCornerPaver(edge, paver.x, paver.y, paver.width, paver.height);
      
      pavers.push({
        id: `${edge}-r${rowIndex}-c${idx}`,
        x: paver.x,
        y: paver.y,
        width: paver.width,
        height: paver.height,
        isPartial: paver.isPartial,
        edge: edge as 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd',
        rowIndex,
        columnIndex: idx,
        isCorner,
      });
    });
  });
  
  return pavers;
}
