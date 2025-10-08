import jsPDF from 'jspdf';
import { Project, ExportOptions, Component } from '@/types';
import { calculateMeasurements, formatLength, formatArea } from './measurements';

// PDF Layout Constants
const LAYOUT = {
  format: 'a4',
  orientation: 'landscape' as const,
  unit: 'mm',
  pageWidth: 297,
  pageHeight: 210,
  margins: {
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
  },
  header: {
    height: 20,
  },
  drawing: {
    x: 5,
    y: 26,
    width: 287,
    height: 145,
    padding: 2.5,
  },
  legendOverlay: {
    x: 232,
    y: 31,
    width: 50,
    height: 55,
  },
  summary: {
    x: 5,
    y: 171,
    width: 287,
    height: 34,
  },
};

// Color Constants (RGB) - Using tuples for TypeScript compatibility
const COLORS = {
  text: {
    primary: [0, 0, 0] as [number, number, number],
    secondary: [55, 65, 81] as [number, number, number],
    tertiary: [107, 114, 128] as [number, number, number],
  },
  borders: {
    light: [229, 231, 235] as [number, number, number],
    medium: [204, 204, 204] as [number, number, number],
    dark: [156, 163, 175] as [number, number, number],
  },
  legend: {
    pool: [59, 130, 246] as [number, number, number],
    coping: [148, 163, 184] as [number, number, number],
    paving: [253, 230, 138] as [number, number, number],
    drainage: [107, 114, 128] as [number, number, number],
    fencing: [96, 165, 250] as [number, number, number],
    wall: [146, 64, 14] as [number, number, number],
    boundary: [30, 41, 59] as [number, number, number],
    house: [0, 0, 0] as [number, number, number],
  },
};

export const exportToPDF = async (
  project: Project,
  canvasElement: HTMLCanvasElement,
  options: ExportOptions
): Promise<void> => {
  // Initialize PDF with landscape orientation
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Draw all sections
  drawHeader(pdf, project, options);
  drawCanvas(pdf, canvasElement);
  drawLegendOverlay(pdf, options);
  drawMaterialsSummary(pdf, project, options);

  // Add notes on second page if present
  if (project.notes && project.notes.trim().length > 0) {
    pdf.addPage();
    drawNotesPage(pdf, project);
  }

  // Save the PDF
  const fileName = `${project.customerName.replace(/\s+/g, '_')}_PoolDesign.pdf`;
  pdf.save(fileName);
};

// ===== HEADER SECTION =====
const drawHeader = (pdf: jsPDF, project: Project, options: ExportOptions) => {
  const { left, top } = LAYOUT.margins;
  const pageWidth = LAYOUT.pageWidth;

  // Customer name/title
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...COLORS.text.primary);
  pdf.text(`Pool Design - ${project.customerName}`, left, top + 8);

  // Address
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...COLORS.text.secondary);
  pdf.text(project.address, left, top + 14);

  // Scale (left side)
  pdf.setTextColor(...COLORS.text.tertiary);
  pdf.text(`Scale: ${options.scale}`, left, top + 19);

  // Date (right side)
  const date = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  pdf.text(`Date: ${date}`, pageWidth - LAYOUT.margins.right, top + 19, { align: 'right' });

  // Bottom border line
  pdf.setDrawColor(...COLORS.text.primary);
  pdf.setLineWidth(0.5);
  pdf.line(left, top + LAYOUT.header.height, pageWidth - LAYOUT.margins.right, top + LAYOUT.header.height);

  // Reset text color
  pdf.setTextColor(...COLORS.text.primary);
};

// ===== DRAWING AREA SECTION =====
const drawCanvas = (pdf: jsPDF, canvasElement: HTMLCanvasElement) => {
  const { x, y, width, height, padding } = LAYOUT.drawing;

  // Draw border around drawing area
  pdf.setDrawColor(...COLORS.borders.medium);
  pdf.setLineWidth(0.5);
  pdf.rect(x, y, width, height);

  try {
    // Get canvas as image
    const canvasImage = canvasElement.toDataURL('image/png', 1.0);

    // Calculate scaling to fit within drawing area (with padding)
    const maxWidth = width - padding * 2;
    const maxHeight = height - padding * 2;
    const canvasAspect = canvasElement.width / canvasElement.height;
    const targetAspect = maxWidth / maxHeight;

    let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

    if (canvasAspect > targetAspect) {
      // Canvas is wider - fit to width
      drawWidth = maxWidth;
      drawHeight = maxWidth / canvasAspect;
      offsetX = x + padding;
      offsetY = y + padding + (maxHeight - drawHeight) / 2;
    } else {
      // Canvas is taller - fit to height
      drawHeight = maxHeight;
      drawWidth = maxHeight * canvasAspect;
      offsetX = x + padding + (maxWidth - drawWidth) / 2;
      offsetY = y + padding;
    }

    // Add the canvas image
    pdf.addImage(canvasImage, 'PNG', offsetX, offsetY, drawWidth, drawHeight);
  } catch (error) {
    console.error('Failed to add canvas to PDF:', error);
    // Draw error message in center
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.text.tertiary);
    pdf.text('Failed to render drawing', x + width / 2, y + height / 2, { align: 'center' });
    pdf.setTextColor(...COLORS.text.primary);
  }
};

// ===== LEGEND OVERLAY SECTION =====
const drawLegendOverlay = (pdf: jsPDF, options: ExportOptions) => {
  if (!options.includeLegend) return;

  const { x, y, width, height } = LAYOUT.legendOverlay;
  const padding = 3;

  // White background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, width, height, 'F');

  // Border
  pdf.setDrawColor(...COLORS.text.primary);
  pdf.setLineWidth(0.5);
  pdf.rect(x, y, width, height);

  // Title
  let currentY = y + 5;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...COLORS.text.primary);
  pdf.text('LEGEND', x + padding, currentY);

  // Legend items (compact)
  currentY += 5;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');

  const legendItems = [
    { color: COLORS.legend.pool, label: 'Pool' },
    { color: COLORS.legend.coping, label: 'Coping' },
    { color: COLORS.legend.paving, label: 'Paving' },
    { color: COLORS.legend.drainage, label: 'Drainage' },
    { color: COLORS.legend.fencing, label: 'Fencing' },
    { color: COLORS.legend.wall, label: 'Wall' },
    { color: COLORS.legend.boundary, label: 'Boundary' },
    { color: COLORS.legend.house, label: 'House' },
  ];

  legendItems.forEach((item) => {
    const colorBoxWidth = 6;
    const colorBoxHeight = 4;
    const colorBoxMargin = 2;

    // Draw color box
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.rect(x + padding, currentY - 2.5, colorBoxWidth, colorBoxHeight, 'F');

    // Draw label
    pdf.setTextColor(...COLORS.text.primary);
    pdf.text(item.label, x + padding + colorBoxWidth + colorBoxMargin, currentY);

    currentY += 5;
  });
};

// ===== MATERIALS SUMMARY SECTION =====
const drawMaterialsSummary = (pdf: jsPDF, project: Project, options: ExportOptions) => {
  if (!options.includeSummary) return;

  const { x, y, width, height } = LAYOUT.summary;
  const padding = 3;

  // Background (light gray)
  pdf.setFillColor(249, 250, 251);
  pdf.rect(x, y, width, height, 'F');

  // Top border
  pdf.setDrawColor(...COLORS.text.primary);
  pdf.setLineWidth(1);
  pdf.line(x, y, x + width, y);

  // Title
  let textY = y + 6;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...COLORS.text.primary);
  pdf.text('MATERIALS SUMMARY', x + padding, textY);

  textY += 5;

  // Calculate materials
  const summary = calculateMeasurements(project.components);

  // Build summary text (inline format with separators)
  const summaryParts: string[] = [];

  // === POOLS ===
  if (summary.pools.length > 0) {
    summary.pools.forEach((pool) => {
      summaryParts.push(`Pools: ${pool.type} (${pool.dimensions})`);
      
      if (pool.coping) {
        summaryParts.push(
          `Coping: ${pool.coping.totalPavers} pavers (400×400mm) - ` +
          `${pool.coping.fullPavers} full + ${pool.coping.partialPavers} partial = ${formatArea(pool.coping.area)}`
        );
      }
    });
  }

  // === PAVING ===
  if (summary.paving.length > 0) {
    summary.paving.forEach((paver) => {
      summaryParts.push(
        `Paving: ${paver.size} - ${paver.count} pavers ` +
        `(${paver.fullPavers} full + ${paver.partialPavers} partial) = ` +
        `${formatArea(paver.area)} - Wastage: ${paver.wastage}%`
      );
    });
  }

  // === DRAINAGE ===
  if (summary.drainage.length > 0) {
    summary.drainage.forEach((drain) => {
      summaryParts.push(
        `Drainage: ${drain.type} - ${formatLength(drain.length)} ` +
        `(${((drain.length / 1000) * 0.1).toFixed(2)} m³)`
      );
    });
  }

  // === FENCING ===
  if (summary.fencing.length > 0) {
    const fenceParts = summary.fencing.map(f => (f.length / 1000).toFixed(1) + 'm').join(' + ');
    const totalLength = summary.fencing.reduce((sum, f) => sum + f.length / 1000, 0);
    const totalGates = summary.fencing.reduce((sum, f) => sum + f.gates, 0);
    
    summaryParts.push(
      `Fencing: ${summary.fencing[0].type} ${fenceParts} = ${totalLength.toFixed(1)}m ` +
      `(${totalGates} gates)`
    );
  }

  // === WALLS ===
  if (summary.walls.length > 0) {
    summary.walls.forEach((wall) => {
      summaryParts.push(
        `Walls: ${wall.material} ${formatLength(wall.length)} (H: ${formatLength(wall.height)})`
      );
    });
  }

  // Join with separator and wrap text
  const summaryText = summaryParts.join(' │ ');
  
  // Word wrap the summary text
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...COLORS.text.primary);
  
  const lines = pdf.splitTextToSize(summaryText, width - 6);
  
  lines.forEach((line: string, index: number) => {
    if (textY + (index * 4) < y + height - 3) {
      pdf.text(line, x + padding, textY + (index * 4));
    }
  });
};

// ===== NOTES PAGE (if present) =====
const drawNotesPage = (pdf: jsPDF, project: Project) => {
  const margin = 15;
  const contentWidth = LAYOUT.pageWidth - 2 * margin;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...COLORS.text.primary);
  pdf.text('Project Notes', margin, margin + 10);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const splitNotes = pdf.splitTextToSize(project.notes || '', contentWidth);
  pdf.text(splitNotes, margin, margin + 18);
};
