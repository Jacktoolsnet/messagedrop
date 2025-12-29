import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './components/dashboards/admin-dashboard/admin-dashboard.component';
import { DsaDashboardComponent } from './components/dashboards/dsa-dashboard/dsa-dashboard.component';
import { UserDashboardComponent } from './components/dashboards/user-dashboard/user-dashboard.component';
import { AuditsComponent } from './components/dsa/audits/audits.component';
import { DecisionsComponent } from './components/dsa/decisions/decisions/decisions.component';
import { EvidencesComponent } from './components/dsa/evidences/evidences.component';
import { AppealsComponent } from './components/dsa/appeals/appeals.component';
import { NoticesComponent } from './components/dsa/notice/notices/notices.component';
import { SignalsComponent } from './components/dsa/signal/signals/signals.component';
import { TransparencyComponent } from './components/dsa/transparency/transparency.component';
import { PublicStatusComponent } from './components/public-status/public-status.component';
import { LoginComponent } from './components/login/login.component';
import { NotificationsComponent } from './components/dsa/notifications/notifications.component';
import { authGuard } from './guards/auth/auth-guard';
import { StatisticComponent } from './components/statistic/statistic.component';
import { ErrorLogsComponent } from './components/logs/error-logs/error-logs.component';
import { InfoLogsComponent } from './components/logs/info-logs/info-logs.component';
import { AppLogsComponent } from './components/logs/app-logs/app-logs.component';
import { PowLogsComponent } from './components/logs/pow-logs/pow-logs.component';
import { ModerationQueueComponent } from './components/moderation/moderation-queue/moderation-queue.component';

export const routes: Routes = [
    { path: 'status/:token', component: PublicStatusComponent },
    { path: '', component: LoginComponent },
    {
        path: 'dashboard',
        component: AdminDashboardComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/statistic',
        component: StatisticComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/notifications',
        component: NotificationsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/user',
        component: UserDashboardComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa',
        component: DsaDashboardComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/signals',
        component: SignalsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/notices',
        component: NoticesComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/appeals',
        component: AppealsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/decisions',
        component: DecisionsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/evidence',
        component: EvidencesComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/transparency',
        component: TransparencyComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/audits',
        component: AuditsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/dsa/moderation',
        component: ModerationQueueComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/logs/errors',
        component: ErrorLogsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/logs/info',
        component: InfoLogsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/logs/app',
        component: AppLogsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/logs/pow',
        component: PowLogsComponent,
        canActivate: [authGuard]
    },
    { path: '**', redirectTo: '' }
];
