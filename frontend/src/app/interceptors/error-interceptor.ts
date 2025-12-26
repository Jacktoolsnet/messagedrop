import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { ApiErrorService } from '../services/api-error.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const apiErrorService = inject(ApiErrorService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const message = apiErrorService.getErrorMessage(error);
      snackBar.open(message, undefined, {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return throwError(() => error);
    })
  );
};
