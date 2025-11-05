import { useMemo } from 'react';
import { useDesignStore } from '@/store/designStore';

/**
 * Returns a Konva clipFunc and polygon when a single, closed boundary exists.
 * The polygon is in stage coordinates.
 */
export function useClipMask() {
  const components = useDesignStore((s) => s.components);

  const { polygon, clipFunc } = useMemo(() => {
    const boundary = components.find((c) => c.type === 'boundary');
    const pts = (boundary?.properties?.points || []) as Array<{ x: number; y: number }>;
    const closed = !!boundary?.properties?.closed;

    const valid = !!boundary && closed && pts.length >= 3;
    if (!valid) return { polygon: null as null | Array<{ x: number; y: number }>, clipFunc: null as any };

    const func = (ctx: CanvasRenderingContext2D) => {
      if (!pts || pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    };

    return { polygon: pts, clipFunc: func };
  }, [components]);

  return { polygon, clipFunc } as const;
}

