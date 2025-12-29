import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateUserPayload } from '../../interfaces/create-user-payload.interface';
import { UpdateUserPayload } from '../../interfaces/update-user-payload.interface';
import { User } from '../../interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private _users = signal<User[]>([]);
  readonly users = this._users.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/user`;
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  private handleError = (error: unknown) => {
    this.snackBar.open('Something went wrong.', 'OK', {
      duration: 3000,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  };

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
