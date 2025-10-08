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
    width: 200,
    height: 165,
    padding: 2.5,
  },
  sidebar: {
    x: 207,
    y: 26,
    width: 85,
    height: 165,
    gap: 3,
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
  drawLegend(pdf, options);
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

// ===== LEGEND SECTION =====
const drawLegend = (pdf: jsPDF, options: ExportOptions) => {
  if (!options.includeLegend) return;

  const { x, y, width } = LAYOUT.sidebar;
  const padding = 3;
  let currentY = y;

  // Calculate legend height
  const legendItems = [
    { color: COLORS.legend.pool, label: 'Pool' },
    { color: COLORS.legend.coping, label: 'Pool Coping' },
    { color: COLORS.legend.paving, label: 'Paving' },
    { color: COLORS.legend.drainage, label: 'Drainage' },
    { color: COLORS.legend.fencing, label: 'Fencing' },
    { color: COLORS.legend.wall, label: 'Retaining Wall' },
    { color: COLORS.legend.boundary, label: 'Boundary' },
    { color: COLORS.legend.house, label: 'House' },
  ];

  const itemHeight = 6;
  const legendHeight = padding * 2 + 6 + legendItems.length * itemHeight;

  // Draw border
  pdf.setDrawColor(...COLORS.borders.medium);
  pdf.setLineWidth(0.5);
  pdf.rect(x, currentY, width, legendHeight);

  // Title
  currentY += padding + 6;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...COLORS.text.primary);
  pdf.text('LEGEND', x + padding, currentY);

  // Legend items
  currentY += 5;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');

  legendItems.forEach((item) => {
    const colorBoxWidth = 8;
    const colorBoxHeight = 5;
    const colorBoxMargin = 2;

    // Draw color box
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.rect(x + padding, currentY - 3, colorBoxWidth, colorBoxHeight, 'F');

    // Draw label
    pdf.setTextColor(...COLORS.text.primary);
    pdf.text(item.label, x + padding + colorBoxWidth + colorBoxMargin, currentY);

    currentY += itemHeight;
  });

  return legendHeight;
};

// ===== MATERIALS SUMMARY SECTION =====
const drawMaterialsSummary = (pdf: jsPDF, project: Project, options: ExportOptions) => {
  if (!options.includeSummary) return;

  const { x, width, gap } = LAYOUT.sidebar;
  const padding = 3;
  const lineHeight = 3.5;

  // Calculate legend height to position summary below it
  const legendItems = 8; // Number of legend items
  const legendHeight = options.includeLegend ? padding * 2 + 6 + legendItems * 6 : 0;
  const legendGap = options.includeLegend ? gap : 0;

  const summaryY = LAYOUT.sidebar.y + legendHeight + legendGap;
  const summaryHeight = LAYOUT.sidebar.height - legendHeight - legendGap;

  let currentY = summaryY;

  // Draw border
  pdf.setDrawColor(...COLORS.borders.medium);
  pdf.setLineWidth(0.5);
  pdf.rect(x, summaryY, width, summaryHeight);

  // Title
  currentY += padding + 6;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...COLORS.text.primary);
  pdf.text('MATERIALS SUMMARY', x + padding, currentY);

  currentY += 5;

  // Calculate materials
  const summary = calculateMeasurements(project.components);

  pdf.setFontSize(8);
  const maxY = summaryY + summaryHeight - padding;

  // Helper function to check if we have space
  const hasSpace = (lines: number) => currentY + lines * lineHeight <= maxY;

  // === POOLS ===
  if (summary.pools.length > 0 && hasSpace(2)) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.text.primary);
    pdf.text('Pools:', x + padding, currentY);
    currentY += lineHeight;

    summary.pools.forEach((pool) => {
      if (!hasSpace(1)) return;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`• ${pool.type} ${pool.dimensions}`, x + padding + 2, currentY);
      currentY += lineHeight;

      if (pool.coping && hasSpace(2)) {
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLORS.text.tertiary);
        pdf.text(`  Coping: ${pool.coping.totalPavers} pavers (400×400mm)`, x + padding + 4, currentY);
        currentY += lineHeight;
        pdf.text(`  (${pool.coping.fullPavers} full + ${pool.coping.partialPavers} partial) = ${formatArea(pool.coping.area)}`, x + padding + 4, currentY);
        currentY += lineHeight;
        pdf.setFontSize(8);
        pdf.setTextColor(...COLORS.text.primary);
      }
    });
    currentY += 2;
  }

  // === PAVING ===
  if (summary.paving.length > 0 && hasSpace(2)) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.text.primary);
    pdf.text('Paving:', x + padding, currentY);
    currentY += lineHeight;

    summary.paving.forEach((paver) => {
      if (!hasSpace(5)) return;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`• ${paver.size}`, x + padding + 2, currentY);
      currentY += lineHeight;
      pdf.text(`• Count: ${paver.count} pavers`, x + padding + 2, currentY);
      currentY += lineHeight;
      
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.text.tertiary);
      pdf.text(`  ${paver.fullPavers} full + ${paver.partialPavers} partial`, x + padding + 4, currentY);
      currentY += lineHeight;
      
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.text.primary);
      pdf.text(`• Total area: ${formatArea(paver.area)}`, x + padding + 2, currentY);
      currentY += lineHeight;
      pdf.text(`• Wastage: ${paver.wastage}%`, x + padding + 2, currentY);
      currentY += lineHeight + 2;
    });
  }

  // === DRAINAGE ===
  if (summary.drainage.length > 0 && hasSpace(2)) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.text.primary);
    pdf.text('Drainage:', x + padding, currentY);
    currentY += lineHeight;

    summary.drainage.forEach((drain) => {
      if (!hasSpace(3)) return;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`• ${drain.type}`, x + padding + 2, currentY);
      currentY += lineHeight;
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.text.tertiary);
      pdf.text(`  Length: ${formatLength(drain.length)}`, x + padding + 4, currentY);
      currentY += lineHeight;
      pdf.text(`  Volume: ${((drain.length / 1000) * 0.1).toFixed(2)} m³`, x + padding + 4, currentY);
      currentY += lineHeight;
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.text.primary);
    });
    currentY += 2;
  }

  // === FENCING ===
  if (summary.fencing.length > 0 && hasSpace(2)) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.text.primary);
    pdf.text('Fencing:', x + padding, currentY);
    currentY += lineHeight;

    let totalLength = 0;
    summary.fencing.forEach((fence) => {
      if (!hasSpace(2)) return;

      const lengthInMeters = fence.length / 1000;
      totalLength += lengthInMeters;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`• ${fence.type}:`, x + padding + 2, currentY);
      currentY += lineHeight;
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.text.tertiary);
      pdf.text(`  - ${lengthInMeters.toFixed(1)}m (${fence.gates} gates)`, x + padding + 4, currentY);
      currentY += lineHeight;
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.text.primary);
    });

    if (hasSpace(1)) {
      pdf.setFont('helvetica', 'normal');
      pdf.text(`• Total: ${totalLength.toFixed(1)}m`, x + padding + 2, currentY);
      currentY += lineHeight + 2;
    }
  }

  // === WALLS ===
  if (summary.walls.length > 0 && hasSpace(2)) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.text.primary);
    pdf.text('Walls:', x + padding, currentY);
    currentY += lineHeight;

    summary.walls.forEach((wall) => {
      if (!hasSpace(3)) return;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`• ${wall.material}: ${formatLength(wall.length)}`, x + padding + 2, currentY);
      currentY += lineHeight;
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.text.tertiary);
      pdf.text(`  (H: ${formatLength(wall.height)})`, x + padding + 4, currentY);
      currentY += lineHeight;
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.text.primary);
    });
    currentY += 2;
  }

  // Overflow indicator if we ran out of space
  if (currentY > maxY - 5) {
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.text.tertiary);
    pdf.text('...', x + width / 2, maxY - 2, { align: 'center' });
  }
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
