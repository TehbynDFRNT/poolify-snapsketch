import { useState, useEffect, useCallback, useRef } from 'react';
import { TOUR_STEPS, TOUR_STORAGE_KEY, type TourStep } from '@/config/tourSteps';

interface TooltipPosition {
  x: number;
  y: number;
  actualPlacement: TourStep['placement'];
}

export interface OnboardingTourState {
  active: boolean;
  currentStep: number;
  totalSteps: number;
  step: TourStep | null;
  targetRect: DOMRect | null;
  tooltipPos: TooltipPosition | null;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT_ESTIMATE = 180;

function computeTooltipPosition(
  rect: DOMRect,
  placement: TourStep['placement'],
  padding: number
): TooltipPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const padded = {
    top: rect.top - padding,
    left: rect.left - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  let x: number;
  let y: number;
  let actual = placement;

  switch (placement) {
    case 'bottom':
      x = padded.left + padded.width / 2 - TOOLTIP_WIDTH / 2;
      y = padded.bottom + TOOLTIP_GAP;
      if (y + TOOLTIP_HEIGHT_ESTIMATE > vh) {
        actual = 'top';
        y = padded.top - TOOLTIP_GAP - TOOLTIP_HEIGHT_ESTIMATE;
      }
      break;
    case 'top':
      x = padded.left + padded.width / 2 - TOOLTIP_WIDTH / 2;
      y = padded.top - TOOLTIP_GAP - TOOLTIP_HEIGHT_ESTIMATE;
      if (y < 0) {
        actual = 'bottom';
        y = padded.bottom + TOOLTIP_GAP;
      }
      break;
    case 'right':
      x = padded.right + TOOLTIP_GAP;
      y = padded.top + padded.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2;
      if (x + TOOLTIP_WIDTH > vw) {
        actual = 'left';
        x = padded.left - TOOLTIP_GAP - TOOLTIP_WIDTH;
      }
      break;
    case 'left':
      x = padded.left - TOOLTIP_GAP - TOOLTIP_WIDTH;
      y = padded.top + padded.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2;
      if (x < 0) {
        actual = 'right';
        x = padded.right + TOOLTIP_GAP;
      }
      break;
  }

  // Clamp to viewport
  x = Math.max(8, Math.min(x, vw - TOOLTIP_WIDTH - 8));
  y = Math.max(8, Math.min(y, vh - TOOLTIP_HEIGHT_ESTIMATE - 8));

  return { x, y, actualPlacement: actual };
}

export function useOnboardingTour(isReady: boolean): OnboardingTourState {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const activatedRef = useRef(false);

  const step = active ? TOUR_STEPS[currentStep] ?? null : null;

  // Check if should activate
  useEffect(() => {
    if (activatedRef.current || !isReady) return;
    if (window.innerWidth < 1024) return;
    if (localStorage.getItem(TOUR_STORAGE_KEY) === 'true') return;

    activatedRef.current = true;
    const timer = setTimeout(() => {
      setActive(true);
      document.body.dataset.tourActive = 'true';
    }, 1000);

    return () => clearTimeout(timer);
  }, [isReady]);

  // Compute target rect whenever step changes or window resizes
  const updateRect = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    const padding = step.spotlightPadding ?? 8;
    setTooltipPos(computeTooltipPosition(rect, step.placement, padding));
  }, [step]);

  useEffect(() => {
    updateRect();
  }, [updateRect]);

  useEffect(() => {
    if (!active) return;
    const handleResize = () => updateRect();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [active, updateRect]);

  // Escape key to dismiss
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  const finish = useCallback(() => {
    setActive(false);
    setCurrentStep(0);
    setTargetRect(null);
    setTooltipPos(null);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    delete document.body.dataset.tourActive;
  }, []);

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  }, [currentStep, finish]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  return {
    active,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    step,
    targetRect,
    tooltipPos,
    next,
    prev,
    skip: finish,
  };
}

/** Call this to restart the tour (e.g. from help card) */
export function restartTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  // Force reload to trigger tour again with clean state
  window.location.reload();
}
