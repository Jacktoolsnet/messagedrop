import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import {
  createDefaultUsageProtectionDailyWindows,
  createDefaultUsageProtectionState,
  DEFAULT_USAGE_PROTECTION_SETTINGS,
  getLocalDateKey,
  UsageProtectionDayKey,
  UsageProtectionDayWindow,
  UsageProtectionDailyWindows,
  UsageProtectionMode,
  USAGE_PROTECTION_DAY_KEYS,
  UsageProtectionServerPayload,
  UsageProtectionSettings,
  UsageProtectionState
} from '../interfaces/usage-protection-settings';
import { AppService } from './app.service';
import { IndexedDbService } from './indexed-db.service';
import { UserService } from './user.service';

type UsageLockReason = 'daily_limit' | 'schedule' | null;

interface UsageProtectionGetResponse {
  status: number;
  usageProtection?: UsageProtectionServerPayload | null;
}

@Injectable({
  providedIn: 'root'
})
export class UsageProtectionService {
  private static readonly stateStorageKey = 'usageProtectionState';
  private static readonly timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  private readonly http = inject(HttpClient);
  private readonly appService = inject(AppService);
  private readonly indexedDb = inject(IndexedDbService);
  private readonly userService = inject(UserService);

  private readonly settingsSignal = signal<UsageProtectionSettings>({ ...DEFAULT_USAGE_PROTECTION_SETTINGS });
  private readonly stateSignal = signal<UsageProtectionState>(createDefaultUsageProtectionState());
  private readonly trackingSignal = signal(false);
  private readonly nowSignal = signal(Date.now());

  private initialized = false;
  private trackingInterval?: ReturnType<typeof setInterval>;
  private pendingPersistTicks = 0;
  private serverLoadInProgress = false;
  private lastSyncedAt = 0;
  private lastLoadedUserId = '';
  private readonly defaultDailyWindows = createDefaultUsageProtectionDailyWindows();

  readonly settings = this.settingsSignal.asReadonly();
  readonly state = this.stateSignal.asReadonly();
  readonly isTracking = this.trackingSignal.asReadonly();

  readonly lockReason = computed<UsageLockReason>(() => {
    const settings = this.settingsSignal();
    if (settings.mode === 'off') {
      return null;
    }

    const now = new Date(this.nowSignal());
    const state = this.getStateForDate(this.stateSignal(), getLocalDateKey(now));
    const schedule = this.evaluateScheduleLock(settings, now);
    if (schedule.locked) {
      return 'schedule';
    }

    const limitSeconds = this.getDailyLimitSeconds(settings, state);
    if (state.consumedSeconds >= limitSeconds) {
      return 'daily_limit';
    }

    return null;
  });

  readonly isLocked = computed(() => this.lockReason() !== null);

  readonly canUseSelfExtension = computed(() => {
    const settings = this.settingsSignal();
    if (settings.mode !== 'self' || this.lockReason() !== 'daily_limit') {
      return false;
    }
    const state = this.getStateForDate(this.stateSignal(), getLocalDateKey(new Date(this.nowSignal())));
    return !state.selfExtensionUsed && settings.selfExtensionMinutes > 0;
  });

  readonly requiresParentPin = computed(() => {
    const settings = this.settingsSignal();
    return settings.mode === 'parental' && this.lockReason() === 'daily_limit' && Boolean(settings.parentPinHash);
  });

  readonly remainingSeconds = computed<number | null>(() => {
    const settings = this.settingsSignal();
    if (settings.mode === 'off') {
      return null;
    }
    const state = this.getStateForDate(this.stateSignal(), getLocalDateKey(new Date(this.nowSignal())));
    const limitSeconds = this.getDailyLimitSeconds(settings, state);
    return Math.max(0, limitSeconds - state.consumedSeconds);
  });

  readonly nextAllowedAt = computed<number | null>(() => {
    if (this.lockReason() !== 'schedule') {
      return null;
    }
    const now = new Date(this.nowSignal());
    return this.findNextWindowStart(now, this.settingsSignal());
  });

  constructor() {
    effect(() => {
      this.appService.settingsSet();
      const appSettings = this.appService.getAppSettings();
      const normalized = this.normalizeSettings(appSettings.usageProtection);
      this.settingsSignal.set(normalized);
      this.stateSignal.update((state) => this.getStateForDate(state, getLocalDateKey(new Date(this.nowSignal()))));
      this.ensureTickerState();
    });

    effect(() => {
      this.userService.userSet();
      const user = this.userService.getUser();
      if (!this.userService.hasJwt() || !user.id) {
        this.lastLoadedUserId = '';
        return;
      }
      if (this.lastLoadedUserId === user.id) {
        return;
      }
      this.lastLoadedUserId = user.id;
      void this.loadFromServer();
    });
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    const raw = await this.indexedDb.getSetting<string>(UsageProtectionService.stateStorageKey);
    this.stateSignal.set(this.normalizeState(raw));
    this.stateSignal.update((state) => this.getStateForDate(state, getLocalDateKey(new Date(this.nowSignal()))));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.nowSignal.set(Date.now());
        this.ensureTickerState();
      });
    }
    this.ensureTickerState();
    if (this.userService.hasJwt()) {
      await this.loadFromServer();
    }
  }

  startTracking(): void {
    this.trackingSignal.set(true);
    this.ensureTickerState();
  }

  stopTracking(): void {
    this.trackingSignal.set(false);
    this.ensureTickerState();
    if (this.pendingPersistTicks > 0) {
      void this.persistState();
    }
  }

  applySelfExtension(): boolean {
    if (!this.canUseSelfExtension()) {
      return false;
    }
    this.stateSignal.update((state) => ({ ...state, selfExtensionUsed: true }));
    this.pendingPersistTicks = 5;
    void this.persistState();
    return true;
  }

  async unlockWithParentPin(pin: string): Promise<boolean> {
    const settings = this.settingsSignal();
    if (settings.mode !== 'parental' || !settings.parentPinHash) {
      return false;
    }
    const hash = await this.hashPin(pin);
    if (!hash || hash !== settings.parentPinHash) {
      return false;
    }
    const extensionSeconds = Math.max(0, settings.parentalExtensionMinutes) * 60;
    this.stateSignal.update((state) => ({
      ...state,
      consumedSeconds: Math.max(0, state.consumedSeconds - extensionSeconds),
      selfExtensionUsed: false,
      dateKey: getLocalDateKey(new Date(this.nowSignal()))
    }));
    this.pendingPersistTicks = 5;
    await this.persistState();
    return true;
  }

  async hashPin(pin: string): Promise<string> {
    const trimmed = pin.trim();
    if (!this.isValidPinFormat(trimmed) || typeof crypto === 'undefined' || !crypto.subtle) {
      return '';
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(trimmed));
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  isValidPinFormat(pin: string): boolean {
    return /^\d{4,12}$/.test(pin.trim());
  }

  formatNextAllowedTime(locale: string): string {
    const next = this.nextAllowedAt();
    if (!next) {
      return '';
    }
    return new Intl.DateTimeFormat(locale || 'en', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(next));
  }

  private ensureTickerState(): void {
    const shouldRun = this.trackingSignal()
      && this.settingsSignal().mode !== 'off'
      && typeof document !== 'undefined'
      && !document.hidden;
    if (shouldRun && !this.trackingInterval) {
      this.trackingInterval = setInterval(() => this.tick(), 1000);
      return;
    }
    if (!shouldRun && this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = undefined;
    }
  }

  private tick(): void {
    this.nowSignal.set(Date.now());
    const dateKey = getLocalDateKey(new Date(this.nowSignal()));
    let nextState = this.getStateForDate(this.stateSignal(), dateKey);
    const current = this.stateSignal();
    const changedByDate = current.dateKey !== nextState.dateKey;

    if (!this.isLocked()) {
      nextState = { ...nextState, consumedSeconds: nextState.consumedSeconds + 1 };
    }

    if (changedByDate || nextState.consumedSeconds !== current.consumedSeconds || nextState.selfExtensionUsed !== current.selfExtensionUsed) {
      this.stateSignal.set(nextState);
      this.pendingPersistTicks += 1;
    }

    if (this.pendingPersistTicks >= 5) {
      void this.persistState();
    }
  }

  private async persistState(): Promise<void> {
    this.pendingPersistTicks = 0;
    const serialized = JSON.stringify(this.stateSignal());
    await this.indexedDb.setSetting(UsageProtectionService.stateStorageKey, serialized);
    await this.syncToServer();
  }

  private async loadFromServer(): Promise<void> {
    if (this.serverLoadInProgress || !this.userService.hasJwt()) {
      return;
    }
    const userId = this.userService.getUser().id;
    if (!userId) {
      return;
    }
    this.serverLoadInProgress = true;
    try {
      const url = `${environment.apiUrl}/user/usage-protection/${userId}`;
      const response = await firstValueFrom(this.http.get<UsageProtectionGetResponse>(url));
      if (response.status !== 200 || !response.usageProtection) {
        return;
      }

      const localSettings = this.normalizeSettings(this.appService.getAppSettings().usageProtection);
      const remoteState = this.normalizeState(response.usageProtection.state);
      const today = getLocalDateKey(new Date(this.nowSignal()));
      const localStateForToday = this.getStateForDate(this.stateSignal(), today);
      const remoteStateForToday = this.getStateForDate(remoteState, today);

      // Local settings are the single source of truth on this device, independent of login state.
      this.settingsSignal.set(localSettings);
      this.stateSignal.set(this.mergeStateForToday(localStateForToday, remoteStateForToday));
      await this.indexedDb.setSetting(UsageProtectionService.stateStorageKey, JSON.stringify(this.stateSignal()));
      await this.syncToServer();
    } catch {
      // ignore server sync issues and continue with local fallback
    } finally {
      this.serverLoadInProgress = false;
    }
  }

  private async syncToServer(): Promise<void> {
    if (!this.userService.hasJwt()) {
      return;
    }
    const now = Date.now();
    if (now - this.lastSyncedAt < 15000) {
      return;
    }
    const userId = this.userService.getUser().id;
    if (!userId) {
      return;
    }
    this.lastSyncedAt = now;
    try {
      const url = `${environment.apiUrl}/user/usage-protection/${userId}`;
      const payload: UsageProtectionServerPayload = {
        settings: this.settingsSignal(),
        state: this.stateSignal()
      };
      await firstValueFrom(this.http.post<SimpleStatusResponse>(url, payload));
    } catch {
      // best effort only
    }
  }

  private normalizeSettings(input: unknown): UsageProtectionSettings {
    const raw = this.asRecord(input);
    const mode = this.normalizeMode(raw?.['mode']);
    const dailyLimitMinutes = this.clampInt(raw?.['dailyLimitMinutes'], 5, 720, DEFAULT_USAGE_PROTECTION_SETTINGS.dailyLimitMinutes);
    const selfExtensionMinutes = this.clampInt(raw?.['selfExtensionMinutes'], 0, 120, DEFAULT_USAGE_PROTECTION_SETTINGS.selfExtensionMinutes);
    const parentalExtensionMinutes = this.clampInt(raw?.['parentalExtensionMinutes'], 1, 240, DEFAULT_USAGE_PROTECTION_SETTINGS.parentalExtensionMinutes);
    const scheduleEnabled = Boolean(raw?.['scheduleEnabled']);
    const dailyWindows = this.normalizeDailyWindows(raw);
    const parentPinHash = typeof raw?.['parentPinHash'] === 'string' ? raw['parentPinHash'] : undefined;
    return {
      mode,
      dailyLimitMinutes,
      selfExtensionMinutes,
      parentalExtensionMinutes,
      scheduleEnabled,
      dailyWindows,
      parentPinHash
    };
  }

  private normalizeState(input: unknown): UsageProtectionState {
    if (typeof input === 'string') {
      try {
        return this.normalizeState(JSON.parse(input));
      } catch {
        return createDefaultUsageProtectionState();
      }
    }
    const raw = this.asRecord(input);
    const dateKey = typeof raw?.['dateKey'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw['dateKey'])
      ? raw['dateKey']
      : getLocalDateKey();
    const consumedSeconds = this.clampInt(raw?.['consumedSeconds'], 0, 86400, 0);
    const selfExtensionUsed = Boolean(raw?.['selfExtensionUsed']);
    return { dateKey, consumedSeconds, selfExtensionUsed };
  }

  private getStateForDate(state: UsageProtectionState, dateKey: string): UsageProtectionState {
    if (state.dateKey === dateKey) {
      return state;
    }
    return {
      dateKey,
      consumedSeconds: 0,
      selfExtensionUsed: false
    };
  }

  private mergeStateForToday(localState: UsageProtectionState, remoteState: UsageProtectionState): UsageProtectionState {
    return {
      dateKey: localState.dateKey,
      consumedSeconds: Math.max(localState.consumedSeconds, remoteState.consumedSeconds),
      selfExtensionUsed: localState.selfExtensionUsed || remoteState.selfExtensionUsed
    };
  }

  private getDailyLimitSeconds(settings: UsageProtectionSettings, state: UsageProtectionState): number {
    const base = settings.dailyLimitMinutes * 60;
    if (settings.mode === 'self' && state.selfExtensionUsed) {
      return base + (settings.selfExtensionMinutes * 60);
    }
    return base;
  }

  private evaluateScheduleLock(settings: UsageProtectionSettings, now: Date): { locked: boolean } {
    if (!settings.scheduleEnabled) {
      return { locked: false };
    }
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const window = this.getWindowForDay(settings, now.getDay());
    const start = this.timeToMinutes(window.start);
    const end = this.timeToMinutes(window.end);
    if (start === null || end === null) {
      return { locked: false };
    }
    if (start === end) {
      return { locked: false };
    }
    if (start < end) {
      return { locked: !(currentMinutes >= start && currentMinutes < end) };
    }
    // overnight window
    return { locked: !(currentMinutes >= start || currentMinutes < end) };
  }

  private findNextWindowStart(now: Date, settings: UsageProtectionSettings): number | null {
    if (!settings.scheduleEnabled) {
      return null;
    }

    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + dayOffset);
      const window = this.getWindowForDay(settings, candidate.getDay());
      const startMinutes = this.timeToMinutes(window.start);
      const endMinutes = this.timeToMinutes(window.end);
      if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
        continue;
      }
      candidate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      if (candidate.getTime() > now.getTime()) {
        return candidate.getTime();
      }
    }
    return null;
  }

  private normalizeMode(value: unknown): UsageProtectionMode {
    if (value === 'self' || value === 'parental') {
      return value;
    }
    return 'off';
  }

  private normalizeDailyWindows(raw: Record<string, unknown> | null): UsageProtectionDailyWindows {
    const dailyWindowsRaw = this.asRecord(raw?.['dailyWindows']);
    if (dailyWindowsRaw) {
      const normalized = createDefaultUsageProtectionDailyWindows();
      for (const day of USAGE_PROTECTION_DAY_KEYS) {
        const source = this.asRecord(dailyWindowsRaw[day]);
        if (!source) {
          continue;
        }
        normalized[day] = {
          start: this.normalizeTime(source['start'], normalized[day].start),
          end: this.normalizeTime(source['end'], normalized[day].end)
        };
      }
      return normalized;
    }

    const weekdayStart = this.normalizeTime(raw?.['weekdayStart'], this.defaultDailyWindows.monday.start);
    const weekdayEnd = this.normalizeTime(raw?.['weekdayEnd'], this.defaultDailyWindows.monday.end);
    const weekendStart = this.normalizeTime(raw?.['weekendStart'], this.defaultDailyWindows.saturday.start);
    const weekendEnd = this.normalizeTime(raw?.['weekendEnd'], this.defaultDailyWindows.saturday.end);
    return {
      monday: { start: weekdayStart, end: weekdayEnd },
      tuesday: { start: weekdayStart, end: weekdayEnd },
      wednesday: { start: weekdayStart, end: weekdayEnd },
      thursday: { start: weekdayStart, end: weekdayEnd },
      friday: { start: weekdayStart, end: weekdayEnd },
      saturday: { start: weekendStart, end: weekendEnd },
      sunday: { start: weekendStart, end: weekendEnd }
    };
  }

  private getWindowForDay(settings: UsageProtectionSettings, jsDay: number): UsageProtectionDayWindow {
    const dayKey = this.resolveDayKey(jsDay);
    const fallback = this.defaultDailyWindows[dayKey];
    const source = settings.dailyWindows?.[dayKey];
    if (!source) {
      return fallback;
    }
    return {
      start: this.normalizeTime(source.start, fallback.start),
      end: this.normalizeTime(source.end, fallback.end)
    };
  }

  private resolveDayKey(jsDay: number): UsageProtectionDayKey {
    switch (jsDay) {
      case 0:
        return 'sunday';
      case 1:
        return 'monday';
      case 2:
        return 'tuesday';
      case 3:
        return 'wednesday';
      case 4:
        return 'thursday';
      case 5:
        return 'friday';
      case 6:
        return 'saturday';
      default:
        return 'monday';
    }
  }

  private normalizeTime(value: unknown, fallback: string): string {
    if (typeof value === 'string' && UsageProtectionService.timePattern.test(value)) {
      return value;
    }
    return fallback;
  }

  private timeToMinutes(value: string): number | null {
    const match = UsageProtectionService.timePattern.exec(value);
    if (!match) {
      return null;
    }
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    return hours * 60 + minutes;
  }

  private clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const num = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(num)));
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
