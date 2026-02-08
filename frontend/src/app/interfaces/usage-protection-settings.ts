export type UsageProtectionMode = 'off' | 'self' | 'parental';

export interface UsageProtectionSettings {
  mode: UsageProtectionMode;
  dailyLimitMinutes: number;
  selfExtensionMinutes: number;
  scheduleEnabled: boolean;
  weekdayStart: string;
  weekdayEnd: string;
  weekendStart: string;
  weekendEnd: string;
  parentPinHash?: string;
}

export interface UsageProtectionState {
  dateKey: string;
  consumedSeconds: number;
  selfExtensionUsed: boolean;
}

export interface UsageProtectionServerPayload {
  settings: UsageProtectionSettings;
  state: UsageProtectionState;
}

export const DEFAULT_USAGE_PROTECTION_SETTINGS: UsageProtectionSettings = {
  mode: 'off',
  dailyLimitMinutes: 60,
  selfExtensionMinutes: 5,
  scheduleEnabled: false,
  weekdayStart: '06:00',
  weekdayEnd: '22:00',
  weekendStart: '06:00',
  weekendEnd: '23:00'
};

export function createDefaultUsageProtectionState(dateKey = getLocalDateKey()): UsageProtectionState {
  return {
    dateKey,
    consumedSeconds: 0,
    selfExtensionUsed: false
  };
}

export function getLocalDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
