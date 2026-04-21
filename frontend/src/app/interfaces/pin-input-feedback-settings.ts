export interface PinInputFeedbackSettings {
  hapticEnabled: boolean;
  audioEnabled: boolean;
}

export const DEFAULT_PIN_INPUT_FEEDBACK_SETTINGS: PinInputFeedbackSettings = {
  hapticEnabled: true,
  audioEnabled: true
};
