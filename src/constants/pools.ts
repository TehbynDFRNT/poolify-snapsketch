export interface Pool {
  id: string;
  name: string;
  length: number; // mm (waterline)
  width: number;  // mm (waterline)
  outline: Array<{x: number, y: number}>;
  shallowEnd: {x: number, y: number, label: string};
  deepEnd: {x: number, y: number, label: string};
  color: string;
}

export const POOL_LIBRARY: Pool[] = [
  // 1. Oxford 7.0 × 3.0m
  {
    id: "oxford-7x3",
    name: "Oxford 7.0 × 3.0m",
    length: 7000,
    width: 3000,
    outline: [
      {x: 0, y: 0},
      {x: 7000, y: 0},
      {x: 7000, y: 3000},
      {x: 0, y: 3000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1500, label: "SE"},
    deepEnd: {x: 6850, y: 1500, label: "DE"},
    color: '#3B82F6'
  },

  // 2. Latina 4.5 × 3.5m
  {
    id: "latina-4.5x3.5",
    name: "Latina 4.5 × 3.5m",
    length: 4500,
    width: 3500,
    outline: [
      {x: 0, y: 0},
      {x: 4500, y: 0},
      {x: 4500, y: 3500},
      {x: 0, y: 3500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1750, label: "SE"},
    deepEnd: {x: 4350, y: 1750, label: "DE"},
    color: '#3B82F6'
  },

  // 3. Kensington 11.0 × 4.0m
  {
    id: "kensington-11x4",
    name: "Kensington 11.0 × 4.0m",
    length: 11000,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 11000, y: 0},
      {x: 11000, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 10850, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 4. Istana 6.2 × 3.3m
  {
    id: "istana-6.2x3.3",
    name: "Istana 6.2 × 3.3m",
    length: 6200,
    width: 3300,
    outline: [
      {x: 0, y: 0},
      {x: 6200, y: 0},
      {x: 6200, y: 3300},
      {x: 0, y: 3300},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1650, label: "SE"},
    deepEnd: {x: 6050, y: 1650, label: "DE"},
    color: '#3B82F6'
  },

  // 5. Hayman 8.5 × 3.8m
  {
    id: "hayman-8.5x3.8",
    name: "Hayman 8.5 × 3.8m",
    length: 8500,
    width: 3800,
    outline: [
      {x: 0, y: 0},
      {x: 8500, y: 0},
      {x: 8500, y: 3800},
      {x: 0, y: 3800},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1900, label: "SE"},
    deepEnd: {x: 8350, y: 1900, label: "DE"},
    color: '#3B82F6'
  },

  // 6. Harmony 7.0 × 2.5m
  {
    id: "harmony-7x2.5",
    name: "Harmony 7.0 × 2.5m",
    length: 7000,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 7000, y: 0},
      {x: 7000, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 6850, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 7. Grandeur 8.25 × 4.0m
  {
    id: "grandeur-8.25x4",
    name: "Grandeur 8.25 × 4.0m",
    length: 8250,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 8250, y: 0},
      {x: 8250, y: 3600},
      {x: 7850, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 8100, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 8. Florentina 6.5 × 2.5m
  {
    id: "florentina-6.5x2.5",
    name: "Florentina 6.5 × 2.5m",
    length: 6500,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 6500, y: 0},
      {x: 6500, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 6350, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 9. Europa 7.5 × 3.65m
  {
    id: "europa-7.5x3.65",
    name: "Europa 7.5 × 3.65m",
    length: 7500,
    width: 3650,
    outline: [
      {x: 0, y: 300},
      {x: 300, y: 0},
      {x: 7200, y: 0},
      {x: 7500, y: 300},
      {x: 7500, y: 3350},
      {x: 7200, y: 3650},
      {x: 300, y: 3650},
      {x: 0, y: 3350},
      {x: 0, y: 300}
    ],
    shallowEnd: {x: 150, y: 1825, label: "SE"},
    deepEnd: {x: 7350, y: 1825, label: "DE"},
    color: '#3B82F6'
  },

  // 10. Empire 6.0 × 3.0m
  {
    id: "empire-6x3",
    name: "Empire 6.0 × 3.0m",
    length: 6000,
    width: 3000,
    outline: [
      {x: 0, y: 0},
      {x: 6000, y: 0},
      {x: 6000, y: 2600},
      {x: 5600, y: 3000},
      {x: 0, y: 3000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1500, label: "SE"},
    deepEnd: {x: 5850, y: 1500, label: "DE"},
    color: '#3B82F6'
  },

  // 11. Elysian 8.3 × 3.3m
  {
    id: "elysian-8.3x3.3",
    name: "Elysian 8.3 × 3.3m",
    length: 8300,
    width: 3300,
    outline: [
      {x: 0, y: 0},
      {x: 8300, y: 0},
      {x: 8300, y: 3300},
      {x: 0, y: 3300},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1650, label: "SE"},
    deepEnd: {x: 8150, y: 1650, label: "DE"},
    color: '#3B82F6'
  }
];
