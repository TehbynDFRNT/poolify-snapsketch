import { Project, ExportOptions } from '@/types';
import { calculateMeasurements, formatLength, formatArea } from './measurements';

const RESOLUTIONS = {
  '1080p': { width: 1920, height: 1080 },
  '4K': { width: 3840, height: 2160 },
  '8K': { width: 7680, height: 4320 },
};

export const exportAsImage = async (
  project: Project,
  canvasElement: HTMLCanvasElement,
  options: ExportOptions
): Promise<void> => {
  const resolution = options.resolution || '4K';
  const { width, height } = RESOLUTIONS[resolution];
  
  // Create export canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // Background
  if (options.backgroundColor === 'white' || options.format === 'jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  // === HEADER (9.5% of height) ===
  const headerHeight = height * 0.095;
  drawImageHeader(ctx, project, width, headerHeight, options);

  // === DRAWING AREA (69% of height, full width) ===
  const drawingY = headerHeight + 1;
  const drawingHeight = height * 0.69;

  // Border
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    width * 0.017,
    drawingY,
    width * 0.966,
    drawingHeight
  );

  // Scale and draw canvas (full width)
  const maxDrawWidth = width * 0.95;
  const maxDrawHeight = drawingHeight * 0.95;

  const canvasScale = Math.min(
    maxDrawWidth / canvasElement.width,
    maxDrawHeight / canvasElement.height
  );

  const scaledWidth = canvasElement.width * canvasScale;
  const scaledHeight = canvasElement.height * canvasScale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = drawingY + (drawingHeight - scaledHeight) / 2;

  ctx.drawImage(canvasElement, offsetX, offsetY, scaledWidth, scaledHeight);

  // === LEGEND OVERLAY (top-right) ===
  if (options.includeLegend) {
    const legendWidth = width * 0.17;
    const legendHeight = height * 0.26;
    const legendX = width * 0.8;
    const legendY = drawingY + height * 0.024;

    drawImageLegendOverlay(ctx, legendX, legendY, legendWidth, legendHeight);
  }

  // === MATERIALS SUMMARY (bottom, full width) ===
  if (options.includeSummary) {
    const summaryY = drawingY + drawingHeight + 1;
    const summaryHeight = height * 0.16;

    drawImageMaterialsSummary(
      ctx,
      project,
      width * 0.017,
      summaryY,
      width * 0.966,
      summaryHeight
    );
  }

  // Export
  const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
  exportCanvas.toBlob((blob) => {
    if (!blob) {
      throw new Error('Failed to create image blob');
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.customerName.replace(/\s+/g, '_')}_PoolDesign.${options.format}`;
    link.click();
    URL.revokeObjectURL(url);
  }, mimeType, 0.95);
};

const drawImageHeader = (
  ctx: CanvasRenderingContext2D,
  project: Project,
  width: number,
  height: number,
  options: ExportOptions
) => {
  const padding = width * 0.017;

  // Customer name/title
  ctx.font = `bold ${height * 0.4}px helvetica`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.fillText(`Pool Design - ${project.customerName}`, padding, height * 0.2);

  // Address
  ctx.font = `${height * 0.3}px helvetica`;
  ctx.fillStyle = '#374151';
  ctx.fillText(project.address, padding, height * 0.5);

  // Scale
  ctx.fillStyle = '#6B7280';
  ctx.fillText(`Scale: ${options.scale}`, padding, height * 0.8);

  // Date (right side)
  const date = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  ctx.textAlign = 'right';
  ctx.fillText(`Date: ${date}`, width - padding, height * 0.8);
  ctx.textAlign = 'left';

  // Bottom border line
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, height);
  ctx.lineTo(width - padding, height);
  ctx.stroke();
};

const drawImageLegendOverlay = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const padding = width * 0.06;

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, width, height);

  // Border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Title
  let currentY = y + height * 0.1;
  ctx.font = `bold ${height * 0.07}px helvetica`;
  ctx.fillStyle = '#000000';
  ctx.fillText('LEGEND', x + padding, currentY);

  // Legend items
  currentY += height * 0.12;
  ctx.font = `${height * 0.055}px helvetica`;

  const legendItems = [
    { color: '#3B82F6', label: 'Pool' },
    { color: '#94A3B8', label: 'Coping' },
    { color: '#FDE68A', label: 'Paving' },
    { color: '#6B7280', label: 'Drainage' },
    { color: '#60A5FA', label: 'Fencing' },
    { color: '#92400E', label: 'Wall' },
    { color: '#1E293B', label: 'Boundary' },
    { color: '#000000', label: 'House' },
  ];

  const itemHeight = height * 0.09;

  legendItems.forEach((item) => {
    const colorBoxSize = width * 0.12;

    // Draw color box
    ctx.fillStyle = item.color;
    ctx.fillRect(x + padding, currentY - colorBoxSize * 0.7, colorBoxSize, colorBoxSize * 0.7);

    // Draw label
    ctx.fillStyle = '#000000';
    ctx.fillText(item.label, x + padding + colorBoxSize + padding * 0.5, currentY);

    currentY += itemHeight;
  });
};

const drawImageMaterialsSummary = (
  ctx: CanvasRenderingContext2D,
  project: Project,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const padding = width * 0.01;

  // Background (light gray)
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(x, y, width, height);

  // Top border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();

  // Title
  let textY = y + height * 0.15;
  ctx.font = `bold ${height * 0.12}px helvetica`;
  ctx.fillStyle = '#000000';
  ctx.fillText('MATERIALS SUMMARY', x + padding, textY);

  textY += height * 0.15;

  // Calculate materials
  const summary = calculateMeasurements(project.components);

  // Build summary text (inline format with separators)
  const summaryParts: string[] = [];

  // Pools
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

  // Paving
  if (summary.paving.length > 0) {
    summary.paving.forEach((paver) => {
      summaryParts.push(
        `Paving: ${paver.size} - ${paver.count} pavers ` +
        `(${paver.fullPavers} full + ${paver.partialPavers} partial) = ` +
        `${formatArea(paver.area)} - Wastage: ${paver.wastage}%`
      );
    });
  }

  // Drainage
  if (summary.drainage.length > 0) {
    summary.drainage.forEach((drain) => {
      summaryParts.push(
        `Drainage: ${drain.type} - ${formatLength(drain.length)} ` +
        `(${((drain.length / 1000) * 0.1).toFixed(2)} m³)`
      );
    });
  }

  // Fencing
  if (summary.fencing.length > 0) {
    const fenceParts = summary.fencing.map(f => (f.length / 1000).toFixed(1) + 'm').join(' + ');
    const totalLength = summary.fencing.reduce((sum, f) => sum + f.length / 1000, 0);
    const totalGates = summary.fencing.reduce((sum, f) => sum + f.gates, 0);

    summaryParts.push(
      `Fencing: ${summary.fencing[0].type} ${fenceParts} = ${totalLength.toFixed(1)}m ` +
      `(${totalGates} gates)`
    );
  }

  // Walls
  if (summary.walls.length > 0) {
    summary.walls.forEach((wall) => {
      summaryParts.push(
        `Walls: ${wall.material} ${formatLength(wall.length)} (H: ${formatLength(wall.height)})`
      );
    });
  }

  // Join with separator
  const summaryText = summaryParts.join(' │ ');

  // Word wrap and draw
  ctx.font = `${height * 0.08}px helvetica`;
  ctx.fillStyle = '#000000';

  const maxWidth = width - padding * 2;
  const words = summaryText.split(' ');
  let line = '';
  const lineHeight = height * 0.12;
  let lineCount = 0;
  const maxLines = Math.floor((height * 0.7) / lineHeight);

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x + padding, textY + lineCount * lineHeight);
      line = words[i] + ' ';
      lineCount++;
      
      if (lineCount >= maxLines) break;
    } else {
      line = testLine;
    }
  }

  if (lineCount < maxLines && line !== '') {
    ctx.fillText(line, x + padding, textY + lineCount * lineHeight);
  }
};
