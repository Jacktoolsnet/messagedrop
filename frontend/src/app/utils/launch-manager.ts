import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { AppService } from '../services/app.service';

export function registerLaunchHandler(injector: EnvironmentInjector) {
    runInInjectionContext(injector, () => {
        const appService = inject(AppService);

        // Push Notification
        try {
            const swPush = inject(SwPush);
            swPush.notificationClicks.subscribe((result) => {
                const data = result.notification.data.primaryKey;
                appService.setNotificationAction({
                    type: data.type,
                    id: data.id
                });
            });
        } catch (error) {
            console.warn('Service worker push handling not available', error);
        }
    });
}
