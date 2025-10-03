import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginRequest } from '../../interfaces/login-request.interface';
import { LoginResponse } from '../../interfaces/login-response.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly isLoggedIn = signal(false);

  login(data: LoginRequest) {
    return this.http.post<LoginResponse>('/api/admin/login', data).subscribe({
      next: (response) => {
        localStorage.setItem('admin_token', response.token);
        this.isLoggedIn.set(true);
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Login failed', err);
        this.isLoggedIn.set(false);
      }
    });
  }

  logout() {
    localStorage.removeItem('admin_token');
    this.isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }
}