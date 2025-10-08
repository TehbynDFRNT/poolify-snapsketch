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

  // Add canvas image with proper aspect ratio
  const canvasY = margin + 25;
  const maxCanvasHeight = pageHeight * 0.55;
  const maxCanvasWidth = contentWidth;
  
  // Calculate dimensions maintaining aspect ratio
  const canvasAspectRatio = canvasElement.width / canvasElement.height;
  let canvasWidth = maxCanvasWidth;
  let canvasHeight = canvasWidth / canvasAspectRatio;
  
  // If height is too large, scale based on height instead
  if (canvasHeight > maxCanvasHeight) {
    canvasHeight = maxCanvasHeight;
    canvasWidth = canvasHeight * canvasAspectRatio;
  }

  try {
    const canvasData = canvasElement.toDataURL('image/png', 1.0);
    
    // Center the canvas horizontally if it's smaller than max width
    const canvasX = margin + (maxCanvasWidth - canvasWidth) / 2;
    
    // Add a border around the canvas
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(canvasX, canvasY, canvasWidth, canvasHeight);
    
    pdf.addImage(canvasData, 'PNG', canvasX, canvasY, canvasWidth, canvasHeight);
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
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Legend', x, y);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  const legendItems = [
    { color: [59, 130, 246], label: 'Pool' },
    { color: [156, 163, 175], label: 'Pool Coping' },
    { color: [243, 235, 217], label: 'Paving' },
    { color: [152, 156, 164], label: 'Drainage' },
    { color: [93, 165, 218], label: 'Fencing' },
    { color: [140, 107, 74], label: 'Retaining Wall' },
    { color: [30, 58, 138], label: 'Boundary' },
    { color: [0, 0, 0], label: 'House' },
  ];

  let currentY = y + 6;
  const boxSize = 5;
  const spacing = 3;
  let currentX = x;

  legendItems.forEach((item, index) => {
    const textWidth = pdf.getTextWidth(item.label);
    const itemWidth = boxSize + spacing + textWidth;
    
    // Wrap to next row if needed
    if (currentX + itemWidth > x + width && index > 0) {
      currentX = x;
      currentY += 7;
    }
    
    // Draw colored box with border
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.2);
    pdf.rect(currentX, currentY - boxSize + 1, boxSize, boxSize, 'FD');
    
    // Draw label
    pdf.setTextColor(0, 0, 0);
    pdf.text(item.label, currentX + boxSize + spacing, currentY);
    
    currentX += itemWidth + 10;
  });
};

const addSummary = (pdf: jsPDF, project: Project, x: number, y: number, width: number) => {
  const summary = calculateMeasurements(project.components);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Materials Summary', x, y);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  const lineHeight = 5;
  const columnWidth = width / 2 - 5;
  const column2X = x + columnWidth + 10;
  
  // Left column
  let leftY = y + 7;
  
  // Pools (Left column)
  if (summary.pools.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Pools:', x, leftY);
    pdf.setFont('helvetica', 'normal');
    leftY += lineHeight;
    
    summary.pools.forEach(pool => {
      pdf.text(`  • ${pool.type} (${pool.dimensions})`, x, leftY);
      leftY += lineHeight;
      
      // Add coping info if present
      if (pool.coping) {
        pdf.setFont('helvetica', 'italic');
        pdf.text(`    Coping: ${pool.coping.totalPavers} pavers (400×400mm)`, x, leftY);
        leftY += lineHeight;
        pdf.text(`    (${pool.coping.fullPavers} full + ${pool.coping.partialPavers} partial) = ${formatArea(pool.coping.area)}`, x, leftY);
        leftY += lineHeight;
        pdf.setFont('helvetica', 'normal');
      }
    });
    leftY += 2;
  }

  // Paving (Left column)
  if (summary.paving.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Paving:', x, leftY);
    pdf.setFont('helvetica', 'normal');
    leftY += lineHeight;
    
    summary.paving.forEach(paver => {
      pdf.text(`  • ${paver.size}`, x, leftY);
      leftY += lineHeight;
      pdf.text(`    Count: ${paver.count} pavers`, x, leftY);
      leftY += lineHeight;
      pdf.text(`    ${paver.fullPavers} full + ${paver.partialPavers} partial`, x, leftY);
      leftY += lineHeight;
      pdf.text(`    Total area: ${formatArea(paver.area)}`, x, leftY);
      leftY += lineHeight;
      pdf.text(`    Wastage: ${paver.wastage}%`, x, leftY);
      leftY += lineHeight + 1;
    });
    leftY += 2;
  }

  // Drainage (Left column)
  if (summary.drainage.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Drainage (${summary.drainage.length}):`, x, leftY);
    pdf.setFont('helvetica', 'normal');
    leftY += lineHeight;
    
    summary.drainage.forEach(drain => {
      pdf.text(`  • ${drain.type} Drainage`, x, leftY);
      leftY += lineHeight;
      pdf.text(`    Length: ${formatLength(drain.length)}`, x, leftY);
      leftY += lineHeight;
      pdf.text(`    Width: 100mm`, x, leftY);
      leftY += lineHeight;
      pdf.text(`    Volume: ${((drain.length / 1000) * 0.1).toFixed(2)} m³`, x, leftY);
      leftY += lineHeight + 1;
    });
    leftY += 2;
  }

  // Right column
  let rightY = y + 7;

  // Fencing (Right column)
  if (summary.fencing.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Fencing:', column2X, rightY);
    pdf.setFont('helvetica', 'normal');
    rightY += lineHeight;
    
    summary.fencing.forEach(fence => {
      pdf.text(`  • ${fence.type}:`, column2X, rightY);
      rightY += lineHeight;
      pdf.text(`    ${formatLength(fence.length)} (${fence.gates} gates)`, column2X, rightY);
      rightY += lineHeight;
    });
    rightY += 2;
  }

  // Walls (Right column)
  if (summary.walls.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Walls (${summary.walls.length}):`, column2X, rightY);
    pdf.setFont('helvetica', 'normal');
    rightY += lineHeight;
    
    summary.walls.forEach(wall => {
      pdf.text(`  • ${wall.material} Retaining Wall`, column2X, rightY);
      rightY += lineHeight;
      pdf.text(`    Length: ${formatLength(wall.length)}`, column2X, rightY);
      rightY += lineHeight;
      pdf.text(`    Height: ${formatLength(wall.height)}`, column2X, rightY);
      rightY += lineHeight;
      pdf.text(`    Volume: ${((wall.length / 1000) * (wall.height / 1000) * 0.3).toFixed(2)} m³`, column2X, rightY);
      rightY += lineHeight + 1;
    });
  }
};
