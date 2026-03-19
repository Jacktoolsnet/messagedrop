import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './components/dashboards/admin-dashboard/admin-dashboard.component';
import { DsaDashboardComponent } from './components/dashboards/dsa-dashboard/dsa-dashboard.component';
import { UserDashboardComponent } from './components/dashboards/user-dashboard/user-dashboard.component';
import { AppealsComponent } from './components/dsa/appeals/appeals.component';
import { AuditsComponent } from './components/dsa/audits/audits.component';
import { DecisionsComponent } from './components/dsa/decisions/decisions/decisions.component';
import { EvidencesComponent } from './components/dsa/evidences/evidences.component';
import { NoticesComponent } from './components/dsa/notice/notices/notices.component';
import { NotificationsComponent } from './components/dsa/notifications/notifications.component';
import { SignalsComponent } from './components/dsa/signal/signals/signals.component';
import { TransparencyComponent } from './components/dsa/transparency/transparency.component';
import { UserModerationComponent } from './components/dsa/user-moderation/user-moderation.component';
import { LoginComponent } from './components/login/login.component';
import { AppLogsComponent } from './components/loging/app-logs/app-logs.component';
import { PublicContentEditorComponent } from './components/content/public-content-editor/public-content-editor.component';
import { PublicContentListComponent } from './components/content/public-content-list/public-content-list.component';
import { PublicProfileManagerComponent } from './components/content/public-profile-manager/public-profile-manager.component';
import { ErrorLogsComponent } from './components/loging/error-logs/error-logs.component';
import { InfoLogsComponent } from './components/loging/info-logs/info-logs.component';
import { PowLogsComponent } from './components/loging/pow-logs/pow-logs.component';
import { WarnLogsComponent } from './components/loging/warn-logs/warn-logs.component';
import { MaintenanceComponent } from './components/maintenance/maintenance.component';
import { ModerationQueueComponent } from './components/moderation/moderation-queue/moderation-queue.component';
import { PublicStatusComponent } from './components/public-status/public-status.component';
import { PublicOverviewComponent } from './components/statistic/public-overview/public-overview.component';
import { StatisticComponent } from './components/statistic/statistic.component';
import { authGuard } from './guards/auth/auth-guard';
import { CONTENT_MODULE_ROLES, DSA_MODULE_ROLES, MODERATION_MODULE_ROLES, ROOT_ADMIN_ROLES, USER_MODULE_ROLES } from './utils/admin-role-access';

export const routes: Routes = [
    { path: 'status/:token', component: PublicStatusComponent },
    { path: 'transparency', component: TransparencyComponent },
    { path: 'public-statistics', component: PublicOverviewComponent },
    { path: '', component: LoginComponent },
    {
        path: 'dashboard',
        component: AdminDashboardComponent,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard/statistic',
        component: StatisticComponent,
        canActivate: [authGuard],
        data: { allowedRoles: ROOT_ADMIN_ROLES }
    },
    {
        path: 'dashboard/maintenance',
        component: MaintenanceComponent,
        canActivate: [authGuard],
        data: { allowedRoles: ROOT_ADMIN_ROLES }
    },
    {
        path: 'dashboard/dsa/notifications',
        component: NotificationsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/user',
        component: UserDashboardComponent,
        canActivate: [authGuard],
        data: { allowedRoles: USER_MODULE_ROLES }
    },
    {
        path: 'dashboard/content',
        component: PublicContentListComponent,
        canActivate: [authGuard],
        data: { allowedRoles: CONTENT_MODULE_ROLES }
    },
    {
        path: 'dashboard/content/create',
        component: PublicContentEditorComponent,
        canActivate: [authGuard],
        data: { allowedRoles: CONTENT_MODULE_ROLES }
    },
    {
        path: 'dashboard/content/profiles',
        component: PublicProfileManagerComponent,
        canActivate: [authGuard],
        data: { allowedRoles: CONTENT_MODULE_ROLES }
    },
    {
        path: 'dashboard/content/:id/edit',
        component: PublicContentEditorComponent,
        canActivate: [authGuard],
        data: { allowedRoles: CONTENT_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa',
        component: DsaDashboardComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/signals',
        component: SignalsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/notices',
        component: NoticesComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/appeals',
        component: AppealsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/decisions',
        component: DecisionsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/evidence',
        component: EvidencesComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/transparency',
        component: TransparencyComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/user-moderation',
        component: UserModerationComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/audits',
        component: AuditsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: DSA_MODULE_ROLES }
    },
    {
        path: 'dashboard/dsa/moderation',
        component: ModerationQueueComponent,
        canActivate: [authGuard],
        data: { allowedRoles: MODERATION_MODULE_ROLES }
    },
    {
        path: 'dashboard/logs/errors',
        component: ErrorLogsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: ROOT_ADMIN_ROLES }
    },
    {
        path: 'dashboard/logs/warn',
        component: WarnLogsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: ROOT_ADMIN_ROLES }
    },
    {
        path: 'dashboard/logs/info',
        component: InfoLogsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: ROOT_ADMIN_ROLES }
    },
    {
        path: 'dashboard/logs/app',
        component: AppLogsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: ROOT_ADMIN_ROLES }
    },
    {
        path: 'dashboard/logs/pow',
        component: PowLogsComponent,
        canActivate: [authGuard],
        data: { allowedRoles: ROOT_ADMIN_ROLES }
    },
    { path: '**', redirectTo: '' }
];
