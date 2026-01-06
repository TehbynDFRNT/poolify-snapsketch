// Re-export from centralized tile config for backward compatibility
export { PAVER_SIZES } from './tileConfig';

export const DRAINAGE_TYPES = {
  rock: { width: 100, label: 'Rock Drainage', color: 'hsl(215, 8%, 62%)' },
  ultradrain: { width: 100, label: 'Ultradrain', color: 'hsl(0, 0%, 36%)' },
};

export const FENCE_TYPES = {
  glass: { label: 'Glass Pool Fence', color: '#5DA5DA' },
  metal: { label: 'Metal Pool Fence', color: '#595959' },
  boundary: { label: 'Boundary Fence', color: '#8B6F47' },
};

export const WALL_MATERIALS = {
  timber: { label: 'Timber', color: 'hsl(30, 35%, 40%)' },
  concrete: { label: 'Drop Edge', color: 'hsl(0, 0%, 65%)' },
  concrete_sleeper: { label: 'Concrete Sleeper', color: 'hsl(0, 0%, 55%)' },
  sandstone: { label: 'Sandstone', color: 'hsl(40, 40%, 65%)' },
};

export const GATE_WIDTH = 900; // mm
