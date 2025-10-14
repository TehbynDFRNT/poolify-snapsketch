import { Rect } from 'react-konva';
import { CopingPaverData } from '@/types/copingSelection';

interface CopingPaverProps {
  paver: CopingPaverData;
  isSelected: boolean;
  scale: number;
  onSelect: (paverId: string, isMultiSelect: boolean) => void;
  isPreview?: boolean;
  isHovered?: boolean;
}

export const CopingPaverComponent = ({
  paver,
  isSelected,
  scale,
  onSelect,
  isPreview = false,
  isHovered = false,
}: CopingPaverProps) => {
  const handleClick = (e: any) => {
    const isMultiSelect = e.evt.ctrlKey || e.evt.metaKey;
    onSelect(paver.id, isMultiSelect);
  };
  
  // Color logic
  let fill = "#9CA3AF"; // gray normal
  let stroke = "#374151";
  let strokeWidth = 2;
  let opacity = 1;
  
  if (isPreview) {
    fill = "#93C5FD"; // blue preview
    stroke = "#3B82F6";
    strokeWidth = 2;
    opacity = 0.7;
  } else if (isSelected) {
    fill = "#FCD34D"; // yellow selected
    stroke = "#F59E0B"; // orange border
    strokeWidth = 3;
    opacity = 1;
  } else if (isHovered) {
    fill = "#D1D5DB"; // lighter gray on hover
    opacity = 0.9;
  } else if (paver.isPartial) {
    fill = "#FCD34D"; // yellow partial
    opacity = 0.8;
  }
  
  return (
    <Rect
      x={paver.x * scale}
      y={paver.y * scale}
      width={paver.width * scale}
      height={paver.height * scale}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      dash={paver.isPartial || isPreview ? [5, 5] : undefined}
      opacity={opacity}
      onClick={handleClick}
      onTap={handleClick}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'pointer';
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
      listening={!isPreview}
    />
  );
};
