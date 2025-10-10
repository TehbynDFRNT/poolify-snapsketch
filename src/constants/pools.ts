// Complete Pool Library - MFP Easy Fibreglass Pools
// All measurements at 1:100 scale (1 unit = 1mm in real world)

interface Point {
  x: number;
  y: number;
}

interface PoolFeature {
  type: string;
  position?: string;
  width?: number;
  depth?: number;
  coordinates?: Point[];
  steps?: number;
  tiers?: number;
  cutSize?: number;
  radius?: number;
  count?: number;
  positions?: string[];
}

export interface Pool {
  id: string;
  name: string;
  length?: number;
  width?: number;
  diameter?: number;
  radius?: number;
  shape: "rectangular" | "circular" | "custom";
  shallowEnd: Point;
  deepEnd: Point;
  color: string;
  outline: Point[];
  features?: {
    entrySteps?: PoolFeature;
    angledCorner?: PoolFeature;
    angledCorners?: PoolFeature;
    bench?: PoolFeature;
    swimOutLedge?: PoolFeature;
    innerBench?: PoolFeature;
    centerDeep?: PoolFeature;
  };
}

export const POOL_LIBRARY: Pool[] = [
  {
    id: "bedarra-7.5x3.8",
    name: "Bedarra",
    length: 7500,
    width: 3800,
    shape: "custom",
    shallowEnd: {x: 500, y: 1900},
    deepEnd: {x: 7000, y: 1900},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 400, y: 0},{x: 400, y: 600},{x: 800, y: 600},{x: 800, y: 1200},{x: 1200, y: 1200},{x: 1200, y: 1800},{x: 7500, y: 1800},{x: 7500, y: 3800},{x: 5800, y: 3800},{x: 5800, y: 3200},{x: 5200, y: 3200},{x: 5200, y: 2600},{x: 4600, y: 2600},{x: 4600, y: 3800},{x: 0, y: 3800},{x: 0, y: 0}]
  },
  {
    id: "bellagio-7.5x2.5",
    name: "Bellagio",
    length: 7500,
    width: 2500,
    shape: "custom",
    shallowEnd: {x: 500, y: 1250},
    deepEnd: {x: 7000, y: 1250},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 300, y: 0},{x: 500, y: 200},{x: 7500, y: 200},{x: 7500, y: 2500},{x: 0, y: 2500},{x: 0, y: 0}]
  },
  {
    id: "bellino-6.5x3.6",
    name: "Bellino",
    length: 6500,
    width: 3600,
    shape: "custom",
    shallowEnd: {x: 3250, y: 300},
    deepEnd: {x: 6200, y: 1800},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 2750, y: 0},{x: 2750, y: 600},{x: 3150, y: 600},{x: 3150, y: 1200},{x: 3750, y: 1200},{x: 3750, y: 0},{x: 6500, y: 0},{x: 6500, y: 3600},{x: 6200, y: 3600},{x: 5900, y: 3300},{x: 5900, y: 600},{x: 0, y: 600},{x: 0, y: 0}]
  },
  {
    id: "caprice-8x3",
    name: "Caprice",
    length: 8000,
    width: 3000,
    shape: "custom",
    shallowEnd: {x: 200, y: 2700},
    deepEnd: {x: 7800, y: 150},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 300, y: 0},{x: 600, y: 300},{x: 7700, y: 300},{x: 8000, y: 0},{x: 8000, y: 2500},{x: 7600, y: 2500},{x: 7600, y: 2900},{x: 7300, y: 2900},{x: 7300, y: 3000},{x: 400, y: 3000},{x: 400, y: 2900},{x: 100, y: 2900},{x: 100, y: 2500},{x: 0, y: 2500},{x: 0, y: 0}]
  },
  {
    id: "castello-7.5x3.6",
    name: "Castello",
    length: 7500,
    width: 3600,
    shape: "custom",
    shallowEnd: {x: 4150, y: 2700},
    deepEnd: {x: 350, y: 150},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 400, y: 0},{x: 700, y: 300},{x: 7500, y: 300},{x: 7500, y: 2400},{x: 4750, y: 2400},{x: 4750, y: 3000},{x: 3550, y: 3000},{x: 3550, y: 3600},{x: 0, y: 3600},{x: 0, y: 0}]
  },
  {
    id: "elysian-8.3x3.3",
    name: "Elysian",
    length: 8300,
    width: 3300,
    shape: "custom",
    shallowEnd: {x: 400, y: 300},
    deepEnd: {x: 8000, y: 1650},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 400, y: 0},{x: 400, y: 600},{x: 800, y: 600},{x: 800, y: 3300},{x: 8300, y: 3300},{x: 8300, y: 0},{x: 0, y: 0}]
  },
  {
    id: "empire-6x3",
    name: "Empire",
    length: 6000,
    width: 3000,
    shape: "custom",
    shallowEnd: {x: 300, y: 1350},
    deepEnd: {x: 5700, y: 1350},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 6000, y: 0},{x: 6000, y: 3000},{x: 5700, y: 3000},{x: 5400, y: 2700},{x: 0, y: 2700},{x: 0, y: 0}]
  },
  {
    id: "europa-7.5x3.65",
    name: "Europa",
    length: 7500,
    width: 3650,
    shape: "custom",
    shallowEnd: {x: 300, y: 1825},
    deepEnd: {x: 7200, y: 1825},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 300, y: 0},{x: 600, y: 300},{x: 7200, y: 300},{x: 7500, y: 0},{x: 7500, y: 3350},{x: 7200, y: 3650},{x: 300, y: 3650},{x: 0, y: 3350},{x: 0, y: 0}]
  },
  {
    id: "florentina-6.5x2.5",
    name: "Florentina",
    length: 6500,
    width: 2500,
    shape: "custom",
    shallowEnd: {x: 250, y: 1250},
    deepEnd: {x: 6250, y: 1250},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 300, y: 0},{x: 500, y: 200},{x: 6500, y: 200},{x: 6500, y: 2500},{x: 0, y: 2500},{x: 0, y: 0}]
  },
  {
    id: "grandeur-8.25x4",
    name: "Grandeur",
    length: 8250,
    width: 4000,
    shape: "custom",
    shallowEnd: {x: 4350, y: 2800},
    deepEnd: {x: 8000, y: 300},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 8250, y: 0},{x: 8250, y: 600},{x: 7850, y: 1000},{x: 7850, y: 2400},{x: 5250, y: 2400},{x: 5250, y: 3000},{x: 4050, y: 3000},{x: 4050, y: 3600},{x: 3450, y: 3600},{x: 3450, y: 4000},{x: 0, y: 4000},{x: 0, y: 0}]
  },
  {
    id: "harmony-7x2.5",
    name: "Harmony",
    length: 7000,
    width: 2500,
    shape: "custom",
    shallowEnd: {x: 300, y: 300},
    deepEnd: {x: 6800, y: 1250},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 300, y: 0},{x: 300, y: 300},{x: 600, y: 300},{x: 600, y: 600},{x: 7000, y: 600},{x: 7000, y: 2500},{x: 0, y: 2500},{x: 0, y: 0}]
  },
  {
    id: "hayman-8.5x3.8",
    name: "Hayman",
    length: 8500,
    width: 3800,
    shape: "custom",
    shallowEnd: {x: 8200, y: 2500},
    deepEnd: {x: 500, y: 400},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 600, y: 0},{x: 600, y: 400},{x: 1000, y: 400},{x: 1000, y: 800},{x: 6500, y: 800},{x: 6500, y: 0},{x: 8500, y: 0},{x: 8500, y: 2200},{x: 7900, y: 2200},{x: 7900, y: 2800},{x: 8500, y: 2800},{x: 8500, y: 3800},{x: 0, y: 3800},{x: 0, y: 0}]
  },
  {
    id: "imperial-7x4",
    name: "Imperial",
    length: 7000,
    width: 4000,
    shape: "custom",
    shallowEnd: {x: 3900, y: 3100},
    deepEnd: {x: 6850, y: 300},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 7000, y: 0},{x: 7000, y: 300},{x: 6700, y: 600},{x: 6700, y: 2800},{x: 4200, y: 2800},{x: 4200, y: 3400},{x: 3600, y: 3400},{x: 3600, y: 4000},{x: 0, y: 4000},{x: 0, y: 0}]
  },
  {
    id: "infinity-3x3",
    name: "Infinity (3m)",
    diameter: 3000,
    radius: 1500,
    shape: "circular",
    shallowEnd: {x: 1500, y: 0},
    deepEnd: {x: 1500, y: 3000},
    color: '#3B82F6',
    outline: []
  },
  {
    id: "infinity-4x4",
    name: "Infinity (4m)",
    diameter: 4000,
    radius: 2000,
    shape: "circular",
    shallowEnd: {x: 2000, y: 0},
    deepEnd: {x: 2000, y: 4000},
    color: '#3B82F6',
    outline: []
  },
  {
    id: "istana-6.2x3.3",
    name: "Istana",
    length: 6200,
    width: 3300,
    shape: "custom",
    shallowEnd: {x: 500, y: 200},
    deepEnd: {x: 6000, y: 1650},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 600, y: 0},{x: 600, y: 400},{x: 1000, y: 400},{x: 1000, y: 3300},{x: 6200, y: 3300},{x: 6200, y: 0},{x: 0, y: 0}]
  },
  {
    id: "kensington-11x4",
    name: "Kensington",
    length: 11000,
    width: 4000,
    shape: "custom",
    shallowEnd: {x: 300, y: 1850},
    deepEnd: {x: 10700, y: 1850},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 11000, y: 0},{x: 11000, y: 4000},{x: 10700, y: 4000},{x: 10400, y: 3700},{x: 0, y: 3700},{x: 0, y: 0}]
  },
  {
    id: "latina-4.5x3.5",
    name: "Latina",
    length: 4500,
    width: 3500,
    shape: "custom",
    shallowEnd: {x: 300, y: 1750},
    deepEnd: {x: 4200, y: 1750},
    color: '#3B82F6',
    outline: [{x: 200, y: 0},{x: 4300, y: 0},{x: 4500, y: 200},{x: 4500, y: 3300},{x: 4300, y: 3500},{x: 200, y: 3500},{x: 0, y: 3300},{x: 0, y: 200},{x: 200, y: 0}]
  },
  {
    id: "oxford-7x3",
    name: "Oxford",
    length: 7000,
    width: 3000,
    shape: "custom",
    shallowEnd: {x: 300, y: 1350},
    deepEnd: {x: 6700, y: 1350},
    color: '#3B82F6',
    outline: [{x: 0, y: 0},{x: 7000, y: 0},{x: 7000, y: 3000},{x: 6700, y: 3000},{x: 6400, y: 2700},{x: 0, y: 2700},{x: 0, y: 0}]
  }
];

export function getPoolById(id: string): Pool | undefined {
  return POOL_LIBRARY.find(pool => pool.id === id);
}

export function getPoolsBySize(): Pool[] {
  return [...POOL_LIBRARY].sort((a, b) => {
    const aSize = a.diameter ? a.diameter * a.diameter : (a.length || 0) * (a.width || 0);
    const bSize = b.diameter ? b.diameter * b.diameter : (b.length || 0) * (b.width || 0);
    return aSize - bSize;
  });
}

export function getPoolsByName(): Pool[] {
  return [...POOL_LIBRARY].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPoolSVGPath(pool: Pool): string {
  if (pool.shape === 'circular') {
    const r = pool.radius || 0;
    return `M ${r},0 A ${r},${r} 0 1,1 ${r},${2*r} A ${r},${r} 0 1,1 ${r},0 Z`;
  }
  
  if (pool.outline.length === 0) return '';
  
  return pool.outline.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ') + ' Z';
}
