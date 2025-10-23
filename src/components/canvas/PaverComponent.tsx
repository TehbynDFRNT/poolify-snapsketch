import { Group, Rect, Line, Circle } from 'react-konva';
import { Component } from '@/types';
import { PAVER_SIZES } from '@/constants/components';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useDesignStore } from '@/store/designStore';

interface PaverComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onReplicateRight?: (count: number) => void;
  onReplicateBottom?: (count: number) => void;
  onReplicateLeft?: (count: number) => void;
  onReplicateTop?: (count: number) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const PaverComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onReplicateRight,
  onReplicateBottom,
  onReplicateLeft,
  onReplicateTop,
  onContextMenu,
}: PaverComponentProps) => {
  const groupRef = useRef<any>(null);
  const addComponent = useDesignStore(state => state.addComponent);
  const updateComponentStore = useDesignStore(state => state.updateComponent);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [previewCount, setPreviewCount] = useState<{ rows: number; cols: number; offsetX: number; offsetY: number } | null>(null);
  const [previewMeta, setPreviewMeta] = useState<
    | null
    | {
        direction: 'left' | 'right' | 'top' | 'bottom';
        additional: number; // additional rows or cols depending on direction
      }
  >(null);
  // Local selection of boundary tiles: store as set of "r,c"
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const scale = 0.1; // 1 unit = 10mm
  const paverSize = component.properties.paverSize || '400x400';
  const { width, height } = PAVER_SIZES[paverSize];
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const count = component.properties.paverCount || { rows: 1, cols: 1 };
  const baseOffset = component.properties.baseOffset || { col: 0, row: 0 };
  const extraBlocks = component.properties.paverExtraBlocks || [];

  // Build union tile set (absolute tile coords)
  const unionTiles = useMemo(() => {
    const set = new Set<string>();
    // base grid
    for (let r = 0; r < count.rows; r++) {
      for (let c = 0; c < count.cols; c++) {
        const ar = baseOffset.row + r;
        const ac = baseOffset.col + c;
        set.add(`${ar},${ac}`);
      }
    }
    // extra blocks
    extraBlocks.forEach(b => {
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          set.add(`${b.row + r},${b.col + c}`);
        }
      }
    });
    return set;
  }, [count.rows, count.cols, baseOffset.row, baseOffset.col, extraBlocks]);

  const isBoundaryAt = (absRow: number, absCol: number): boolean => {
    const key = `${absRow},${absCol}`;
    if (!unionTiles.has(key)) return false;
    // 4-neighborhood
    const neighbors = [
      `${absRow - 1},${absCol}`,
      `${absRow + 1},${absCol}`,
      `${absRow},${absCol - 1}`,
      `${absRow},${absCol + 1}`,
    ];
    return neighbors.some(n => !unionTiles.has(n));
  };

  // Draw grid of pavers: fill rectangles and overlays (selection), and collect edges for grout lines
  const fills: JSX.Element[] = [];
  const overlays: JSX.Element[] = [];
  const groutStrokePx = 2;
  const roundHalf = (px: number) => Math.round(px * 2) / 2;
  const floorHalf = (px: number) => Math.floor(px * 2) / 2;
  type Seg = { x1:number; y1:number; x2:number; y2:number };
  const edgeMap = new Map<string, Seg & { count: number }>();
  const addEdge = (x1:number,y1:number,x2:number,y2:number) => {
    const rx1 = roundHalf(x1), ry1 = roundHalf(y1);
    const rx2 = roundHalf(x2), ry2 = roundHalf(y2);
    const key = `${Math.min(rx1,rx2)},${Math.min(ry1,ry2)},${Math.max(rx1,rx2)},${Math.max(ry1,ry2)}`;
    const cur = edgeMap.get(key);
    if (cur) cur.count += 1; else edgeMap.set(key, { x1: rx1, y1: ry1, x2: rx2, y2: ry2, count: 1 });
  };
  for (let row = 0; row < count.rows; row++) {
    for (let col = 0; col < count.cols; col++) {
      const absRow = baseOffset.row + row;
      const absCol = baseOffset.col + col;
      const key = `${absRow}-${absCol}`;
      const isBoundary = isBoundaryAt(absRow, absCol);
      const isSelected = selectedCells.has(key);
      const pxX = floorHalf(absCol * scaledWidth);
      const pxY = floorHalf(absRow * scaledHeight);
      const w = Math.round(scaledWidth);
      const h = Math.round(scaledHeight);
      fills.push(
        <Rect
          key={`fill-${key}`}
          x={pxX}
          y={pxY}
          width={w}
          height={h}
          fill="#F3EBD9"
          onClick={(e: any) => {
            if (e.evt && e.evt.shiftKey) {
              e.cancelBubble = true;
              if (!isBoundary) return;
              if (!isSelected) onSelect();
              setSelectedCells((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              });
            }
          }}
        />
      );
      if (isSelected) {
        overlays.push(
          <Rect
            key={`ovl-${key}`}
            x={pxX + groutStrokePx/2}
            y={pxY + groutStrokePx/2}
            width={Math.max(0, w - groutStrokePx)}
            height={Math.max(0, h - groutStrokePx)}
            fill="rgba(59,130,246,0.15)"
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[6, 3]}
            listening={false}
          />
        );
      }
      // Collect edges for grout lines
      addEdge(pxX, pxY, pxX + w, pxY);
      addEdge(pxX, pxY + h, pxX + w, pxY + h);
      addEdge(pxX, pxY, pxX, pxY + h);
      addEdge(pxX + w, pxY, pxX + w, pxY + h);
    }
  }

  // Render extra replicated blocks within the same component
  extraBlocks.forEach((b, bi) => {
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const absRow = b.row + r;
        const absCol = b.col + c;
        const key = `${absRow}-${absCol}`;
        const isBoundary = isBoundaryAt(absRow, absCol);
        const isSelected = selectedCells.has(key);
        const pxX = floorHalf(absCol * scaledWidth);
        const pxY = floorHalf(absRow * scaledHeight);
        const w = Math.round(scaledWidth);
        const h = Math.round(scaledHeight);
        fills.push(
          <Rect
            key={`fill-extra-${bi}-${r}-${c}`}
            x={pxX}
            y={pxY}
            width={w}
            height={h}
            fill="#F3EBD9"
            onClick={(e: any) => {
              if (e.evt && e.evt.shiftKey) {
                e.cancelBubble = true;
                if (!isBoundary) return;
                if (!isSelected) onSelect();
                setSelectedCells((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key); else next.add(key);
                  return next;
                });
              }
            }}
          />
        );
        if (isSelected) {
          overlays.push(
            <Rect
              key={`ovl-extra-${bi}-${r}-${c}`}
              x={pxX + groutStrokePx/2}
              y={pxY + groutStrokePx/2}
              width={Math.max(0, w - groutStrokePx)}
              height={Math.max(0, h - groutStrokePx)}
              fill="rgba(59,130,246,0.15)"
              stroke="#3B82F6"
              strokeWidth={2}
              dash={[6, 3]}
              listening={false}
            />
          );
        }
        addEdge(pxX, pxY, pxX + w, pxY);
        addEdge(pxX, pxY + h, pxX + w, pxY + h);
        addEdge(pxX, pxY, pxX, pxY + h);
        addEdge(pxX + w, pxY, pxX + w, pxY + h);
      }
    }
  });

  // Clear local cell selection when component becomes deselected
  useEffect(() => {
    if (!isSelected && selectedCells.size > 0) {
      setSelectedCells(new Set());
    }
  }, [isSelected]);

  // Selection helpers
  const selectionInfo = useMemo(() => {
    if (selectedCells.size === 0) return null as null | {
      minRow: number; maxRow: number; minCol: number; maxCol: number;
      width: number; height: number; isRectangular: boolean;
    };

    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
    const cells: Array<{ r: number; c: number }> = [];
    selectedCells.forEach((k) => {
      const [rs, cs] = k.split('-');
      const r = parseInt(rs, 10);
      const c = parseInt(cs, 10);
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
      cells.push({ r, c });
    });
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    const isRectangular = cells.length === width * height;
    return { minRow, maxRow, minCol, maxCol, width, height, isRectangular };
  }, [selectedCells]);

  // Normalize and commit new extra blocks into this component, updating dimensions and position
  const normalizeAndCommit = (newBlocks: Array<{ col: number; row: number; cols: number; rows: number }>) => {
    const blocks = [...extraBlocks, ...newBlocks];

    // Compute bounds (tile units)
    let minCol = baseOffset.col;
    let maxCol = baseOffset.col + count.cols - 1;
    let minRow = baseOffset.row;
    let maxRow = baseOffset.row + count.rows - 1;
    blocks.forEach(b => {
      minCol = Math.min(minCol, b.col);
      minRow = Math.min(minRow, b.row);
      maxCol = Math.max(maxCol, b.col + b.cols - 1);
      maxRow = Math.max(maxRow, b.row + b.rows - 1);
    });

    // Shift so the minimum is 0 (always normalize)
    const shiftCol = -minCol;
    const shiftRow = -minRow;
    const normBase = { col: baseOffset.col + shiftCol, row: baseOffset.row + shiftRow };
    const normBlocks = blocks.map(b => ({
      col: b.col + shiftCol,
      row: b.row + shiftRow,
      cols: b.cols,
      rows: b.rows,
    }));

    // New dimensions in tiles
    const widthTiles = (maxCol - minCol) + 1;
    const heightTiles = (maxRow - minRow) + 1;

    const newWidthMm = widthTiles * width;
    const newHeightMm = heightTiles * height;

    // Pixel shift for component position to keep world placement stable
    const pxShiftX = minCol * scaledWidth; // move origin by minCol tiles
    const pxShiftY = minRow * scaledHeight;

    updateComponentStore(component.id, {
      position: {
        x: component.position.x + pxShiftX,
        y: component.position.y + pxShiftY,
      },
      dimensions: { width: newWidthMm, height: newHeightMm },
      properties: {
        ...component.properties,
        baseOffset: normBase,
        paverExtraBlocks: normBlocks,
      }
    });
  };

  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  return (
    <Group
      ref={groupRef}
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable={!isDraggingHandle}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={handleRightClick}
      onDragEnd={(e) => {
        onDragEnd({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {/* Invisible hit area covering full paver union */}
      {(() => {
        let minCol = baseOffset.col;
        let maxCol = baseOffset.col + count.cols - 1;
        let minRow = baseOffset.row;
        let maxRow = baseOffset.row + count.rows - 1;
        extraBlocks.forEach(b => {
          minCol = Math.min(minCol, b.col);
          minRow = Math.min(minRow, b.row);
          maxCol = Math.max(maxCol, b.col + b.cols - 1);
          maxRow = Math.max(maxRow, b.row + b.rows - 1);
        });
        const x = minCol * scaledWidth - 5;
        const y = minRow * scaledHeight - 5;
        const w = (maxCol - minCol + 1) * scaledWidth + 10;
        const h = (maxRow - minRow + 1) * scaledHeight + 10;
        return <Rect x={x} y={y} width={w} height={h} fill="transparent" listening={false} />;
      })()}

      {/* Fill tiles */}
      {fills}

      {/* Unified grout lines */}
      <Group listening={false}>
        {Array.from(edgeMap.values()).map((seg, idx) => (
          <Line key={`grout-${idx}`} points={[seg.x1, seg.y1, seg.x2, seg.y2]} stroke="#D4C5A9" strokeWidth={groutStrokePx} />
        ))}
      </Group>

      {/* Selection overlays */}
      <Group listening={false}>{overlays}</Group>

      {/* Ghost preview pavers during drag */}
      {(previewCount || (previewMeta && previewMeta.additional > 0)) && (() => {
        const ghostPavers = [] as any[];
        const sel = selectionInfo && selectionInfo.isRectangular ? selectionInfo : null;
        if (sel && previewMeta && previewMeta.additional > 0) {
          // Selection-based ghost anchored to selection boundary, not union
          if (previewMeta.direction === 'right' || previewMeta.direction === 'left') {
            const startCol = previewMeta.direction === 'right'
              ? sel.maxCol + 1
              : sel.minCol - previewMeta.additional;
            const endCol = previewMeta.direction === 'right'
              ? sel.maxCol + previewMeta.additional
              : sel.minCol - 1;
            for (let r = sel.minRow; r <= sel.maxRow; r++) {
              for (let c = startCol; c <= endCol; c++) {
                if (unionTiles.has(`${r},${c}`)) continue;
                ghostPavers.push(
                  <Rect key={`ghost-${r}-${c}`}
                        x={c * scaledWidth}
                        y={r * scaledHeight}
                        width={scaledWidth}
                        height={scaledHeight}
                        fill="#F3EBD9"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dash={[5, 5]}
                        opacity={0.5}
                        listening={false}
                  />
                );
              }
            }
          } else {
            const startRow = previewMeta.direction === 'bottom'
              ? sel.maxRow + 1
              : sel.minRow - previewMeta.additional;
            const endRow = previewMeta.direction === 'bottom'
              ? sel.maxRow + previewMeta.additional
              : sel.minRow - 1;
            for (let c = sel.minCol; c <= sel.maxCol; c++) {
              for (let r = startRow; r <= endRow; r++) {
                if (unionTiles.has(`${r},${c}`)) continue;
                ghostPavers.push(
                  <Rect key={`ghost-${r}-${c}`}
                        x={c * scaledWidth}
                        y={r * scaledHeight}
                        width={scaledWidth}
                        height={scaledHeight}
                        fill="#F3EBD9"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dash={[5, 5]}
                        opacity={0.5}
                        listening={false}
                  />
                );
              }
            }
          }
        } else if (previewCount) {
          // Fallback: whole-grid ghost based on base grid (legacy behavior)
          const extendingLeft = previewCount.offsetX < 0;
          const extendingRight = previewCount.cols > count.cols && !extendingLeft;
          const extendingTop = previewCount.offsetY < 0;
          const extendingBottom = previewCount.rows > count.rows && !extendingTop;
          for (let row = 0; row < previewCount.rows; row++) {
            for (let col = 0; col < previewCount.cols; col++) {
              const actualRow = row + previewCount.offsetY;
              const actualCol = col + previewCount.offsetX;
              const absR = actualRow + baseOffset.row;
              const absC = actualCol + baseOffset.col;
              const isExisting = unionTiles.has(`${absR},${absC}`);
              if (isExisting) continue;
              ghostPavers.push(
                <Rect key={`ghost-${row}-${col}`}
                      x={absC * scaledWidth}
                      y={absR * scaledHeight}
                      width={scaledWidth}
                      height={scaledHeight}
                      fill="#F3EBD9"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dash={[5, 5]}
                      opacity={0.5}
                      listening={false}
                />
              );
            }
          }
        }
        return ghostPavers;
      })()}

      {/* Selection border and handles */}
      {(isSelected || selectedCells.size > 0) && (
        <>
          {(() => {
            // Compute bounding across base and extra blocks (in tile units)
            let minCol = baseOffset.col;
            let maxCol = baseOffset.col + count.cols - 1;
            let minRow = baseOffset.row;
            let maxRow = baseOffset.row + count.rows - 1;
            extraBlocks.forEach(b => {
              minCol = Math.min(minCol, b.col);
              minRow = Math.min(minRow, b.row);
              maxCol = Math.max(maxCol, b.col + b.cols - 1);
              maxRow = Math.max(maxRow, b.row + b.rows - 1);
            });

            const x = minCol * scaledWidth - 5;
            const y = minRow * scaledHeight - 5;
            const w = (maxCol - minCol + 1) * scaledWidth + 10;
            const h = (maxRow - minRow + 1) * scaledHeight + 10;

            return (
              <Rect
                x={x}
                y={y}
                width={w}
                height={h}
                stroke="#3B82F6"
                strokeWidth={2}
                dash={[10, 5]}
                listening={false}
              />
            );
          })()}

          {/* Handles anchored to bounding box */}
          {(() => {
            let minCol = baseOffset.col;
            let maxCol = baseOffset.col + count.cols - 1;
            let minRow = baseOffset.row;
            let maxRow = baseOffset.row + count.rows - 1;
            extraBlocks.forEach(b => {
              minCol = Math.min(minCol, b.col);
              minRow = Math.min(minRow, b.row);
              maxCol = Math.max(maxCol, b.col + b.cols - 1);
              maxRow = Math.max(maxRow, b.row + b.rows - 1);
            });
            const leftX = minCol * scaledWidth;
            const rightX = (maxCol + 1) * scaledWidth;
            const topY = minRow * scaledHeight;
            const bottomY = (maxRow + 1) * scaledHeight;
            const midX = (leftX + rightX) / 2;
            const midY = (topY + bottomY) / 2;
            return (
              <>
                {/* Right handle for horizontal replication */}
                <Circle
                  x={rightX}
                  y={midY}
                  radius={8}
                  fill="#3B82F6"
                  stroke="white"
                  strokeWidth={2}
                  draggable
                  dragBoundFunc={(pos) => {
                    const group = groupRef.current;
                    if (!group) return pos;
                    const tr = group.getAbsoluteTransform().copy();
                    const inv = tr.copy().invert();
                    const local = inv.point(pos);
                    local.y = midY;
                    local.x = Math.max(rightX + scaledWidth, Math.min(rightX + 20 * scaledWidth, local.x));
                    return tr.point(local);
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true;
                    setIsDraggingHandle(true);
                  }}
                  onDragMove={(e) => {
                    e.cancelBubble = true;
                    const dx = e.target.x() - rightX;
                    const steps = Math.max(0, Math.round(dx / scaledWidth));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    const addCols = steps * (useSel ? selectionInfo!.width : 1);
                    const newCols = Math.max(1, count.cols + addCols);
                    setPreviewCount({ rows: count.rows, cols: newCols, offsetX: 0, offsetY: 0 });
                    setPreviewMeta({ direction: 'right', additional: addCols });
                  }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const dx = e.target.x() - rightX;
                    const steps = Math.max(0, Math.round(dx / scaledWidth));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    if (useSel && steps > 0) {
                      const sel = selectionInfo!;
                      const repCols = sel.width * steps;
                      const repRows = sel.height;
                      const newBlock = {
                        col: sel.maxCol + 1,
                        row: sel.minRow,
                        cols: repCols,
                        rows: repRows,
                      };
                      normalizeAndCommit([newBlock]);
                    } else {
                      // Full-grid extend: reset to rectangular state
                      updateComponentStore(component.id, {
                        properties: {
                          ...component.properties,
                          paverExtraBlocks: [],
                          baseOffset: { col: 0, row: 0 },
                        }
                      });
                      const addCols = steps * (useSel ? selectionInfo!.width : 1);
                      const newCols = Math.max(1, count.cols + addCols);
                      onReplicateRight?.(newCols);
                    }
                    e.target.x(rightX);
                    e.target.y(midY);
                    setIsDraggingHandle(false);
                    setPreviewCount(null);
                    setPreviewMeta(null);
                  }}
                />

                {/* Bottom handle for vertical replication */}
                <Circle
                  x={midX}
                  y={bottomY}
                  radius={8}
                  fill="#3B82F6"
                  stroke="white"
                  strokeWidth={2}
                  draggable
                  dragBoundFunc={(pos) => {
                    const group = groupRef.current;
                    if (!group) return pos;
                    const tr = group.getAbsoluteTransform().copy();
                    const inv = tr.copy().invert();
                    const local = inv.point(pos);
                    local.x = midX;
                    local.y = Math.max(bottomY + scaledHeight, Math.min(bottomY + 20 * scaledHeight, local.y));
                    return tr.point(local);
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true;
                    setIsDraggingHandle(true);
                  }}
                  onDragMove={(e) => {
                    e.cancelBubble = true;
                    const dy = e.target.y() - bottomY;
                    const steps = Math.max(0, Math.round(dy / scaledHeight));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    const addRows = steps * (useSel ? selectionInfo!.height : 1);
                    const newRows = Math.max(1, count.rows + addRows);
                    setPreviewCount({ rows: newRows, cols: count.cols, offsetX: 0, offsetY: 0 });
                    setPreviewMeta({ direction: 'bottom', additional: addRows });
                  }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const dy = e.target.y() - bottomY;
                    const steps = Math.max(0, Math.round(dy / scaledHeight));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    if (useSel && steps > 0) {
                      const sel = selectionInfo!;
                      const repCols = sel.width;
                      const repRows = sel.height * steps;
                      const newBlock = {
                        col: sel.minCol,
                        row: sel.maxRow + 1,
                        cols: repCols,
                        rows: repRows,
                      };
                      normalizeAndCommit([newBlock]);
                    } else {
                      updateComponentStore(component.id, {
                        properties: {
                          ...component.properties,
                          paverExtraBlocks: [],
                          baseOffset: { col: 0, row: 0 },
                        }
                      });
                      const addRows = steps * (useSel ? selectionInfo!.height : 1);
                      const newRows = Math.max(1, count.rows + addRows);
                      onReplicateBottom?.(newRows);
                    }
                    e.target.x(midX);
                    e.target.y(bottomY);
                    setIsDraggingHandle(false);
                    setPreviewCount(null);
                    setPreviewMeta(null);
                  }}
                />

                {/* Left handle for horizontal replication (negative direction) */}
                <Circle
                  x={leftX}
                  y={midY}
                  radius={8}
                  fill="#10B981"
                  stroke="white"
                  strokeWidth={2}
                  draggable
                  dragBoundFunc={(pos) => {
                    const group = groupRef.current;
                    if (!group) return pos;
                    const tr = group.getAbsoluteTransform().copy();
                    const inv = tr.copy().invert();
                    const local = inv.point(pos);
                    local.y = midY;
                    local.x = Math.max(leftX - 20 * scaledWidth, Math.min(leftX, local.x));
                    return tr.point(local);
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true;
                    setIsDraggingHandle(true);
                  }}
                  onDragMove={(e) => {
                    e.cancelBubble = true;
                    const dx = leftX - e.target.x();
                    const steps = Math.max(0, Math.round(dx / scaledWidth));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    const additionalCols = steps * (useSel ? selectionInfo!.width : 1);
                    const newCols = count.cols + additionalCols;
                    setPreviewCount({ rows: count.rows, cols: newCols, offsetX: -additionalCols, offsetY: 0 });
                    setPreviewMeta({ direction: 'left', additional: additionalCols });
                  }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const dx = leftX - e.target.x();
                    const steps = Math.max(0, Math.round(dx / scaledWidth));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    if (useSel && steps > 0) {
                      const sel = selectionInfo!;
                      const repCols = sel.width * steps;
                      const repRows = sel.height;
                      const newBlock = {
                        col: sel.minCol - repCols,
                        row: sel.minRow,
                        cols: repCols,
                        rows: repRows,
                      };
                      normalizeAndCommit([newBlock]);
                    } else {
                      updateComponentStore(component.id, {
                        properties: {
                          ...component.properties,
                          paverExtraBlocks: [],
                          baseOffset: { col: 0, row: 0 },
                        }
                      });
                      const additionalCols = steps * (useSel ? selectionInfo!.width : 1);
                      const newCols = count.cols + additionalCols;
                      onReplicateLeft?.(newCols);
                    }
                    e.target.x(leftX);
                    e.target.y(midY);
                    setIsDraggingHandle(false);
                    setPreviewCount(null);
                    setPreviewMeta(null);
                  }}
                />

                {/* Top handle for vertical replication (negative direction) */}
                <Circle
                  x={midX}
                  y={topY}
                  radius={8}
                  fill="#10B981"
                  stroke="white"
                  strokeWidth={2}
                  draggable
                  dragBoundFunc={(pos) => {
                    const group = groupRef.current;
                    if (!group) return pos;
                    const tr = group.getAbsoluteTransform().copy();
                    const inv = tr.copy().invert();
                    const local = inv.point(pos);
                    local.x = midX;
                    local.y = Math.max(topY - 20 * scaledHeight, Math.min(topY, local.y));
                    return tr.point(local);
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true;
                    setIsDraggingHandle(true);
                  }}
                  onDragMove={(e) => {
                    e.cancelBubble = true;
                    const dy = topY - e.target.y();
                    const steps = Math.max(0, Math.round(dy / scaledHeight));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    const additionalRows = steps * (useSel ? selectionInfo!.height : 1);
                    const newRows = count.rows + additionalRows;
                    setPreviewCount({ rows: newRows, cols: count.cols, offsetX: 0, offsetY: -additionalRows });
                    setPreviewMeta({ direction: 'top', additional: additionalRows });
                  }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const dy = topY - e.target.y();
                    const steps = Math.max(0, Math.round(dy / scaledHeight));
                    const useSel = selectionInfo && selectionInfo.isRectangular;
                    if (useSel && steps > 0) {
                      const sel = selectionInfo!;
                      const repCols = sel.width;
                      const repRows = sel.height * steps;
                      const newBlock = {
                        col: sel.minCol,
                        row: sel.minRow - repRows,
                        cols: repCols,
                        rows: repRows,
                      };
                      normalizeAndCommit([newBlock]);
                    } else {
                      updateComponentStore(component.id, {
                        properties: {
                          ...component.properties,
                          paverExtraBlocks: [],
                          baseOffset: { col: 0, row: 0 },
                        }
                      });
                      const additionalRows = steps * (useSel ? selectionInfo!.height : 1);
                      const newRows = count.rows + additionalRows;
                      onReplicateTop?.(newRows);
                    }
                    e.target.x(midX);
                    e.target.y(topY);
                    setIsDraggingHandle(false);
                    setPreviewCount(null);
                    setPreviewMeta(null);
                  }}
                />
              </>
            );
          })()}
        </>
      )}
    </Group>
  );
};
