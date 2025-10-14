import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './components/dashboards/admin-dashboard/admin-dashboard.component';
import { DsaDashboardComponent } from './components/dashboards/dsa-dashboard/dsa-dashboard.component';
import { UserDashboardComponent } from './components/dashboards/user-dashboard/user-dashboard.component';
import { AuditsComponent } from './components/dsa/audits/audits.component';
import { DecisionsComponent } from './components/dsa/decisions/decisions/decisions.component';
import { EvidencesComponent } from './components/dsa/evidences/evidences.component';
import { NoticesComponent } from './components/dsa/notice/notices/notices.component';
import { SignalsComponent } from './components/dsa/signal/signals/signals.component';
import { TransparencyComponent } from './components/dsa/transparency/transparency.component';
import { PublicStatusComponent } from './components/public-status/public-status.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './guards/auth/auth-guard';

export const routes: Routes = [
    { path: 'status/:token', component: PublicStatusComponent },
    { path: '', component: LoginComponent },
    {
        path: 'dashboard',
        component: AdminDashboardComponent,
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
    { path: '**', redirectTo: '' }
];
