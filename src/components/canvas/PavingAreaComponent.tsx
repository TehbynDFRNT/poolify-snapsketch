import { Group, Line, Text, Circle } from 'react-konva';
import { Component } from '@/types';
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG, SNAP_CONFIG } from '@/constants/grid';
import { TILE_COLORS } from '@/constants/tileConfig';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';

interface PavingAreaComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

type Pt = { x: number; y: number };

/** Calculate polygon area using shoelace formula - returns m² */
function calculatePolygonAreaM2(pts: Pt[]): number {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  area = Math.abs(area / 2); // px²
  // Convert from canvas px² to m²
  const pxPerMm = GRID_CONFIG.spacing / 100;
  const mmPerPx = 1 / pxPerMm;
  return (area * mmPerPx * mmPerPx) / 1_000_000;
}

export const PavingAreaComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onContextMenu,
}: PavingAreaComponentProps) => {
  const updateComponent = useDesignStore((s) => s.updateComponent);
  const updateComponentSilent = useDesignStore((s) => s.updateComponentSilent);
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
  const blueprintMode = useDesignStore((s) => s.blueprintMode);
  const zoom = useDesignStore((s) => s.zoom);
  const allComponents = useDesignStore((s) => s.components);

  const pxPerMm = GRID_CONFIG.spacing / 100;
  const boundaryStage: Pt[] = component.properties.boundary || [];
  const areaSurface = (component.properties as any).areaSurface || 'pavers';

  const groupRef = useRef<any>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<Pt[] | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);

  // Calculate bounding box for positioning
  const bbox = useMemo(() => {
    if (!boundaryStage.length) return { x: 0, y: 0, width: 0, height: 0 };
    const xs = boundaryStage.map((p) => p.x);
    const ys = boundaryStage.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
    };
  }, [boundaryStage]);

  // Boundary in local coords (relative to bbox origin)
  const boundaryLocal = useMemo(
    () => boundaryStage.map((p) => ({ x: p.x - bbox.x, y: p.y - bbox.y })),
    [boundaryStage, bbox.x, bbox.y]
  );

  // Calculate area statistics from committed boundary
  const areaM2 = useMemo(() => calculatePolygonAreaM2(boundaryStage), [boundaryStage]);

  // Calculate LIVE area from preview during drag (for real-time display)
  const liveAreaM2 = useMemo(() => {
    if (!localPreview) return areaM2;
    // Convert local preview back to stage coordinates for area calc
    const previewStage = localPreview.map(p => ({ x: p.x + bbox.x, y: p.y + bbox.y }));
    return calculatePolygonAreaM2(previewStage);
  }, [localPreview, bbox.x, bbox.y, areaM2]);

  // Calculate LIVE perimeter
  const livePerimeterLM = useMemo(() => {
    const pts = localPreview || boundaryLocal;
    let perimeter = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      perimeter += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
    // Convert px to mm (10px = 100mm) then to meters
    return (perimeter * 10) / 1000;
  }, [localPreview, boundaryLocal]);

  // Update component statistics when area changes (uses live values during drag)
  // Use silent update to avoid polluting undo/redo history with derived data
  useEffect(() => {
    const current = component.properties.statistics;
    if (!current || Math.abs((current.totalArea || 0) - liveAreaM2) > 0.001 || Math.abs((current.perimeterLM || 0) - livePerimeterLM) > 0.001) {
      updateComponentSilent(component.id, {
        properties: {
          statistics: { totalArea: liveAreaM2, perimeterLM: livePerimeterLM, fullPavers: 0, edgePavers: 0, orderQuantity: 0 },
        },
      });
    }
  }, [liveAreaM2, livePerimeterLM, component.id, component.properties.statistics, updateComponentSilent]);

  // Node selection
  const isNodeSelected = (i: number) => selectedNodes.includes(i);
  useEffect(() => {
    if (!isSelected) setSelectedNodes([]);
  }, [isSelected]);
  const toggleNode = (i: number, multi: boolean) => {
    setSelectedNodes((prev) => {
      if (!multi) return [i];
      return prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i];
    });
  };

  // Context menu
  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (!onContextMenu) return;
    const stage = e.target.getStage();
    const pt = stage.getPointerPosition();
    onContextMenu(component, { x: pt.x, y: pt.y });
  };

  // Measurements
  const renderMeasurements = () => {
    if (!(annotationsVisible || isSelected)) return null;
    const measurements: JSX.Element[] = [];
    const pts = localPreview || boundaryLocal;
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthInMM = Math.round(Math.sqrt(dx * dx + dy * dy) * 10);

      const lineLength = Math.sqrt(dx * dx + dy * dy);
      if (lineLength < 1) continue;
      const perpX = -dy / lineLength;
      const perpY = dx / lineLength;
      const offset = getAnnotationOffsetPx(component.id, component.position);

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      if (dragIndex != null && (dragIndex === i || dragIndex === (i + 1) % n)) continue;

      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      measurements.push(
        <Text
          key={`measurement-${i}`}
          x={midX + perpX * offset}
          y={midY + perpY * offset}
          text={`${lengthInMM}mm`}
          fontSize={11}
          fill={blueprintMode ? BLUEPRINT_COLORS.text : TILE_COLORS.groutColor}
          align="center"
          rotation={normalizeLabelAngle(angleDeg)}
          offsetX={20}
          listening={false}
        />
      );
    }

    // Add live stats label at top of shape
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const labelOffset = getAnnotationOffsetPx(component.id, component.position) + 15;

    const surfaceLabel = areaSurface === 'concrete' ? 'Concrete'
      : areaSurface === 'grass' ? 'Grass'
      : 'Paving';

    const statsColor = blueprintMode
      ? BLUEPRINT_COLORS.text
      : areaSurface === 'grass' ? '#15803d' : areaSurface === 'concrete' ? '#64748b' : '#D4A574';
    measurements.push(
      <Text
        key="area-stats"
        x={(minX + maxX) / 2}
        y={minY - labelOffset}
        text={`${surfaceLabel}: ${livePerimeterLM.toFixed(2)} LM · ${liveAreaM2.toFixed(2)} m²`}
        fontSize={10}
        fill={statsColor}
        align="center"
        offsetX={50}
        listening={false}
      />
    );

    return measurements;
  };

  // Drag whole object
  const handleDragEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const nextX = node.x();
    const nextY = node.y();
    const dx = nextX - bbox.x;
    const dy = nextY - bbox.y;

    if (dx === 0 && dy === 0) return;

    // Snap to grid
    const grid = SNAP_CONFIG.gridSnap || 10;
    const snappedDx = Math.round(dx / grid) * grid;
    const snappedDy = Math.round(dy / grid) * grid;

    const movedBoundary = boundaryStage.map((p) => ({
      x: p.x + snappedDx,
      y: p.y + snappedDy,
    }));

    updateComponent(component.id, {
      properties: { ...component.properties, boundary: movedBoundary },
    });
  };

  // Vertex dragging
  const vertexOriginalRef = useRef<Pt[] | null>(null);

  const onVertexDragStart = (i: number, evt: any) => {
    evt.cancelBubble = true;
    if (!isNodeSelected(i)) setSelectedNodes([i]);
    vertexOriginalRef.current = boundaryStage.map((p) => ({ ...p }));
    setDragIndex(i);
    setLocalPreview(boundaryLocal);
  };

  const onVertexDragMove = (i: number, evt: any) => {
    evt.cancelBubble = true;
    const stage = evt.target.getStage();
    const pointerRaw = stage?.getPointerPosition();
    if (!pointerRaw || !vertexOriginalRef.current) return;

    const scaleX = stage.scaleX() || 1;
    const scaleY = stage.scaleY() || 1;
    const offsetX = stage.x() || 0;
    const offsetY = stage.y() || 0;
    const pointer = {
      x: (pointerRaw.x - offsetX) / scaleX,
      y: (pointerRaw.y - offsetY) / scaleY,
    };

    // Snap to grid
    const grid = SNAP_CONFIG.gridSnap || 10;
    const snappedX = Math.round(pointer.x / grid) * grid;
    const snappedY = Math.round(pointer.y / grid) * grid;

    // Update selected vertices
    const nextStage = vertexOriginalRef.current.map((p, idx) => {
      if (isNodeSelected(idx)) {
        const origP = vertexOriginalRef.current![idx];
        const dx = snappedX - vertexOriginalRef.current![i].x;
        const dy = snappedY - vertexOriginalRef.current![i].y;
        return { x: origP.x + dx, y: origP.y + dy };
      }
      return p;
    });

    // Convert to local for preview - use ORIGINAL bbox origin, not recalculated
    // This keeps preview coordinates relative to where the Group is actually positioned
    const nextLocal = nextStage.map((p) => ({ x: p.x - bbox.x, y: p.y - bbox.y }));

    setLocalPreview(nextLocal);
  };

  const onVertexDragEnd = (i: number, evt: any) => {
    evt.cancelBubble = true;
    if (!vertexOriginalRef.current) return;

    const stage = evt.target.getStage();
    const pointerRaw = stage?.getPointerPosition();
    if (!pointerRaw) {
      setLocalPreview(null);
      setDragIndex(null);
      return;
    }

    const scaleX = stage.scaleX() || 1;
    const scaleY = stage.scaleY() || 1;
    const offsetX = stage.x() || 0;
    const offsetY = stage.y() || 0;
    const pointer = {
      x: (pointerRaw.x - offsetX) / scaleX,
      y: (pointerRaw.y - offsetY) / scaleY,
    };

    const grid = SNAP_CONFIG.gridSnap || 10;
    const snappedX = Math.round(pointer.x / grid) * grid;
    const snappedY = Math.round(pointer.y / grid) * grid;

    const nextStage = vertexOriginalRef.current.map((p, idx) => {
      if (isNodeSelected(idx)) {
        const origP = vertexOriginalRef.current![idx];
        const dx = snappedX - vertexOriginalRef.current![i].x;
        const dy = snappedY - vertexOriginalRef.current![i].y;
        return { x: origP.x + dx, y: origP.y + dy };
      }
      return p;
    });

    updateComponent(component.id, {
      properties: { ...component.properties, boundary: nextStage },
    });

    setLocalPreview(null);
    setDragIndex(null);
    vertexOriginalRef.current = null;
  };

  // Patterns for concrete/grass
  const createConcretePattern = useCallback((): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 12;
    c.height = 12;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(100, 116, 139, 0.15)';
    for (let i = 0; i < 6; i++) {
      const x = (i * 2 + 3) % c.width;
      const y = (i * 3 + 5) % c.height;
      ctx.fillRect(x, y, 1, 1);
    }
    return c;
  }, []);

  const createGrassPattern = useCallback((): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 12;
    c.height = 12;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(20, 83, 45, 0.35)';
    for (let i = 0; i < 3; i++) {
      const x = (i * 4 + 2) % c.width;
      ctx.beginPath();
      ctx.moveTo(x, c.height);
      ctx.lineTo(x + 1, c.height - 3);
      ctx.stroke();
    }
    return c;
  }, []);

  const areaPattern = useMemo(() => {
    if (areaSurface === 'concrete') return createConcretePattern();
    if (areaSurface === 'grass') return createGrassPattern();
    return null;
  }, [areaSurface, createConcretePattern, createGrassPattern]);

  // Get fill color/pattern based on surface type
  // Use extendedTile color for pavers to match coping extension style
  const getFillColor = () => {
    if (blueprintMode) return BLUEPRINT_COLORS.fillLight;
    if (areaSurface === 'concrete') return '#e5e7eb';
    if (areaSurface === 'grass') return '#15803d';
    return TILE_COLORS.extendedTile; // Lighter sandstone to match coping extension
  };

  const displayBoundary = localPreview || boundaryLocal;

  return (
    <Group
      ref={groupRef}
      x={bbox.x}
      y={bbox.y}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={handleRightClick}
      draggable={activeTool !== 'hand' && isSelected && !localPreview}
      onDragEnd={handleDragEnd}
    >
      {/* Filled polygon - use Line with fill for reliable rendering */}
      <Line
        points={displayBoundary.flatMap((p) => [p.x, p.y])}
        closed
        fill={getFillColor()}
        fillPatternImage={blueprintMode ? undefined : areaPattern as any}
        fillPatternRepeat={!blueprintMode && areaPattern ? 'repeat' : undefined}
        strokeEnabled={false}
        listening={false}
      />

      {/* Hit area (transparent, on top for clicks) */}
      <Line
        points={displayBoundary.flatMap((p) => [p.x, p.y])}
        closed
        fill="rgba(0,0,0,0.0001)"
        strokeEnabled={false}
        onClick={onSelect}
        onTap={onSelect}
      />

      {/* Border - only show when selected */}
      {isSelected && (
        <Line
          points={displayBoundary.flatMap((p) => [p.x, p.y])}
          closed
          stroke="#3B82F6"
          strokeWidth={2}
          strokeScaleEnabled={false}
          dash={[10, 5]}
          listening={false}
        />
      )}

      {/* Measurements */}
      {renderMeasurements()}

      {/* Vertex handles when selected */}
      {isSelected &&
        displayBoundary.map((pt, i) => (
          <Circle
            key={`v-${i}`}
            x={pt.x}
            y={pt.y}
            radius={Math.max(2, 4.2 / (zoom || 1))}
            fill={isNodeSelected(i) ? '#3B82F6' : 'white'}
            stroke="#3B82F6"
            strokeWidth={2}
            strokeScaleEnabled={false}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              toggleNode(i, e.evt.shiftKey);
            }}
            draggable
            dragBoundFunc={(pos) => {
              // Prevent Konva from moving the circle internally
              // We control position via localPreview state instead
              // Transform pointer to local coords and snap
              const stage = groupRef.current?.getStage();
              const group = groupRef.current;
              if (!stage || !group) return pos;

              const pointerRaw = stage.getPointerPosition();
              if (!pointerRaw) return pos;

              const scaleX = stage.scaleX() || 1;
              const scaleY = stage.scaleY() || 1;
              const stageOffsetX = stage.x() || 0;
              const stageOffsetY = stage.y() || 0;

              // Convert to canvas coordinates
              const canvasX = (pointerRaw.x - stageOffsetX) / scaleX;
              const canvasY = (pointerRaw.y - stageOffsetY) / scaleY;

              // Snap to grid
              const grid = SNAP_CONFIG.gridSnap || 10;
              const snappedX = Math.round(canvasX / grid) * grid;
              const snappedY = Math.round(canvasY / grid) * grid;

              // Convert to local (relative to group/bbox)
              const localX = snappedX - bbox.x;
              const localY = snappedY - bbox.y;

              // Transform back to absolute for Konva
              const absTransform = group.getAbsoluteTransform();
              return absTransform.point({ x: localX, y: localY });
            }}
            onDragStart={(e) => onVertexDragStart(i, e)}
            onDragMove={(e) => onVertexDragMove(i, e)}
            onDragEnd={(e) => onVertexDragEnd(i, e)}
          />
        ))}
    </Group>
  );
};
