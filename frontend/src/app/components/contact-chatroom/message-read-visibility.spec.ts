import {
  hasSufficientMessageVisibility,
  MESSAGE_READ_VISIBILITY_THRESHOLDS
} from './message-read-visibility';

function intersectionEntry(messageHeight: number, visibleHeight: number, isIntersecting = true) {
  return {
    isIntersecting,
    boundingClientRect: { height: messageHeight } as DOMRectReadOnly,
    intersectionRect: { height: visibleHeight } as DOMRectReadOnly
  };
}

describe('message read visibility', () => {
  it('requires 60 percent of a normal message to be visible', () => {
    expect(hasSufficientMessageVisibility(intersectionEntry(60, 35), 600)).toBeFalse();
    expect(hasSufficientMessageVisibility(intersectionEntry(60, 36), 600)).toBeTrue();
  });

  it('allows a tall message to be read on a small smartphone viewport', () => {
    expect(hasSufficientMessageVisibility(intersectionEntry(1200, 48), 320)).toBeTrue();
  });

  it('does not treat a small edge intersection as read', () => {
    expect(hasSufficientMessageVisibility(intersectionEntry(1200, 12), 320)).toBeFalse();
    expect(hasSufficientMessageVisibility(intersectionEntry(60, 60, false), 320)).toBeFalse();
  });

  it('contains thresholds that can detect tall-message visibility changes', () => {
    expect(MESSAGE_READ_VISIBILITY_THRESHOLDS).toContain(0.05);
    expect(MESSAGE_READ_VISIBILITY_THRESHOLDS).toContain(0.6);
  });
});
