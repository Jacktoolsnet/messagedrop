export type PinInputFeedbackHapticStrength = 'soft' | 'normal' | 'strong';

export interface PinInputFeedbackSettings {
  hapticEnabled: boolean;
  hapticStrength: PinInputFeedbackHapticStrength;
  audioEnabled: boolean;
  audioLevel: number;
}

export const DEFAULT_PIN_INPUT_FEEDBACK_SETTINGS: PinInputFeedbackSettings = {
  hapticEnabled: true,
  hapticStrength: 'soft',
  audioEnabled: true,
  audioLevel: 1
};
