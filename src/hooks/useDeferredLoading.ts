import { useEffect, useRef, useState } from 'react';

export const DEFAULT_DEFERRED_OPTIONS: Required<DeferredLoadingOptions> = {
  showDelay: 0,
  minDuration: 500,
};

export interface DeferredLoadingOptions {
  /**
   * Delay before showing the loading state. If loading completes within
   * this time, the loading state is never shown. Set to 0 to show immediately.
   */
  showDelay?: number;

  /**
   * Minimum duration to show the loading state once it becomes visible.
   * Prevents flickering for fast operations.
   */
  minDuration?: number;
}

export function useDeferredLoading(
  isLoading: boolean,
  {
    showDelay = DEFAULT_DEFERRED_OPTIONS.showDelay,
    minDuration = DEFAULT_DEFERRED_OPTIONS.minDuration,
  }: DeferredLoadingOptions = DEFAULT_DEFERRED_OPTIONS,
): boolean {
  const [showLoading, setShowLoading] = useState(showDelay === 0 && isLoading);

  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStartRef = useRef<number | null>(showDelay === 0 && isLoading ? Date.now() : null);

  useEffect(() => {
    if (isLoading) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      if (!showLoading && !showTimeoutRef.current) {
        if (showDelay > 0) {
          showTimeoutRef.current = setTimeout(() => {
            showStartRef.current = Date.now();

            setShowLoading(true);

            showTimeoutRef.current = null;
          }, showDelay);
        } else {
          showStartRef.current = Date.now();

          setShowLoading(true);
        }
      }
    } else {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }

      if (showLoading) {
        const elapsed = showStartRef.current ? Date.now() - showStartRef.current : minDuration;
        const remaining = Math.max(0, minDuration - elapsed);

        if (remaining > 0) {
          if (!hideTimeoutRef.current) {
            hideTimeoutRef.current = setTimeout(() => {
              setShowLoading(false);
              showStartRef.current = null;
              hideTimeoutRef.current = null;
            }, remaining);
          }
        } else {
          setShowLoading(false);
          showStartRef.current = null;
        }
      }
    }

    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [isLoading, showLoading, showDelay, minDuration]);

  return showLoading;
}
