import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateUserPayload } from '../../interfaces/create-user-payload.interface';
import { UpdateUserPayload } from '../../interfaces/update-user-payload.interface';
import { User } from '../../interfaces/user.interface';
import { TranslationHelperService } from '../translation-helper.service';
import { DisplayMessageService } from '../display-message.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private _users = signal<User[]>([]);
  readonly users = this._users.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/user`;
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly i18n = inject(TranslationHelperService);

  private handleError = (error: unknown) => {
    this.snackBar.open(this.resolveErrorMessage(error), this.i18n.t('OK'), {
      duration: 3000,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  };

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message || error.error?.error || error.message;
      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return backendMessage.trim();
      }
    }
    return this.i18n.t('Something went wrong.');
  }

  loadUsers() {
    this.http.get<User[]>(this.baseUrl)
      .pipe(catchError((error) => {
        this.handleError(error);
        return of([]);
      }))
      .subscribe({
        next: (users) => this._users.set(users)
      });
  }

  createUser(payload: CreateUserPayload) {
    return this.http.post<{ id: string }>(this.baseUrl, payload)
      .pipe(catchError(this.handleError));
  }

  updateUser(id: string, payload: UpdateUserPayload) {
    return this.http.put<{ updated: boolean }>(`${this.baseUrl}/${id}`, payload)
      .pipe(catchError(this.handleError));
  }

  deleteUser(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }
}
