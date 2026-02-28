export type UsageProtectionMode = 'off' | 'self' | 'parental';
export type UsageProtectionDayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const USAGE_PROTECTION_DAY_KEYS: readonly UsageProtectionDayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;

export interface UsageProtectionDayWindow {
  start: string;
  end: string;
}

export type UsageProtectionDailyWindows = Record<UsageProtectionDayKey, UsageProtectionDayWindow>;

export interface UsageProtectionSettings {
  mode: UsageProtectionMode;
  dailyLimitMinutes: number;
  selfExtensionMinutes: number;
  selfExtensionMaxCount: number;
  parentalExtensionMinutes: number;
  parentalExtensionMaxCount: number;
  scheduleEnabled: boolean;
  dailyWindows: UsageProtectionDailyWindows;
  // Legacy fields for migration of older persisted/server payloads.
  weekdayStart?: string;
  weekdayEnd?: string;
  weekendStart?: string;
  weekendEnd?: string;
  parentPinHash?: string;
}

export interface UsageProtectionState {
  dateKey: string;
  consumedSeconds: number;
  selfExtensionsUsed: number;
  parentalExtensionsUsed: number;
  // Legacy field for migration of older persisted/server payloads.
  selfExtensionUsed?: boolean;
}

export interface UsageProtectionServerPayload {
  settings: UsageProtectionSettings;
  state: UsageProtectionState;
}

export function createDefaultUsageProtectionDailyWindows(): UsageProtectionDailyWindows {
  return {
    monday: { start: '06:00', end: '22:00' },
    tuesday: { start: '06:00', end: '22:00' },
    wednesday: { start: '06:00', end: '22:00' },
    thursday: { start: '06:00', end: '22:00' },
    friday: { start: '06:00', end: '22:00' },
    saturday: { start: '06:00', end: '23:00' },
    sunday: { start: '06:00', end: '23:00' }
  };
}

export const DEFAULT_USAGE_PROTECTION_SETTINGS: UsageProtectionSettings = {
  mode: 'off',
  dailyLimitMinutes: 60,
  selfExtensionMinutes: 5,
  selfExtensionMaxCount: 1,
  parentalExtensionMinutes: 5,
  parentalExtensionMaxCount: 20,
  scheduleEnabled: false,
  dailyWindows: createDefaultUsageProtectionDailyWindows()
};

export function createDefaultUsageProtectionState(dateKey = getLocalDateKey()): UsageProtectionState {
  return {
    dateKey,
    consumedSeconds: 0,
    selfExtensionsUsed: 0,
    parentalExtensionsUsed: 0
  };
}

export function getLocalDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
