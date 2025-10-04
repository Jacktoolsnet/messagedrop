import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './components/dashboard/admin-dashboard/admin-dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './guards/auth/auth-guard';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    {
        path: 'dashboard',
        component: AdminDashboardComponent,
        canActivate: [authGuard] // 👈 hier absichern!
    },
    { path: '**', redirectTo: '' }
];