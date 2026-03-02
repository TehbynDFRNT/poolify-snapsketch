import { createPortal } from 'react-dom';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { Button } from '@/components/ui/button';

interface OnboardingTourProps {
  isReady: boolean;
}

export function OnboardingTour({ isReady }: OnboardingTourProps) {
  const tour = useOnboardingTour(isReady);

  if (!tour.active || !tour.targetRect || !tour.tooltipPos || !tour.step) {
    return null;
  }

  const { targetRect, tooltipPos, step } = tour;
  const padding = step.spotlightPadding ?? 8;

  // Spotlight cutout bounds (padded around target)
  const cutout = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  // Four overlay rects forming the dimmed frame
  const overlayColor = 'rgba(0,0,0,0.5)';

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Top overlay */}
      <div
        className="absolute left-0 right-0 top-0 pointer-events-auto"
        style={{
          height: Math.max(0, cutout.top),
          backgroundColor: overlayColor,
        }}
      />
      {/* Bottom overlay */}
      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-auto"
        style={{
          top: cutout.top + cutout.height,
          backgroundColor: overlayColor,
        }}
      />
      {/* Left overlay */}
      <div
        className="absolute left-0 pointer-events-auto"
        style={{
          top: cutout.top,
          height: cutout.height,
          width: Math.max(0, cutout.left),
          backgroundColor: overlayColor,
        }}
      />
      {/* Right overlay */}
      <div
        className="absolute right-0 pointer-events-auto"
        style={{
          top: cutout.top,
          height: cutout.height,
          left: cutout.left + cutout.width,
          backgroundColor: overlayColor,
        }}
      />

      {/* Spotlight ring */}
      <div
        className="absolute rounded-lg pointer-events-none"
        style={{
          top: cutout.top - 2,
          left: cutout.left - 2,
          width: cutout.width + 4,
          height: cutout.height + 4,
          border: '2px solid rgba(59, 130, 246, 0.7)',
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.3)',
        }}
      />

      {/* Tooltip Card */}
      <div
        className="absolute z-[61] pointer-events-auto"
        style={{
          left: tooltipPos.x,
          top: tooltipPos.y,
          width: 320,
        }}
      >
        {/* Arrow */}
        <Arrow placement={tooltipPos.actualPlacement} />

        <div className="bg-background border border-border rounded-xl shadow-2xl p-4">
          {/* Step counter */}
          <div className="text-xs text-muted-foreground mb-2">
            {tour.currentStep + 1} of {tour.totalSteps}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground text-sm mb-1">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={tour.skip}
              className="text-xs text-muted-foreground h-8"
            >
              Skip tour
            </Button>
            <div className="flex gap-2">
              {tour.currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={tour.prev} className="h-8">
                  Back
                </Button>
              )}
              <Button size="sm" onClick={tour.next} className="h-8">
                {tour.currentStep === tour.totalSteps - 1 ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Arrow({ placement }: { placement: 'top' | 'bottom' | 'left' | 'right' }) {
  const size = 8;
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
  };

  switch (placement) {
    case 'bottom':
      // Arrow points up (tooltip is below target)
      return (
        <div
          style={{
            ...baseStyle,
            top: -size,
            left: '50%',
            marginLeft: -size,
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderBottom: `${size}px solid hsl(var(--border))`,
          }}
        />
      );
    case 'top':
      // Arrow points down (tooltip is above target)
      return (
        <div
          style={{
            ...baseStyle,
            bottom: -size,
            left: '50%',
            marginLeft: -size,
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderTop: `${size}px solid hsl(var(--border))`,
          }}
        />
      );
    case 'right':
      // Arrow points left (tooltip is to the right)
      return (
        <div
          style={{
            ...baseStyle,
            left: -size,
            top: '50%',
            marginTop: -size,
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderRight: `${size}px solid hsl(var(--border))`,
          }}
        />
      );
    case 'left':
      // Arrow points right (tooltip is to the left)
      return (
        <div
          style={{
            ...baseStyle,
            right: -size,
            top: '50%',
            marginTop: -size,
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderLeft: `${size}px solid hsl(var(--border))`,
          }}
        />
      );
  }
}
