export const EMPIRE_POOL = {
  id: 'empire-6x3',
  name: 'Empire 6.0 × 3.0m',
  length: 6000, // mm
  width: 3000, // mm
  outline: [
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 2700 },
    { x: 5700, y: 3000 }, // angled corner at SE
    { x: 0, y: 3000 },
    { x: 0, y: 0 },
  ],
  shallowEnd: { x: 0, y: 3000, label: 'SE' },
  deepEnd: { x: 6000, y: 0, label: 'DE' },
  copingWidth: 400, // mm
  color: '#3B82F6',
};

export const PAVER_SIZES = {
  '400x400': { width: 400, height: 400, label: '400×400mm' },
  '400x600': { width: 400, height: 600, label: '400×600mm' },
};

export const DRAINAGE_TYPES = {
  rock: { width: 100, label: 'Rock Drainage', color: '#B8956A' },
  ultradrain: { width: 100, label: 'Ultradrain', color: '#5A5A5A' },
};

export const FENCE_TYPES = {
  glass: { label: 'Glass Pool Fence', color: '#5DA5DA' },
  metal: { label: 'Metal Pool Fence', color: '#595959' },
  boundary: { label: 'Boundary Fence', color: '#8B6F47' },
};

export const WALL_MATERIALS = {
  timber: { label: 'Timber Wall', color: '#8B6F47' },
  concrete: { label: 'Concrete Wall', color: '#8C8C8C' },
};

export const GATE_WIDTH = 900; // mm
