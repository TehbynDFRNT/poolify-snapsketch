import { Group, Rect, Image as KonvaImage } from 'react-konva';
import { Component } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { GRID_CONFIG } from '@/constants/grid';

interface DecorationComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

// Decoration images mapping with actual pixel dimensions
// Standard transformation: 1px = 0.35mm (so 100px = 35mm)
const SCALE_RATIO = 0.35;

export const DECORATION_CONFIG = {
  bush: {
    path: '/Bush.png',
    pixelWidth: 198,
    pixelHeight: 198,
  },
  umbrella: {
    path: '/Umbrella.png',
    pixelWidth: 555,
    pixelHeight: 528,
  },
  waterfeature: {
    path: '/WaterFeature.png',
    pixelWidth: 342,
    pixelHeight: 171,
  },
  deckchairs: {
    path: '/DeckChairs.png',
    pixelWidth: 477,
    pixelHeight: 441,
  },
};

// Helper to get dimensions in mm
export const getDecorationDimensions = (type: keyof typeof DECORATION_CONFIG) => {
  const config = DECORATION_CONFIG[type];
  return {
    width: config.pixelWidth * SCALE_RATIO,
    height: config.pixelHeight * SCALE_RATIO,
  };
};

export const DecorationComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onDragEnd,
  onContextMenu,
}: DecorationComponentProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const imageRef = useRef<any>(null);

  const decorationType = component.properties.decorationType || 'bush';
  const config = DECORATION_CONFIG[decorationType];

  // Use dimensions from component (which are in mm, matching the image px dimensions)
  const width = component.dimensions.width;
  const height = component.dimensions.height;

  // Load the image
  useEffect(() => {
    const img = new window.Image();
    img.src = config.path;
    img.onload = () => {
      setImage(img);
    };
  }, [config.path]);

  const handleContextMenuLocal = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  return (
    <Group
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable={activeTool !== 'hand'}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={handleContextMenuLocal}
      onDragEnd={(e) => {
        const spacing = GRID_CONFIG.spacing;
        const newX = Math.round(e.target.x() / spacing) * spacing;
        const newY = Math.round(e.target.y() / spacing) * spacing;
        onDragEnd({ x: newX, y: newY });
      }}
    >
      {/* Invisible hit rectangle for reliable clicking */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
      />

      {/* The decoration image */}
      {image && (
        <KonvaImage
          image={image}
          x={0}
          y={0}
          width={width}
          height={height}
        />
      )}

      {/* Selection border */}
      {isSelected && (
        <Rect
          x={-5}
          y={-5}
          width={width + 10}
          height={height + 10}
          stroke="#3B82F6"
          strokeWidth={2}
          dash={[10, 5]}
          listening={false}
        />
      )}
    </Group>
  );
};
