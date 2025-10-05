import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './components/dashboards/admin-dashboard/admin-dashboard.component';
import { UserDashboardComponent } from './components/dashboards/user-dashboard/user-dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './guards/auth/auth-guard';

export const routes: Routes = [
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
    { path: '**', redirectTo: '' }
];