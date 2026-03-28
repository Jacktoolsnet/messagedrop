import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { DisplayMessageService } from '../services/display-message.service';
import {
  getStoredAdminToken,
  getValidStoredAdminToken,
  isAdminSessionErrorResponse,
  removeStoredAdminToken
} from '../utils/admin-token.util';

let authFailureHandling = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);
    const displayMessage = inject(DisplayMessageService);
    const storedToken = getStoredAdminToken();
    const token = getValidStoredAdminToken();

    if (storedToken && !token) {
        removeStoredAdminToken();
    }

    return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req).pipe(
        catchError((error: unknown) => {
            if ((storedToken || token) && error instanceof HttpErrorResponse && isAdminSessionErrorResponse(error.status, error.error)) {
                removeStoredAdminToken();
                if (!authFailureHandling) {
                    authFailureHandling = true;
                    displayMessage.open('Your session has expired. Please sign in again.', undefined, {
                        duration: 4000,
                        panelClass: ['snack-warning'],
                        horizontalPosition: 'center',
                        verticalPosition: 'top'
                    });
                    void router.navigate(['/login']).finally(() => {
                        authFailureHandling = false;
                    });
                }
            }
            return throwError(() => error);
        })
    );
};
