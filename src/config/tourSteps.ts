export interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  spotlightPadding?: number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="canvas-area"]',
    title: 'Your Design Canvas',
    description:
      'This is where you create your pool and landscaping designs. Click and drag to draw shapes, add components, and build your layout.',
    placement: 'bottom',
    spotlightPadding: 0,
  },
  {
    target: '[data-tour="topbar-views"]',
    title: 'View Toggles',
    description:
      'Switch between Grid, Satellite, Annotations, and Blueprint views to see your design in different ways.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="topbar-save"]',
    title: 'Save Your Work',
    description:
      'Your project auto-saves, but you can manually save anytime with this button or Ctrl+S.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="topbar-export"]',
    title: 'Export Your Design',
    description:
      'Export your finished design as a PDF or image to share with clients.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="toolbar-tools"]',
    title: 'Design Tools',
    description:
      'Select tools to add pools, fences, drainage, walls, and more. Right-click a tool for sub-options.',
    placement: 'right',
  },
  {
    target: '[data-tour="bottom-panel"]',
    title: 'Bottom Panel',
    description:
      'View your materials summary, add project notes, and track measurements here. Drag the top edge to resize.',
    placement: 'top',
  },
  {
    target: '[data-tour="zoom-controls"]',
    title: 'Zoom & Navigation',
    description:
      'Zoom in/out, fit the design to view, or lock the zoom level. Use the scroll wheel for quick zooming.',
    placement: 'top',
  },
  {
    target: '[data-tour="help-button"]',
    title: 'Need Help?',
    description:
      'Click here anytime to see tool guides, keyboard shortcuts, and tips. You can also replay this tour from the help menu.',
    placement: 'left',
  },
];

export const TOUR_STORAGE_KEY = 'snapsketch-tour-completed';
