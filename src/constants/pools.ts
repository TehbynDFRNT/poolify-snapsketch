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

  // 7. Amalfi 9.0 × 3.6m
  {
    id: "amalfi-9x36",
    name: "Amalfi 9.0 × 3.6m",
    length: 9000,
    width: 3600,
    outline: [
      {x: 0, y: 0},
      {x: 9000, y: 0},
      {x: 9000, y: 3300},
      {x: 8000, y: 3600},
      {x: 6500, y: 3600},
      {x: 5500, y: 3500},
      {x: 5500, y: 3300},
      {x: 0, y: 3300},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 6500, y: 3400, label: "SE"},
    deepEnd: {x: 4500, y: 200, label: "DE"},
    color: '#3B82F6'
  },

  // 8. Avellino 6.0 × 4.0m
  {
    id: "avellino-6x4",
    name: "Avellino 6.0 × 4.0m",
    length: 6000,
    width: 4000,
    outline: [
      {x: 0, y: 300},
      {x: 300, y: 0},
      {x: 5700, y: 0},
      {x: 6000, y: 300},
      {x: 6000, y: 3700},
      {x: 5700, y: 4000},
      {x: 300, y: 4000},
      {x: 0, y: 3700},
      {x: 0, y: 300}
    ],
    shallowEnd: {x: 1500, y: 3500, label: "SE"},
    deepEnd: {x: 4500, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 9. Alto 4.5 × 2.75m
  {
    id: "alto-45x275",
    name: "Alto 4.5 × 2.75m",
    length: 4500,
    width: 2750,
    outline: [
      {x: 0, y: 200},
      {x: 200, y: 0},
      {x: 4300, y: 0},
      {x: 4500, y: 200},
      {x: 4500, y: 2550},
      {x: 4300, y: 2750},
      {x: 200, y: 2750},
      {x: 0, y: 2550},
      {x: 0, y: 200}
    ],
    shallowEnd: {x: 1000, y: 2500, label: "SE"},
    deepEnd: {x: 3500, y: 300, label: "DE"},
    color: '#3B82F6'
  },

  // 10. Westminister 9.0 × 4.0m
  {
    id: "westminister-9x4",
    name: "Westminister 9.0 × 4.0m",
    length: 9000,
    width: 4000,
    outline: [
      {x: 400, y: 0},
      {x: 8600, y: 0},
      {x: 9000, y: 400},
      {x: 9000, y: 3700},
      {x: 8700, y: 4000},
      {x: 400, y: 4000},
      {x: 0, y: 3600},
      {x: 0, y: 300},
      {x: 400, y: 0}
    ],
    shallowEnd: {x: 1500, y: 3500, label: "SE"},
    deepEnd: {x: 7500, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 11. Allure 5.0 × 2.5m
  {
    id: "allure-5x25",
    name: "Allure 5.0 × 2.5m",
    length: 5000,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 300, y: 0},
      {x: 300, y: 200},
      {x: 400, y: 200},
      {x: 400, y: 0},
      {x: 4600, y: 0},
      {x: 4600, y: 200},
      {x: 4700, y: 200},
      {x: 4700, y: 0},
      {x: 5000, y: 0},
      {x: 5000, y: 2500},
      {x: 4700, y: 2500},
      {x: 4700, y: 2300},
      {x: 4600, y: 2300},
      {x: 4600, y: 2500},
      {x: 400, y: 2500},
      {x: 400, y: 2300},
      {x: 300, y: 2300},
      {x: 300, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 350, y: 2000, label: "SE"},
    deepEnd: {x: 4650, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 12. Verona 4.5 × 2.5m
  {
    id: "verona-45x25",
    name: "Verona 4.5 × 2.5m",
    length: 4500,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 300, y: 0},
      {x: 500, y: 200},
      {x: 4500, y: 200},
      {x: 4500, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 1000, y: 2200, label: "SE"},
    deepEnd: {x: 3500, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 13. Terazza 7.3 × 3.3m
  {
    id: "terazza-73x33",
    name: "Terazza 7.3 × 3.3m",
    length: 7300,
    width: 3300,
    outline: [
      {x: 0, y: 0},
      {x: 200, y: 0},
      {x: 200, y: 300},
      {x: 400, y: 300},
      {x: 400, y: 0},
      {x: 7300, y: 0},
      {x: 7300, y: 3000},
      {x: 7100, y: 3300},
      {x: 0, y: 3300},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 300, y: 2800, label: "SE"},
    deepEnd: {x: 6000, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 14. Valentina 8.0 × 4.0m
  {
    id: "valentina-8x4",
    name: "Valentina 8.0 × 4.0m",
    length: 8000,
    width: 4000,
    outline: [
      {x: 0, y: 300},
      {x: 300, y: 0},
      {x: 7700, y: 0},
      {x: 8000, y: 300},
      {x: 8000, y: 3700},
      {x: 7700, y: 4000},
      {x: 300, y: 4000},
      {x: 0, y: 3700},
      {x: 0, y: 300}
    ],
    shallowEnd: {x: 2000, y: 3500, label: "SE"},
    deepEnd: {x: 6000, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 15. Ultimo 11.0 × 2.5m
  {
    id: "ultimo-11x25",
    name: "Ultimo 11.0 × 2.5m",
    length: 11000,
    width: 2500,
    outline: [
      {x: 300, y: 0},
      {x: 500, y: 0},
      {x: 600, y: 100},
      {x: 10400, y: 100},
      {x: 10500, y: 0},
      {x: 10700, y: 0},
      {x: 11000, y: 300},
      {x: 11000, y: 2500},
      {x: 10700, y: 2500},
      {x: 10500, y: 2500},
      {x: 10400, y: 2400},
      {x: 600, y: 2400},
      {x: 500, y: 2500},
      {x: 300, y: 2500},
      {x: 0, y: 2200},
      {x: 0, y: 300},
      {x: 300, y: 0}
    ],
    deepEnd: {x: 400, y: 1250, label: "DE"},
    shallowEnd: {x: 10600, y: 1250, label: "SE"},
    color: '#3B82F6'
  },

  // 16. Sovereign 5.0 × 2.7m
  {
    id: "sovereign-5x27",
    name: "Sovereign 5.0 × 2.7m",
    length: 5000,
    width: 2700,
    outline: [
      {x: 0, y: 0},
      {x: 5000, y: 0},
      {x: 5000, y: 2700},
      {x: 300, y: 2700},
      {x: 0, y: 2400},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 1500, y: 2400, label: "SE"},
    deepEnd: {x: 4000, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 17. Portofino 5.5 × 2.5m
  {
    id: "portofino-55x25",
    name: "Portofino 5.5 × 2.5m",
    length: 5500,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 300, y: 0},
      {x: 500, y: 200},
      {x: 5500, y: 200},
      {x: 5500, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 1500, y: 2200, label: "SE"},
    deepEnd: {x: 4500, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 18. Palazzo 7.0 × 3.5m
  {
    id: "palazzo-7x35",
    name: "Palazzo 7.0 × 3.5m",
    length: 7000,
    width: 3500,
    outline: [
      {x: 0, y: 300},
      {x: 300, y: 0},
      {x: 6700, y: 0},
      {x: 7000, y: 300},
      {x: 7000, y: 3500},
      {x: 0, y: 3500},
      {x: 0, y: 300}
    ],
    shallowEnd: {x: 1500, y: 3200, label: "SE"},
    deepEnd: {x: 5500, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 19. Serenity 4.0 × 2.5m
  {
    id: "serenity-4x25",
    name: "Serenity 4.0 × 2.5m",
    length: 4000,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 4000, y: 0},
      {x: 4000, y: 300},
      {x: 3800, y: 300},
      {x: 3800, y: 500},
      {x: 4000, y: 500},
      {x: 4000, y: 2500},
      {x: 3800, y: 2500},
      {x: 3800, y: 2200},
      {x: 3600, y: 2200},
      {x: 3600, y: 2500},
      {x: 400, y: 2500},
      {x: 400, y: 2200},
      {x: 200, y: 2200},
      {x: 200, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 500},
      {x: 200, y: 500},
      {x: 200, y: 300},
      {x: 400, y: 300},
      {x: 400, y: 0}
    ],
    deepEnd: {x: 300, y: 1250, label: "DE"},
    shallowEnd: {x: 3700, y: 1250, label: "SE"},
    color: '#3B82F6'
  },

  // 20. Sheffield 8.0 × 3.0m
  {
    id: "sheffield-8x3",
    name: "Sheffield 8.0 × 3.0m",
    length: 8000,
    width: 3000,
    outline: [
      {x: 0, y: 0},
      {x: 8000, y: 0},
      {x: 8000, y: 2700},
      {x: 7800, y: 3000},
      {x: 300, y: 3000},
      {x: 0, y: 2700},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 1500, y: 2700, label: "SE"},
    deepEnd: {x: 6500, y: 500, label: "DE"},
    color: '#3B82F6'
  },

  // 21. Saint-Louis 9.5 × 4.0m
  {
    id: "saintlouis-95x4",
    name: "Saint-Louis 9.5 × 4.0m",
    length: 9500,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 9500, y: 0},
      {x: 9500, y: 4000},
      {x: 600, y: 4000},
      {x: 600, y: 3800},
      {x: 400, y: 3800},
      {x: 400, y: 3600},
      {x: 300, y: 3600},
      {x: 300, y: 3400},
      {x: 200, y: 3400},
      {x: 200, y: 3200},
      {x: 600, y: 3200},
      {x: 600, y: 2700},
      {x: 400, y: 2700},
      {x: 400, y: 2500},
      {x: 200, y: 2500},
      {x: 200, y: 1500},
      {x: 400, y: 1500},
      {x: 400, y: 1200},
      {x: 600, y: 1200},
      {x: 600, y: 800},
      {x: 800, y: 800},
      {x: 800, y: 600},
      {x: 1000, y: 600},
      {x: 1000, y: 400},
      {x: 1200, y: 400},
      {x: 1200, y: 200},
      {x: 1400, y: 200},
      {x: 1400, y: 0},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 400, y: 3500, label: "SE"},
    deepEnd: {x: 8000, y: 500, label: "DE"},
    color: '#3B82F6'
  }
];
