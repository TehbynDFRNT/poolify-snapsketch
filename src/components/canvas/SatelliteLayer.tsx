import { useEffect, useMemo, useState } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import type { Component } from '@/types';

interface SatelliteLayerProps {
  components: Component[];
  coordinates?: { lat: number; lng: number };
  visible: boolean;
  rotation: number; // Rotation in degrees
  // Stage info to pick best resolution image
  stageZoom?: number; // current Konva Stage zoom
  viewportWidthPx?: number; // current visible viewport width in CSS pixels
}

type LoadedImage = {
  zoom: number;
  img: HTMLImageElement;
  coverageMeters: number; // ground width covered by the requested size (NOT including scale factor)
  widthUnits: number; // canvas units width (1m = 100 units)
};

export const SatelliteLayer = ({ components, coordinates, visible, rotation, stageZoom = 1, viewportWidthPx = 1024 }: SatelliteLayerProps) => {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use canvas center (0, 0) for positioning
  const center = { x: 0, y: 0 };

  // meters-per-pixel at latitude for a web mercator map at a given zoom
  const metersPerPixel = (lat: number, zoom: number) => {
    const earthCircumference = 40075016.686; // meters at equator
    const tileSize = 256; // px
    return (Math.cos((lat * Math.PI) / 180) * earthCircumference) / (tileSize * Math.pow(2, zoom));
  };

  // Preload a set of images across zooms for better clarity on canvas zoom
  useEffect(() => {
    if (!visible || !coordinates) {
      setImages([]);
      setLoading(false);
      setError(null);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is missing');
      setError('Missing Google Maps API key');
      setImages([]);
      return;
    }

    const abort = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Choose a set of zooms to balance quality vs requests
        // Wider to narrower coverage
        const zoomLevels = [17, 18, 19, 20, 21];
        const size = 640; // requested logical size
        const scale = 2; // device scale for higher DPI

        const promises = zoomLevels.map(async (z) => {
          const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
          url.searchParams.append('center', `${coordinates.lat},${coordinates.lng}`);
          url.searchParams.append('zoom', z.toString());
          url.searchParams.append('size', `${size}x${size}`);
          url.searchParams.append('maptype', 'satellite');
          url.searchParams.append('key', apiKey);
          url.searchParams.append('scale', scale.toString());

          const img = new window.Image();
          img.crossOrigin = 'anonymous';

          await new Promise<void>((resolve, reject) => {
            if (abort.signal.aborted) return reject(new Error('aborted'));
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
            img.src = url.toString();
          });

          const mpp = metersPerPixel(coordinates.lat, z);
          // Ground coverage width depends on requested logical size (not scale)
          const coverageMeters = mpp * size;
          const widthUnits = coverageMeters * 100; // 1m = 100 canvas units

          return { zoom: z, img, coverageMeters, widthUnits } as LoadedImage;
        });

        const settled = await Promise.allSettled(promises);
        const loaded = settled
          .filter((r): r is PromiseFulfilledResult<LoadedImage> => r.status === 'fulfilled')
          .map((r) => r.value);
        if (loaded.length === 0) {
          throw new Error('No satellite images loaded for any zoom level');
        }
        // Sort by coverage ascending (narrowest first)
        loaded.sort((a, b) => a.widthUnits - b.widthUnits);
        setImages(loaded);
      } catch (e: any) {
        console.error('Failed to load satellite images:', e);
        setError('Failed to load satellite images');
        setImages([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => {
      abort.abort();
    };
  }, [visible, coordinates]);

  // Select the best image based on viewport width in canvas units
  const selected = useMemo(() => {
    if (!visible || images.length === 0) return null;
    const viewWidthUnits = viewportWidthPx / stageZoom;
    const desiredCoverage = viewWidthUnits * 1.25; // add margin to reduce switching
    const candidates = images.filter((im) => im.widthUnits >= desiredCoverage);
    if (candidates.length > 0) {
      // Pick the smallest that still covers
      return candidates[0];
    }
    // Otherwise fallback to the largest (widest coverage)
    return images[images.length - 1];
  }, [images, visible, stageZoom, viewportWidthPx]);

  if (!visible || !selected || !center) {
    return null;
  }

  // Use computed coverage to map to canvas units
  const imageWidthInUnits = selected.widthUnits;

  return (
    <Group listening={false}>
      <KonvaImage
        image={selected.img}
        x={center.x}
        y={center.y}
        offsetX={imageWidthInUnits / 2}
        offsetY={imageWidthInUnits / 2}
        width={imageWidthInUnits}
        height={imageWidthInUnits}
        rotation={rotation}
        opacity={1.0}
        listening={false}
      />
    </Group>
  );
};
