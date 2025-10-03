export const GRID_CONFIG = {
  spacing: 10, // 100mm at 1:100 scale (1 unit = 100mm)
  visible: true,
  color: '#e5e7eb',
  majorGridEvery: 10, // Darker line every 1000mm (1m)
  majorGridColor: '#cbd5e1',
  scale: 100, // 1:100 scale
};

export const SNAP_CONFIG = {
  enabled: true,
  gridSnap: 10, // Snap to 100mm increments
  tolerance: 5, // pixels
  showSnapIndicator: true,
};

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 4];
export const DEFAULT_ZOOM = 1;
