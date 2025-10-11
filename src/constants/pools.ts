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
  // 1. Hayman 8.5 × 3.8m
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

  // 2. Infinity 4.0 × 4.0m
  {
    id: "infinity-4x4",
    name: "Infinity 4.0 × 4.0m",
    length: 4000,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 4000, y: 0},
      {x: 4000, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 3850, y: 2000, label: "DE"},
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

  // 4. Latina 4.5 × 3.5m
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

  // 5. Florentina 6.5 × 2.5m
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

  // 6. Elysian 8.3 × 3.3m
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
      {x: 8250, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 8100, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 8. Infinity 3.0 × 3.0m
  {
    id: "infinity-3x3",
    name: "Infinity 3.0 × 3.0m",
    length: 3000,
    width: 3000,
    outline: [
      {x: 0, y: 0},
      {x: 3000, y: 0},
      {x: 3000, y: 3000},
      {x: 0, y: 3000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1500, label: "SE"},
    deepEnd: {x: 2850, y: 1500, label: "DE"},
    color: '#3B82F6'
  },

  // 9. Europa 7.5 × 3.65m
  {
    id: "europa-7.5x3.65",
    name: "Europa 7.5 × 3.65m",
    length: 7500,
    width: 3650,
    outline: [
      {x: 0, y: 0},
      {x: 7500, y: 0},
      {x: 7500, y: 3650},
      {x: 0, y: 3650},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1825, label: "SE"},
    deepEnd: {x: 7350, y: 1825, label: "DE"},
    color: '#3B82F6'
  },

  // 10. Harmony 7.0 × 2.5m
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

  // 11. Oxford 7.0 × 3.0m
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

  // 12. Istana 6.2 × 3.3m
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

  // 13. Empire 6.0 × 3.0m
  {
    id: "empire-6x3",
    name: "Empire 6.0 × 3.0m",
    length: 6000,
    width: 3000,
    outline: [
      {x: 0, y: 0},
      {x: 6000, y: 0},
      {x: 6000, y: 3000},
      {x: 0, y: 3000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1500, label: "SE"},
    deepEnd: {x: 5850, y: 1500, label: "DE"},
    color: '#3B82F6'
  },

  // 14. Imperial 7.0 × 4.0m
  {
    id: "imperial-7x4",
    name: "Imperial 7.0 × 4.0m",
    length: 7000,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 7000, y: 0},
      {x: 7000, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 6850, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 15. Terazza 7.3 × 3.3m
  {
    id: "terazza-7.3x3.3",
    name: "Terazza 7.3 × 3.3m",
    length: 7300,
    width: 3300,
    outline: [
      {x: 0, y: 0},
      {x: 7300, y: 0},
      {x: 7300, y: 3300},
      {x: 0, y: 3300},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1650, label: "SE"},
    deepEnd: {x: 7150, y: 1650, label: "DE"},
    color: '#3B82F6'
  },

  // 16. Bellino 6.5 × 3.6m
  {
    id: "bellino-6.5x3.6",
    name: "Bellino 6.5 × 3.6m",
    length: 6500,
    width: 3600,
    outline: [
      {x: 0, y: 0},
      {x: 6500, y: 0},
      {x: 6500, y: 3600},
      {x: 0, y: 3600},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1800, label: "SE"},
    deepEnd: {x: 6350, y: 1800, label: "DE"},
    color: '#3B82F6'
  },

  // 17. Serenity 4.0 × 2.5m
  {
    id: "serenity-4x2.5",
    name: "Serenity 4.0 × 2.5m",
    length: 4000,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 4000, y: 0},
      {x: 4000, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 3850, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 18. Bedarra 7.5 × 3.8m
  {
    id: "bedarra-7.5x3.8",
    name: "Bedarra 7.5 × 3.8m",
    length: 7500,
    width: 3800,
    outline: [
      {x: 0, y: 0},
      {x: 7500, y: 0},
      {x: 7500, y: 3800},
      {x: 0, y: 3800},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1900, label: "SE"},
    deepEnd: {x: 7350, y: 1900, label: "DE"},
    color: '#3B82F6'
  },

  // 19. Allure 5.0 × 2.5m
  {
    id: "allure-5x2.5",
    name: "Allure 5.0 × 2.5m",
    length: 5000,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 5000, y: 0},
      {x: 5000, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 4850, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 20. Avellino 6.0 × 4.0m
  {
    id: "avellino-6x4",
    name: "Avellino 6.0 × 4.0m",
    length: 6000,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 6000, y: 0},
      {x: 6000, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 5850, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 21. Palazzo 7.0 × 3.5m
  {
    id: "palazzo-7x3.5",
    name: "Palazzo 7.0 × 3.5m",
    length: 7000,
    width: 3500,
    outline: [
      {x: 0, y: 0},
      {x: 7000, y: 0},
      {x: 7000, y: 3500},
      {x: 0, y: 3500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1750, label: "SE"},
    deepEnd: {x: 6850, y: 1750, label: "DE"},
    color: '#3B82F6'
  },

  // 22. Verona 4.5 × 2.5m
  {
    id: "verona-4.5x2.5",
    name: "Verona 4.5 × 2.5m",
    length: 4500,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 4500, y: 0},
      {x: 4500, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 4350, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 23. Saint-Louis 9.5 × 4.0m
  {
    id: "saintlouis-9.5x4",
    name: "Saint - Louis 9.5 × 4.0m",
    length: 9500,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 9500, y: 0},
      {x: 9500, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 9350, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 24. Bellagio 7.5 × 2.5m
  {
    id: "bellagio-7.5x2.5",
    name: "Bellagio 7.5 × 2.5m",
    length: 7500,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 7500, y: 0},
      {x: 7500, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 7350, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 25. Caprice 8.0 × 3.0m
  {
    id: "caprice-8x3",
    name: "Caprice 8.0 × 3.0m",
    length: 8000,
    width: 3000,
    outline: [
      {x: 0, y: 0},
      {x: 8000, y: 0},
      {x: 8000, y: 3000},
      {x: 0, y: 3000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1500, label: "SE"},
    deepEnd: {x: 7850, y: 1500, label: "DE"},
    color: '#3B82F6'
  },

  // 26. Sheffield 8.0 × 3.0m
  {
    id: "sheffield-8x3",
    name: "Sheffield 8.0 × 3.0m",
    length: 8000,
    width: 3000,
    outline: [
      {x: 0, y: 0},
      {x: 8000, y: 0},
      {x: 8000, y: 3000},
      {x: 0, y: 3000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1500, label: "SE"},
    deepEnd: {x: 7850, y: 1500, label: "DE"},
    color: '#3B82F6'
  },

  // 27. Westminister 9.0 × 4.0m
  {
    id: "westminister-9x4",
    name: "Westminister 9.0 × 4.0m",
    length: 9000,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 9000, y: 0},
      {x: 9000, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 8850, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 28. Portofino 5.5 × 2.5m
  {
    id: "portofino-5.5x2.5",
    name: "Portofino 5.5 × 2.5m",
    length: 5500,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 5500, y: 0},
      {x: 5500, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 5350, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 29. Valentina 8.0 × 4.0m
  {
    id: "valentina-8x4",
    name: "Valentina 8.0 × 4.0m",
    length: 8000,
    width: 4000,
    outline: [
      {x: 0, y: 0},
      {x: 8000, y: 0},
      {x: 8000, y: 4000},
      {x: 0, y: 4000},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 2000, label: "SE"},
    deepEnd: {x: 7850, y: 2000, label: "DE"},
    color: '#3B82F6'
  },

  // 30. Sovereign 5.0 × 2.7m
  {
    id: "sovereign-5x2.7",
    name: "Sovereign 5.0 × 2.7m",
    length: 5000,
    width: 2700,
    outline: [
      {x: 0, y: 0},
      {x: 5000, y: 0},
      {x: 5000, y: 2700},
      {x: 0, y: 2700},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1350, label: "SE"},
    deepEnd: {x: 4850, y: 1350, label: "DE"},
    color: '#3B82F6'
  },

  // 31. Castello 7.5 × 3.6m
  {
    id: "castello-7.5x3.6",
    name: "Castello 7.5 × 3.6m",
    length: 7500,
    width: 3600,
    outline: [
      {x: 0, y: 0},
      {x: 7500, y: 0},
      {x: 7500, y: 3600},
      {x: 0, y: 3600},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1800, label: "SE"},
    deepEnd: {x: 7350, y: 1800, label: "DE"},
    color: '#3B82F6'
  },

  // 32. Ultimo 11.0 × 2.5m
  {
    id: "ultimo-11x2.5",
    name: "Ultimo 11.0 × 2.5m",
    length: 11000,
    width: 2500,
    outline: [
      {x: 0, y: 0},
      {x: 11000, y: 0},
      {x: 11000, y: 2500},
      {x: 0, y: 2500},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1250, label: "SE"},
    deepEnd: {x: 10850, y: 1250, label: "DE"},
    color: '#3B82F6'
  },

  // 33. Alto 4.5 × 2.75m
  {
    id: "alto-4.5x2.75",
    name: "Alto 4.5 × 2.75m",
    length: 4500,
    width: 2750,
    outline: [
      {x: 0, y: 0},
      {x: 4500, y: 0},
      {x: 4500, y: 2750},
      {x: 0, y: 2750},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1375, label: "SE"},
    deepEnd: {x: 4350, y: 1375, label: "DE"},
    color: '#3B82F6'
  },

  // 34. Amalfi 9.0 × 3.6m
  {
    id: "amalfi-9x3.6",
    name: "Amalfi 9.0 × 3.6m",
    length: 9000,
    width: 3600,
    outline: [
      {x: 0, y: 0},
      {x: 9000, y: 0},
      {x: 9000, y: 3600},
      {x: 0, y: 3600},
      {x: 0, y: 0}
    ],
    shallowEnd: {x: 150, y: 1800, label: "SE"},
    deepEnd: {x: 8850, y: 1800, label: "DE"},
    color: '#3B82F6'
  }
];
