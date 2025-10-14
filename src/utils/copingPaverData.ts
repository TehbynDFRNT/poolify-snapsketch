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
  
  // Helper to determine if a paver is at a corner
  const isCornerPaver = (
    edge: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean => {
    const tolerance = 5; // mm
    
    // Check if paver overlaps with any corner region
    if (edge === 'shallowEnd' || edge === 'deepEnd') {
      // For end edges, corners are at the top and bottom
      const atTop = y <= tolerance;
      const atBottom = y + height >= pool.width - tolerance;
      return atTop || atBottom;
    } else {
      // For side edges, corners are at the left and right
      const atLeft = x <= tolerance;
      const atRight = x + width >= pool.length - tolerance;
      return atLeft || atRight;
    }
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
        const rowDepth = config.tile.y;
        rowIndex = Math.floor(Math.abs(paver.y < 0 ? paver.y : paver.y - pool.width) / rowDepth);
      } else {
        // Ends: X position determines row
        const rowDepth = config.tile.x;
        rowIndex = Math.floor(Math.abs(paver.x < 0 ? paver.x : paver.x - pool.length) / rowDepth);
      }
      
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
