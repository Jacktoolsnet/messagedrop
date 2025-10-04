import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
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
  private readonly token = localStorage.getItem('admin_token');

  private get httpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      })
    };
  }

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) { }

  private handleError(error: any) {
    this.snackBar.open('Something went wrong.', 'OK', {
      duration: 3000,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  }

  loadUsers() {
    this.http.get<User[]>(this.baseUrl, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (users) => this._users.set(users),
        error: () => { }
      });
  }

  createUser(payload: CreateUserPayload) {
    return this.http.post<{ id: string }>(this.baseUrl, payload, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  updateUser(id: string, payload: UpdateUserPayload) {
    return this.http.put<{ updated: boolean }>(`${this.baseUrl}/${id}`, payload, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  deleteUser(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`, this.httpOptions)
      .pipe(catchError(this.handleError));
  }
}