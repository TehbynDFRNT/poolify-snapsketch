import { useEffect, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type { Component } from '@/types';

interface SatelliteLayerProps {
  components: Component[];
  coordinates?: { lat: number; lng: number };
  visible: boolean;
  rotation: number; // Rotation in degrees
}

export const SatelliteLayer = ({ components, coordinates, visible, rotation }: SatelliteLayerProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Use canvas center (0, 0) for positioning
  const center = { x: 0, y: 0 };

  useEffect(() => {
    if (!visible || !coordinates) {
      setImage(null);
      setImageLoaded(false);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is missing');
      return;
    }

    // Use a fixed zoom level that works well for most properties
    // Zoom 19 gives us ~152 meters coverage which is good for a full canvas view
    const zoom = 19;
    const size = 640;

    // Build the URL for Google Maps Static API
    const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
    url.searchParams.append('center', `${coordinates.lat},${coordinates.lng}`);
    url.searchParams.append('zoom', zoom.toString());
    url.searchParams.append('size', `${size}x${size}`);
    url.searchParams.append('maptype', 'satellite');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('scale', '2'); // Get high-res image (1280x1280 actual pixels)

    // Load the image
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setImage(img);
      setImageLoaded(true);
    };

    img.onerror = (error) => {
      console.error('Failed to load satellite image:', error);
      setImageLoaded(false);
    };

    img.src = url.toString();

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [visible, coordinates, center]);

  if (!visible || !image || !imageLoaded || !center) {
    return null;
  }

  // Google Maps zoom 19 with scale=2 gives us ~152 meters coverage
  // Canvas scale: 100 units = 1 meter
  // So 152 meters = 15,200 canvas units
  const imageWidthInMeters = 152;
  const imageWidthInUnits = imageWidthInMeters * 100;

  return (
    <KonvaImage
      image={image}
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
  );
};
