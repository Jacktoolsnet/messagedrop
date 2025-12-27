import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { ApiErrorService } from '../services/api-error.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const apiErrorService = inject(ApiErrorService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 404 &&
        (req.url.includes('/message/get/boundingbox') ||
          req.url.includes('/place/get/userId'))
      ) {
        return throwError(() => error);
      }
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
