import { Group, Line, Rect, Circle, Text } from 'react-konva';
import { Component } from '@/types';
import { FENCE_TYPES } from '@/constants/components';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';

interface FenceComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onExtend?: (length: number) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const FenceComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onDragEnd,
  onExtend,
  onContextMenu,
}: FenceComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [selectedSeg, setSelectedSeg] = useState<{ run: number; seg: number } | null>(null);
  const [hoverSeg, setHoverSeg] = useState<{ run: number; seg: number } | null>(null);

  const groupRef = useRef<any>(null);
  const selectFenceSegment = useDesignStore((s) => s.selectFenceSegment);
  const selectedFenceGlobal = useDesignStore((s) => s.selectedFenceSegment);

  // Local context menu handler (needs to be defined before JSX usage)
  const handleContextMenuLocal = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  const scale = 0.1;
  const fenceType = component.properties.fenceType || 'glass';
  const fenceData = FENCE_TYPES[fenceType];
  const length = (component.dimensions.width || 2400);

  const blueprintMode = useDesignStore((s) => s.blueprintMode);
  const normalColor = fenceData.color;
  const color = blueprintMode ? BLUEPRINT_COLORS.primary : normalColor;
  const textColor = blueprintMode ? BLUEPRINT_COLORS.text : normalColor;
  const metalColor = blueprintMode ? BLUEPRINT_COLORS.secondary : FENCE_TYPES.metal.color;
  const strokeWidth = fenceType === 'glass' ? 2 : 4;
  const railGapPx = fenceType === 'glass' ? 8 : 5; // 80mm for glass, 50mm for flat-top metal

  // mm->px at current scale (1:100 => 10px = 100mm)
  const mmToPx = (mm: number) => mm / 10;
  // Partitioning configs
  const GLASS_CFG = {
    pref: mmToPx(1400),
    min: mmToPx(340),
    max: mmToPx(2000),
    gap: mmToPx(80),
    startGap: mmToPx(80),
    endGap: mmToPx(80),
  };
  const METAL_CFG = {
    pref: mmToPx(2000),
    min: mmToPx(200),
    max: mmToPx(2500),
    gap: mmToPx(50),
    startGap: mmToPx(50),
    endGap: mmToPx(50),
    postSize: 12,
  };

  // Visual thicknesses (scale-accurate mm)
  const glassPaneStrokeWidth = mmToPx(40); // 40mm glass pane thickness
  const metalBandStrokeWidth = mmToPx(30); // 30mm flat-top metal band thickness

  // Polyline mode
  const polyPoints: Array<{ x: number; y: number }> = component.properties.points || [];
  const isPolyline = Array.isArray(polyPoints) && polyPoints.length >= 2;

  const updateComponent = useDesignStore((s) => s.updateComponent);
  const updateComponentSilent = useDesignStore((s) => s.updateComponentSilent);
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [ghostLocal, setGhostLocal] = useState<Array<{ x: number; y: number }> | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
      if (e.key === 'Escape') {
        setSelectedSeg(null);
        selectFenceSegment(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Calculate live total LM (uses ghostLocal during drag for real-time updates)
  const liveTotalLM = useMemo(() => {
    const pts = ghostLocal
      ? ghostLocal.map((p) => ({ x: p.x + component.position.x, y: p.y + component.position.y }))
      : polyPoints;
    if (pts.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      total += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) * 10 / 1000; // px to LM
    }
    return total;
  }, [ghostLocal, polyPoints, component.position.x, component.position.y]);

  // Update component properties with live stats during drag
  // Use silent update to avoid polluting undo/redo history with derived data
  useEffect(() => {
    if (!isPolyline) return;
    const current = component.properties.totalLM as number | undefined;
    if (current === undefined || Math.abs(current - liveTotalLM) > 0.001) {
      updateComponentSilent(component.id, {
        properties: { totalLM: liveTotalLM },
      });
    }
  }, [liveTotalLM, isPolyline, component.id, component.properties.totalLM, updateComponentSilent]);

  // Helpers for offsetting a polyline by a constant distance
  const len = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
  const norm = (v: { x: number; y: number }) => {
    const l = len(v) || 1;
    return { x: v.x / l, y: v.y / l };
  };
  const sub = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (v: { x: number; y: number }, s: number) => ({ x: v.x * s, y: v.y * s });
  const perp = (v: { x: number; y: number }) => ({ x: -v.y, y: v.x });
  const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

  const offsetPolyline = (pts: Array<{ x: number; y: number }>, offset: number) => {
    const n = pts.length;
    if (n < 2) return pts.slice();
    const out: Array<{ x: number; y: number }> = new Array(n);
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        const t = norm(sub(pts[1], pts[0]));
        const nrm = perp(t);
        out[i] = add(pts[i], mul(nrm, offset));
      } else if (i === n - 1) {
        const t = norm(sub(pts[i], pts[i - 1]));
        const nrm = perp(t);
        out[i] = add(pts[i], mul(nrm, offset));
      } else {
        const tPrev = norm(sub(pts[i], pts[i - 1]));
        const tNext = norm(sub(pts[i + 1], pts[i]));
        const n1 = perp(tPrev);
        const n2 = perp(tNext);
        // Compute miter direction
        let m = add(n1, n2);
        const mLen = len(m);
        if (mLen < 1e-6) {
          // Straight line or 180° turn; fall back to previous normal
          out[i] = add(pts[i], mul(n2, offset));
        } else {
          m = mul(m, 1 / mLen);
          // Scale to keep constant offset
          const denom = dot(m, n2);
          const scale = denom !== 0 ? offset / denom : offset;
          out[i] = add(pts[i], mul(m, scale));
        }
      }
    }
    return out;
  };

  if (isPolyline) {
    const localPts = ghostLocal
      ? ghostLocal
      : polyPoints.map((p) => ({ x: p.x - component.position.x, y: p.y - component.position.y }));
    const xs = localPts.map((p) => p.x);
    const ys = localPts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const toLocalFromAbs = (abs: { x: number; y: number }) => {
      const group = groupRef.current;
      if (!group) return abs;
      const tr = group.getAbsoluteTransform().copy();
      const inv = tr.copy().invert();
      return inv.point(abs);
    };
    const toAbsFromLocal = (local: { x: number; y: number }) => {
      const group = groupRef.current;
      if (!group) return local;
      const tr = group.getAbsoluteTransform().copy();
      return tr.point(local);
    };

    // Build continuous rail polylines by offsetting the centerline
    const railOffset = railGapPx / 2; // half of visual gap
    const topRail = offsetPolyline(localPts, -railOffset);
    const bottomRail = offsetPolyline(localPts, railOffset);
    const pxPerMm = GRID_CONFIG.spacing / 100;
    const hitWidthPx = 10 * pxPerMm; // standard 10mm clickable width
    const flat = (arr: Array<{ x: number; y: number }>) => arr.flatMap((p) => [p.x, p.y]);

    // Utilities to sample along centerline
    const segLens = localPts.slice(1).map((p, i) => Math.hypot(p.x - localPts[i].x, p.y - localPts[i].y));
    const totalLen = segLens.reduce((a, b) => a + b, 0);
    const getPointAt = (s: number) => {
      let dist = s;
      for (let i = 0; i < segLens.length; i++) {
        const L = segLens[i];
        const a = localPts[i];
        const b = localPts[i + 1];
        if (dist <= L || i === segLens.length - 1) {
          const t = Math.max(0, Math.min(1, L > 0 ? dist / L : 0));
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          const tx = b.x - a.x;
          const ty = b.y - a.y;
          const tl = Math.hypot(tx, ty) || 1;
          return { pos: { x, y }, tangent: { x: tx / tl, y: ty / tl } };
        }
        dist -= L;
      }
      const last = localPts[localPts.length - 1];
      const prev = localPts[localPts.length - 2];
      const tx = last.x - prev.x;
      const ty = last.y - prev.y;
      const tl = Math.hypot(tx, ty) || 1;
      return { pos: last, tangent: { x: tx / tl, y: ty / tl } };
    };

    // Sub-polyline helper for [s0, s1] along centerline (inclusive)
    const subPolylineBetween = (s0: number, s1: number) => {
      const pts: Array<{ x: number; y: number }> = [];
      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      const start = clamp(s0, 0, totalLen);
      const end = clamp(s1, 0, totalLen);
      const stepEnds: number[] = [];
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        acc += segLens[i];
        stepEnds.push(acc);
      }
      const addPointAt = (s: number) => {
        const { pos } = getPointAt(s);
        if (pts.length === 0 || pts[pts.length - 1].x !== pos.x || pts[pts.length - 1].y !== pos.y) {
          pts.push(pos);
        }
      };
      addPointAt(start);
      let s = start;
      while (s < end - 1e-6) {
        // Find next original vertex distance after s
        const nextEnd = stepEnds.find((d) => d > s);
        const nextS = nextEnd == null ? end : Math.min(end, nextEnd);
        if (Math.abs(nextS - end) < 1e-6) {
          addPointAt(end);
          break;
        } else {
          // push that vertex position (exact)
          const idx = stepEnds.indexOf(nextEnd!);
          const v = localPts[idx + 1];
          if (v) pts.push({ x: v.x, y: v.y });
          s = nextS;
        }
      }
      return pts;
    };

    return (
      <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={activeTool !== 'hand' && isSelected && !shiftPressed}
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={handleContextMenuLocal}
        onDragStart={(e) => {
          dragStartPos.current = { x: component.position.x, y: component.position.y };
        }}
        onDragEnd={(e) => {
          const spacing = GRID_CONFIG.spacing;
          const newX = Math.round(e.target.x() / spacing) * spacing;
          const newY = Math.round(e.target.y() / spacing) * spacing;
          const start = dragStartPos.current || { x: component.position.x, y: component.position.y };
          const dx = newX - start.x;
          const dy = newY - start.y;
          const translated = polyPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          updateComponent(component.id, { position: { x: newX, y: newY }, properties: { ...component.properties, points: translated } });
          dragStartPos.current = null;
        }}
      >
        {/* Blueprint mode: simple construction plan fence style */}
        {blueprintMode && (
          <>
            {/* Main fence line */}
            <Line
              points={flat(localPts)}
              stroke={color}
              strokeWidth={2}
              lineCap="butt"
              lineJoin="round"
              hitStrokeWidth={20}
              opacity={ghostLocal ? 0.6 : 1}
            />
            {/* Perpendicular tick marks at regular intervals */}
            {(() => {
              const ticks: JSX.Element[] = [];
              const tickSpacing = 20; // px between ticks
              const tickLength = 6; // px perpendicular length
              for (let i = 1; i < localPts.length; i++) {
                const a = localPts[i - 1];
                const b = localPts[i];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const segLen = Math.hypot(dx, dy);
                if (segLen < 1) continue;
                const nx = -dy / segLen; // perpendicular
                const ny = dx / segLen;
                const numTicks = Math.floor(segLen / tickSpacing);
                for (let t = 1; t <= numTicks; t++) {
                  const ratio = t / (numTicks + 1);
                  const px = a.x + dx * ratio;
                  const py = a.y + dy * ratio;
                  ticks.push(
                    <Line
                      key={`tick-${i}-${t}`}
                      points={[px - nx * tickLength, py - ny * tickLength, px + nx * tickLength, py + ny * tickLength]}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  );
                }
              }
              return ticks;
            })()}
          </>
        )}

        {/* Normal mode: Rails */}
        {!blueprintMode && fenceType !== 'glass' && fenceType !== 'metal' && (
          <>
            <Line points={flat(topRail)} stroke={color} strokeWidth={strokeWidth} lineCap="butt" lineJoin="round" hitStrokeWidth={16} opacity={ghostLocal ? 0.6 : 1} />
            <Line points={flat(bottomRail)} stroke={color} strokeWidth={strokeWidth} lineCap="butt" lineJoin="round" hitStrokeWidth={16} opacity={ghostLocal ? 0.6 : 1} />
          </>
        )}

        {/* Normal mode: Flat-top metal as a solid band (no mid-gap), scale-accurate thickness */}
        {!blueprintMode && fenceType === 'metal' && (
          <Line
            points={flat(localPts)}
            stroke={color}
            strokeWidth={metalBandStrokeWidth}
            lineCap="butt"
            lineJoin="round"
            hitStrokeWidth={20}
            opacity={1}
          />
        )}

        {!blueprintMode && fenceType === 'glass' && (
          <>
            {(() => {
              // Partition per straight run (node-to-node) using min/max/preferred.
              const rails: JSX.Element[] = [];
              const posts: JSX.Element[] = [];
              const cfg = GLASS_CFG;
              for (let i = 1; i < localPts.length; i++) {
                const A0 = localPts[i - 1];
                const B0 = localPts[i];
                const dx = B0.x - A0.x;
                const dy = B0.y - A0.y;
                const L = Math.hypot(dx, dy);
                if (L < 1e-3) continue;
                const tdir = { x: dx / L, y: dy / L };
                const nrm = { x: -tdir.y, y: tdir.x };
                const Leff = Math.max(0, L - cfg.startGap - cfg.endGap);
                if (Leff <= 0) continue;
                const Nmin = Math.max(1, Math.ceil((Leff + cfg.gap) / (cfg.max + cfg.gap)));
                const Nmax = Math.max(1, Math.floor((Leff + cfg.gap) / (cfg.min + cfg.gap)));
                let N = Math.max(1, Math.round((Leff + cfg.gap) / (cfg.pref + cfg.gap)));
                N = Math.min(Math.max(N, Nmin), Nmax);
                let Lpanel = (Leff - (N - 1) * cfg.gap) / N;
                if (Lpanel > cfg.max + 1e-6) { N += 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }
                if (Lpanel < cfg.min - 1e-6 && N > 1) { N -= 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }

                let s = cfg.startGap;
                for (let k = 0; k < N; k++) {
                  const s0 = s;
                  const s1 = s0 + Lpanel;
                  const a = { x: A0.x + tdir.x * s0, y: A0.y + tdir.y * s0 };
                  const b = { x: A0.x + tdir.x * s1, y: A0.y + tdir.y * s1 };
                  // Gates removed from fence rendering; always draw continuous pane segment.
                  rails.push(
                    <Line
                      key={`gp-${i}-${k}`}
                      points={[a.x, a.y, b.x, b.y]}
                      stroke={color}
                      strokeWidth={glassPaneStrokeWidth}
                      lineCap="round"
                    />
                  );
                  // Segment selection disabled

                  // Feet at 25% and 75% along the panel
                  const f1 = { x: A0.x + tdir.x * (s0 + Lpanel * 0.25), y: A0.y + tdir.y * (s0 + Lpanel * 0.25) };
                  const f2 = { x: A0.x + tdir.x * (s0 + Lpanel * 0.75), y: A0.y + tdir.y * (s0 + Lpanel * 0.75) };
                  const crossExtent = glassPaneStrokeWidth / 2 + 3;
                  const cross = (C: { x: number; y: number }) => [
                    C.x - nrm.x * crossExtent,
                    C.y - nrm.y * crossExtent,
                    C.x + nrm.x * crossExtent,
                    C.y + nrm.y * crossExtent,
                  ];
                  posts.push(<Line key={`gf1-${i}-${k}`} points={cross(f1)} stroke={metalColor} strokeWidth={strokeWidth + 2} />);
                  posts.push(<Line key={`gf2-${i}-${k}`} points={cross(f2)} stroke={metalColor} strokeWidth={strokeWidth + 2} />);

                  // Highlight if selected/hovered (also honor global selection to survive re-renders)
                  const isGlobal = !!(selectedFenceGlobal && selectedFenceGlobal.componentId === component.id && selectedFenceGlobal.run === i - 1 && selectedFenceGlobal.seg === k);
                  const isActive = isGlobal || (selectedSeg && selectedSeg.run === i - 1 && selectedSeg.seg === k) || (hoverSeg && hoverSeg.run === i - 1 && hoverSeg.seg === k);
                  if (isActive) {
                    rails.push(
                      <Line key={`ghl-${i}-${k}`} points={[a.x, a.y, b.x, b.y]} stroke={selectedSeg ? '#2563EB' : '#60A5FA'} strokeWidth={glassPaneStrokeWidth + 6} opacity={selectedSeg ? 0.5 : 0.35} lineCap="round" />
                    );
                  }

                  s = s1 + cfg.gap;
                }
              }
              return [...posts, ...rails];
            })()}
            {/* Wide invisible hit area along centerline for easier selection */}
            <Line
              points={flat(localPts)}
              stroke={color}
              strokeWidth={1}
              opacity={0.01}
              hitStrokeWidth={20}
            />
          </>
        )}

        {/* (glass markers moved into segmented renderer above) */}

        {/* Metal: posts at per-run panel boundaries based on min/max/preferred */}
        {!blueprintMode && fenceType === 'metal' && (
          <>
            {(() => {
              const elems: JSX.Element[] = [];
              const size = METAL_CFG.postSize;
              let offset = 0;
              const placed = new Set<string>();
              const keyFor = (p: { x: number; y: number }) => `${Math.round(p.x)}:${Math.round(p.y)}`;
              const placeGlobalAt = (dist: number) => {
                const { pos } = getPointAt(Math.max(0, Math.min(totalLen, dist)));
                const key = keyFor(pos);
                if (placed.has(key)) return;
                placed.add(key);
                elems.push(<Rect key={`mp-${key}`} x={pos.x - size / 2} y={pos.y - size / 2} width={size} height={size} fill={color} />);
              };
              for (let i = 1; i < localPts.length; i++) {
                const runLen = segLens[i - 1];
                const cfg = METAL_CFG;
                const Leff = Math.max(0, runLen - cfg.startGap - cfg.endGap);
                if (Leff > 0) {
                  const Nmin = Math.max(1, Math.ceil((Leff + cfg.gap) / (cfg.max + cfg.gap)));
                  const Nmax = Math.max(1, Math.floor((Leff + cfg.gap) / (cfg.min + cfg.gap)));
                  let N = Math.max(1, Math.round((Leff + cfg.gap) / (cfg.pref + cfg.gap)));
                  N = Math.min(Math.max(N, Nmin), Nmax);
                  let Lpanel = (Leff - (N - 1) * cfg.gap) / N;
                  if (Lpanel > cfg.max + 1e-6) { N += 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }
                  if (Lpanel < cfg.min - 1e-6 && N > 1) { N -= 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }

                  // Corner at start of run
                  placeGlobalAt(offset + 0);
                  // Build selectable segments and place internal boundary posts (shared at corners)
                  let sPanel = cfg.startGap;
                  for (let k = 0; k < N; k++) {
                    const s0 = sPanel;
                    const s1 = s0 + Lpanel;
                    const aPt = getPointAt(offset + s0).pos;
                    const bPt = getPointAt(offset + s1).pos;
                    // Segment selection disabled
                    // Highlight overlay if selected (also honor global selection)
                    const isGlobal = !!(selectedFenceGlobal && selectedFenceGlobal.componentId === component.id && selectedFenceGlobal.run === i - 1 && selectedFenceGlobal.seg === k);
                    const isActive = isGlobal || (selectedSeg && selectedSeg.run === i - 1 && selectedSeg.seg === k) || (hoverSeg && hoverSeg.run === i - 1 && hoverSeg.seg === k);
                    if (isActive) {
                      elems.push(
                        <Line
                          key={`mhl-${i}-${k}`}
                          points={[aPt.x, aPt.y, bPt.x, bPt.y]}
                          stroke={selectedSeg ? '#2563EB' : '#60A5FA'}
                          strokeWidth={metalBandStrokeWidth + 6}
                          opacity={selectedSeg ? 0.5 : 0.35}
                          lineCap="round"
                        />
                      );
                    }
                    // If a gate exists, skip drawing band across gate later (band uses continuous line already above). For preview here we keep only selection cues.
                    // Internal post at panel end (shared due to dedupe)
                    if (k < N - 1) placeGlobalAt(offset + s1);
                    sPanel = s1 + cfg.gap;
                  }
                  // Corner at end of run
                  placeGlobalAt(offset + runLen);
                }
                offset += runLen;
              }
              return elems;
            })()}
          </>
        )}

        {/* Ghost overlay + measurements on affected segments while dragging */}
        {dragIndex != null && ghostLocal && (
          <>
            {(() => {
              const overlay = [] as JSX.Element[];
              const idxs = [dragIndex - 1, dragIndex + 1];
              idxs.forEach((k) => {
                if (k <= 0 || k >= localPts.length) return;
                const a = localPts[k - 1];
                const b = localPts[k];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.sqrt(dx * dx + dy * dy);

                // Calculate perpendicular offset to match permanent measurements
                const lineLength = len;
                const perpX = -dy / lineLength;
                const perpY = dx / lineLength;
                const offset = getAnnotationOffsetPx(component.id, component.position);

                const midX = (a.x + b.x) / 2;
                const midY = (a.y + b.y) / 2;

                overlay.push(
                  <>
                    <Line key={`fg-${k}`} points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={3} dash={[8, 6]} opacity={0.8} />
                    <Text
                      key={`fl-${k}`}
                      x={midX + perpX * offset}
                      y={midY + perpY * offset}
                      text={`Fence${fenceType === 'glass' ? ' (Glass)' : fenceType === 'metal' ? ' (Metal)' : ''}: ${Math.round(len * 10)}mm`}
                      fontSize={11}
                      fill={textColor}
                      align="center"
                      rotation={normalizeLabelAngle((Math.atan2(dy, dx) * 180) / Math.PI)}
                      offsetX={20}
                      listening={false}
                    />
                  </>
                );
              });
              return overlay;
            })()}
          </>
        )}

        {/* Segment measurements */}
        {(annotationsVisible || isSelected) && localPts.map((pt, idx) => {
          if (idx === 0) return null;
          const a = localPts[idx - 1];
          const b = localPts[idx];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lengthInMM = Math.round(Math.sqrt(dx * dx + dy * dy) * 10); // 1px = 10mm

          // Calculate perpendicular offset to position text away from the line
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const perpX = -dy / lineLength;
          const perpY = dx / lineLength;
          const offset = getAnnotationOffsetPx(component.id, component.position);

          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;

          // Skip measurement if this segment is being dragged
          if (dragIndex === idx - 1 || dragIndex === idx) return null;

          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <Text
              key={`measurement-${idx}`}
              x={midX + perpX * offset}
              y={midY + perpY * offset}
              text={`${lengthInMM}mm`}
              fontSize={11}
              fill={textColor}
              align="center"
              rotation={normalizeLabelAngle(angleDeg)}
              offsetX={20}
              listening={false}
            />
          );
        })}

        {/* Total LM label - updates live during drag */}
        {(annotationsVisible || isSelected) && (() => {
          let totalLM = 0;
          for (let i = 1; i < localPts.length; i++) {
            const a = localPts[i - 1];
            const b = localPts[i];
            totalLM += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) * 10 / 1000; // px to LM
          }
          const labelOffset = getAnnotationOffsetPx(component.id, component.position) + 15;
          const typeLabel = fenceType === 'glass' ? 'Glass Fence' : 'Metal Fence';
          return (
            <Text
              x={(minX + maxX) / 2}
              y={minY - labelOffset}
              text={`${typeLabel}: ${totalLM.toFixed(2)} LM`}
              fontSize={10}
              fill={textColor}
              align="center"
              offsetX={40}
              listening={false}
            />
          );
        })()}

        {isSelected && (
          <Rect
            x={minX - 5}
            y={minY - 5}
            width={maxX - minX + 10}
            height={maxY - minY + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
            listening={false}
          />
        )}

        {/* Node handles */}
        {isSelected && localPts.map((pt, idx) => (
          <Circle
            key={`hdl-${idx}`}
            x={pt.x}
            y={pt.y}
            radius={6}
            fill={dragIndex === idx ? '#3B82F6' : '#ffffff'}
            stroke="#3B82F6"
            strokeWidth={2}
            draggable={shiftPressed}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setDragIndex(idx);
              setGhostLocal(localPts);
            }}
            dragBoundFunc={(pos) => {
              const s = GRID_CONFIG.spacing;
              const local = toLocalFromAbs(pos);
              const snappedLocal = { x: Math.round(local.x / s) * s, y: Math.round(local.y / s) * s };
              return toAbsFromLocal(snappedLocal) as any;
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              if (dragIndex == null) return;
              const s = GRID_CONFIG.spacing;
              const abs = e.target.getAbsolutePosition();
              const local = toLocalFromAbs(abs);
              const x = Math.round(local.x / s) * s;
              const y = Math.round(local.y / s) * s;
              const copy = localPts.slice();
              copy[dragIndex] = { x, y };
              setGhostLocal(copy);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const s = GRID_CONFIG.spacing;
              const abs = e.target.getAbsolutePosition();
              const local = toLocalFromAbs(abs);
              const x = Math.round(local.x / s) * s;
              const y = Math.round(local.y / s) * s;
              const updated = localPts.slice();
              if (dragIndex != null) updated[dragIndex] = { x, y };
              const absPts = updated.map((p) => ({ x: p.x + component.position.x, y: p.y + component.position.y }));
              updateComponent(component.id, { properties: { ...component.properties, points: absPts } });
              setDragIndex(null);
              setGhostLocal(null);
            }}
          />
        ))}
      </Group>
    );
  }

  // removed old handleRightClick (replaced with handleContextMenuLocal above)

  return (
      <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={activeTool !== 'hand' && !isDraggingHandle}
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={handleContextMenuLocal}
        onDragEnd={(e) => {
          onDragEnd({ x: e.target.x(), y: e.target.y() });
        }}
      >
      {/* No broad hit area; rely on rails and hitStrokeWidth for interaction */}

      {/* Blueprint mode: simple construction plan fence style (straight) */}
      {blueprintMode && (
        <>
          <Line points={[0, 0, length, 0]} stroke={color} strokeWidth={2} lineCap="butt" hitStrokeWidth={20} />
          {/* Perpendicular tick marks */}
          {(() => {
            const ticks: JSX.Element[] = [];
            const tickSpacing = 20;
            const tickLength = 6;
            const numTicks = Math.floor(length / tickSpacing);
            for (let t = 1; t <= numTicks; t++) {
              const px = (t / (numTicks + 1)) * length;
              ticks.push(
                <Line
                  key={`tick-s-${t}`}
                  points={[px, -tickLength, px, tickLength]}
                  stroke={color}
                  strokeWidth={1.5}
                />
              );
            }
            return ticks;
          })()}
        </>
      )}

      {/* Normal mode: Base rendering */}
      {!blueprintMode && fenceType === 'metal' && (
        <Line points={[0, 0, length, 0]} stroke={color} strokeWidth={metalBandStrokeWidth} lineCap="butt" hitStrokeWidth={20} />
      )}
      {!blueprintMode && fenceType !== 'metal' && (
        <>
          {/* Glass straight segment as single pane centered, scale-accurate 40mm */}
          <Line points={[0, 0, length, 0]} stroke={color} strokeWidth={glassPaneStrokeWidth} lineCap="round" hitStrokeWidth={16} />
        </>
      )}

      {/* Metal posts (straight segment) using min/max/preferred */}
      {!blueprintMode && fenceType === 'metal' && (() => {
        const elems = [] as JSX.Element[];
        const cfg = METAL_CFG;
        const size = cfg.postSize;
        const Leff = Math.max(0, length - cfg.startGap - cfg.endGap);
        if (Leff > 0) {
          const Nmin = Math.max(1, Math.ceil((Leff + cfg.gap) / (cfg.max + cfg.gap)));
          const Nmax = Math.max(1, Math.floor((Leff + cfg.gap) / (cfg.min + cfg.gap)));
          let N = Math.max(1, Math.round((Leff + cfg.gap) / (cfg.pref + cfg.gap)));
          N = Math.min(Math.max(N, Nmin), Nmax);
          let Lpanel = (Leff - (N - 1) * cfg.gap) / N;
          if (Lpanel > cfg.max + 1e-6) { N += 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }
          if (Lpanel < cfg.min - 1e-6 && N > 1) { N -= 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }
          let s = cfg.startGap;
          const place = (d: number) => elems.push(<Rect key={`mp-${d.toFixed(1)}`} x={d - size / 2} y={-size / 2} width={size} height={size} fill={color} />);
          place(s);
          for (let k = 0; k < N - 1; k++) { s += Lpanel; place(s); s += cfg.gap; }
          place(length - cfg.endGap);
        }
        return elems;
      })()}

      {!blueprintMode && fenceType === 'glass' && (() => {
        const rails: JSX.Element[] = [];
        const posts: JSX.Element[] = [];
        const cfg = GLASS_CFG;
        const Leff = Math.max(0, length - cfg.startGap - cfg.endGap);
        if (Leff > 0) {
          const Nmin = Math.max(1, Math.ceil((Leff + cfg.gap) / (cfg.max + cfg.gap)));
          const Nmax = Math.max(1, Math.floor((Leff + cfg.gap) / (cfg.min + cfg.gap)));
          let N = Math.max(1, Math.round((Leff + cfg.gap) / (cfg.pref + cfg.gap)));
          N = Math.min(Math.max(N, Nmin), Nmax);
          let Lpanel = (Leff - (N - 1) * cfg.gap) / N;
          if (Lpanel > cfg.max + 1e-6) { N += 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }
          if (Lpanel < cfg.min - 1e-6 && N > 1) { N -= 1; Lpanel = (Leff - (N - 1) * cfg.gap) / N; }
          let s = cfg.startGap;
          for (let k = 0; k < N; k++) {
            const s0 = s;
            const s1 = s0 + Lpanel;
            rails.push(
              <Line
                key={`gp-${k}`}
                points={[s0, 0, s1, 0]}
                stroke={color}
                strokeWidth={glassPaneStrokeWidth}
                lineCap="round"
              />
            );
            // Segment selection disabled
            const isGlobal = !!(selectedFenceGlobal && selectedFenceGlobal.componentId === component.id && selectedFenceGlobal.run === 0 && selectedFenceGlobal.seg === k);
            const isActive = isGlobal || (selectedSeg && selectedSeg.run === 0 && selectedSeg.seg === k) || (hoverSeg && hoverSeg.run === 0 && hoverSeg.seg === k);
            if (isActive) {
              rails.push(<Line key={`ghl-s-${k}`} points={[s0, 0, s1, 0]} stroke={selectedSeg ? '#2563EB' : '#60A5FA'} strokeWidth={glassPaneStrokeWidth + 6} opacity={selectedSeg ? 0.5 : 0.35} lineCap="round" />);
            }
            const f1 = s0 + Lpanel * 0.25;
            const f2 = s0 + Lpanel * 0.75;
            const crossExtent = glassPaneStrokeWidth / 2 + 3;
            posts.push(<Line key={`gp1-${k}`} points={[f1, -crossExtent, f1, crossExtent]} stroke={metalColor} strokeWidth={strokeWidth + 2} />);
            posts.push(<Line key={`gp2-${k}`} points={[f2, -crossExtent, f2, crossExtent]} stroke={metalColor} strokeWidth={strokeWidth + 2} />);
            s = s1 + cfg.gap;
          }
        }
        const hit = (<Line key="glass-hit" points={[0, 0, length, 0]} stroke={color} strokeWidth={1} opacity={0.01} hitStrokeWidth={20} />);
        return [...posts, ...rails, hit];
      })()}

      {/* Selection border and handle */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={length + 10}
            height={22}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for extending */}
          <Circle
            x={length}
            y={6}
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
              local.y = 6;
              local.x = Math.max(20, local.x);
              return tr.point(local);
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const group = groupRef.current;
              if (group) {
                const tr = group.getAbsoluteTransform().copy();
                const inv = tr.copy().invert();
                const abs = e.target.getAbsolutePosition();
                const local = inv.point(abs);
                const newLength = Math.max(20, local.x);
                onExtend?.(newLength);
              }
              setIsDraggingHandle(false);
            }}
          />
        </>
      )}
    </Group>
  );
};
