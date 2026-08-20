export const MESSAGE_READ_VISIBILITY_THRESHOLDS = [0, 0.01, 0.05, 0.1, 0.25, 0.6] as const;

/**
 * A message counts as seen when a meaningful part of it is visible. Using only
 * an intersection ratio makes long messages impossible to read on small screens:
 * a message taller than the viewport may never reach a 60% ratio.
 */
export function hasSufficientMessageVisibility(
  entry: Pick<IntersectionObserverEntry, 'isIntersecting' | 'boundingClientRect' | 'intersectionRect'>,
  viewportHeight: number
): boolean {
  if (!entry.isIntersecting) {
    return false;
  }

  const messageHeight = Math.max(0, entry.boundingClientRect.height);
  const visibleHeight = Math.max(0, entry.intersectionRect.height);
  if (messageHeight === 0 || visibleHeight === 0) {
    return false;
  }

  const requiredHeight = Math.min(
    messageHeight * 0.6,
    48,
    Math.max(1, viewportHeight * 0.5)
  );
  return visibleHeight >= requiredHeight;
}
