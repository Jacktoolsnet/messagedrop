import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Location } from '../interfaces/location';
import { NotificationAction } from '../interfaces/notification-action';
import { AppService } from '../services/app.service';

function normalizeId(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return undefined;
}

function normalizeLocation(value: unknown): Location | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const location = value as { latitude?: unknown; longitude?: unknown; plusCode?: unknown };
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return undefined;
    }
    const plusCode = typeof location.plusCode === 'string' ? location.plusCode : '';
    return { latitude, longitude, plusCode };
}

function normalizeNotificationTarget(value: unknown): NotificationAction | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const target = value as {
        type?: unknown;
        id?: unknown;
        placeId?: unknown;
        location?: unknown;
    };
    if (typeof target.type !== 'string' || !target.type.trim()) {
        return undefined;
    }
    const id = normalizeId(target.id);
    const placeId = normalizeId(target.placeId);
    const location = normalizeLocation(target.location);
    return {
        type: target.type.trim(),
        id,
        placeId,
        location
    };
}

export function registerLaunchHandler(injector: EnvironmentInjector) {
    runInInjectionContext(injector, () => {
        const appService = inject(AppService);

        // Push Notification
        try {
            const swPush = inject(SwPush);
            swPush.notificationClicks.subscribe((result) => {
                const data = result?.notification?.data as
                    | { target?: unknown; primaryKey?: { type?: unknown; id?: unknown } }
                    | undefined;

                const target = normalizeNotificationTarget(data?.target);
                if (target) {
                    appService.setNotificationAction(target);
                    return;
                }

                const type = typeof data?.primaryKey?.type === 'string' ? data.primaryKey.type.trim() : '';
                if (!type) {
                    return;
                }

                appService.setNotificationAction({
                    type,
                    id: normalizeId(data?.primaryKey?.id)
                });
            });
        } catch (error) {
            console.warn('Service worker push handling not available', error);
        }
    });
}
