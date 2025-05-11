import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { AppService } from '../services/app.service';

export function registerLaunchHandler(injector: EnvironmentInjector) {
    runInInjectionContext(injector, () => {
        const appService = inject(AppService);
        // Web Share Target
        if ('launchQueue' in window && 'setConsumer' in (window as any).launchQueue) {
            (window as any).launchQueue.setConsumer((params: any) => {
                const formData = params?.formData;
                if (formData) {
                    const appService = inject(AppService);
                    appService.set(formData);
                }
            });
        }

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
        } catch (e) {
            console.warn('SwPush not available');
        }
    });
}