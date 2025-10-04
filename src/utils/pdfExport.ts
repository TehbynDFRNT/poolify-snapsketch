import jsPDF from 'jspdf';
import { Project, ExportOptions, Component } from '@/types';
import { calculateMeasurements, formatLength, formatArea } from './measurements';
import { POOL_LIBRARY } from '@/constants/pools';
import { PAVER_SIZES, DRAINAGE_TYPES, FENCE_TYPES, WALL_MATERIALS } from '@/constants/components';

export const exportToPDF = async (
  project: Project,
  canvasElement: HTMLCanvasElement,
  options: ExportOptions
): Promise<void> => {
  const pdf = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: options.paperSize.toLowerCase() as 'a4' | 'a3',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Add title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(project.customerName, margin, margin + 7);

  // Add project details
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(project.address, margin, margin + 13);
  pdf.text(`Scale: ${options.scale}`, margin, margin + 18);
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, margin + 18);

  // Add canvas image
  const canvasY = margin + 25;
  const canvasHeight = pageHeight * 0.5;
  const canvasWidth = contentWidth;

  try {
    const canvasData = canvasElement.toDataURL('image/png');
    pdf.addImage(canvasData, 'PNG', margin, canvasY, canvasWidth, canvasHeight);
  } catch (error) {
    console.error('Failed to add canvas to PDF:', error);
  }

  // Add legend if requested
  if (options.includeLegend) {
    const legendY = canvasY + canvasHeight + 10;
    addLegend(pdf, margin, legendY, contentWidth);
  }

  // Add summary if requested
  if (options.includeSummary) {
    const summaryY = canvasY + canvasHeight + (options.includeLegend ? 40 : 10);
    addSummary(pdf, project, margin, summaryY, contentWidth);
  }

  // Add notes if any
  if (project.notes) {
    pdf.addPage();
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Project Notes', margin, margin + 10);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const splitNotes = pdf.splitTextToSize(project.notes, contentWidth);
    pdf.text(splitNotes, margin, margin + 18);
  }

  // Save the PDF
  const fileName = `${project.customerName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
  pdf.save(fileName);
};

const addLegend = (pdf: jsPDF, x: number, y: number, width: number) => {
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Legend', x, y);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  const legendItems = [
    { color: '#3b82f6', label: 'Pool' },
    { color: '#d4d4d4', label: 'Paving' },
    { color: '#9ca3af', label: 'Drainage' },
    { color: '#6b7280', label: 'Fencing' },
    { color: '#78350f', label: 'Retaining Wall' },
    { color: '#22c55e', label: 'Boundary' },
    { color: '#f59e0b', label: 'House' },
  ];

  let currentY = y + 7;
  const boxSize = 4;
  const itemSpacing = 20;
  let currentX = x;

  legendItems.forEach((item, index) => {
    // Draw colored box
    pdf.setFillColor(item.color);
    pdf.rect(currentX, currentY - 3, boxSize, boxSize, 'F');
    
    // Draw label
    pdf.text(item.label, currentX + boxSize + 2, currentY);
    
    currentX += itemSpacing + pdf.getTextWidth(item.label);
    
    // Wrap to next row if needed
    if (currentX > x + width - 40 && index < legendItems.length - 1) {
      currentX = x;
      currentY += 7;
    }
  });
};

const addSummary = (pdf: jsPDF, project: Project, x: number, y: number, width: number) => {
  const summary = calculateMeasurements(project.components);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Materials Summary', x, y);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  let currentY = y + 7;
  const lineHeight = 5;

  // Pools
  if (summary.pools.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Pools:', x, currentY);
    pdf.setFont('helvetica', 'normal');
    currentY += lineHeight;
    
    summary.pools.forEach(pool => {
      pdf.text(`  • ${pool.type} (${pool.dimensions})`, x, currentY);
      currentY += lineHeight;
    });
    currentY += 2;
  }

  // Paving
  if (summary.paving.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Paving:', x, currentY);
    pdf.setFont('helvetica', 'normal');
    currentY += lineHeight;
    
    summary.paving.forEach(paver => {
      pdf.text(`  • ${paver.size}: ${paver.count} pavers (${formatArea(paver.area)})`, x, currentY);
      currentY += lineHeight;
    });
    currentY += 2;
  }

  // Drainage
  if (summary.drainage.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Drainage:', x, currentY);
    pdf.setFont('helvetica', 'normal');
    currentY += lineHeight;
    
    summary.drainage.forEach(drain => {
      pdf.text(`  • ${drain.type}: ${formatLength(drain.length)}`, x, currentY);
      currentY += lineHeight;
    });
    currentY += 2;
  }

  // Fencing
  if (summary.fencing.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Fencing:', x, currentY);
    pdf.setFont('helvetica', 'normal');
    currentY += lineHeight;
    
    summary.fencing.forEach(fence => {
      pdf.text(`  • ${fence.type}: ${formatLength(fence.length)} (${fence.gates} gates)`, x, currentY);
      currentY += lineHeight;
    });
    currentY += 2;
  }

  // Walls
  if (summary.walls.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Retaining Walls:', x, currentY);
    pdf.setFont('helvetica', 'normal');
    currentY += lineHeight;
    
    summary.walls.forEach(wall => {
      const status = wall.status ? ` (${wall.status})` : '';
      pdf.text(`  • ${wall.material}: ${formatLength(wall.length)} × ${formatLength(wall.height)}${status}`, x, currentY);
      currentY += lineHeight;
    });
  }
};
