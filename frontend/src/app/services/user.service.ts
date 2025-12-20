import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwPush } from '@angular/service-worker';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { catchError, Observable, take, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CheckPinComponent } from '../components/pin/check-pin/check-pin.component';
import { CreatePinComponent } from '../components/pin/create-pin/create-pin.component';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { ConfirmUserResponse } from '../interfaces/confirm-user-response';
import { CreateUserResponse } from '../interfaces/create-user-response';
import { CryptedUser } from '../interfaces/crypted-user';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { GetPinHashResponse } from '../interfaces/get-pin-hash-response';
import { GetUserResponse } from '../interfaces/get-user-response';
import { Profile } from '../interfaces/profile';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { User } from '../interfaces/user';
import { UserType } from '../interfaces/user-type';
import { CryptoService } from './crypto.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { ServerService } from './server.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private _userSet = signal(0);
  readonly userSet = this._userSet.asReadonly();

  private user: User = {
    id: '',
    pinHash: '',
    location: {
      latitude: 0,
      longitude: 0,
      plusCode: ''
    },
    locale: '',
    language: '',
    subscription: '',
    cryptoKeyPair: {
      publicKey: {},
      privateKey: {}
    },
    signingKeyPair: {
      publicKey: {},
      privateKey: {}
    },
    serverCryptoPublicKey: '',
    serverSigningPublicKey: '',
    type: UserType.USER
  };

  private profile: Profile | undefined = {
    name: '',
    base64Avatar: ''
  };

  private tokenRenewalTimeout: ReturnType<typeof setTimeout> | null = null;

  private ready = false;
  private blocked = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly cryptoService = inject(CryptoService);
  private readonly networkService = inject(NetworkService);
  private readonly displayMessage = inject(MatDialog);
  private readonly createPinDialog = this.displayMessage;
  private readonly checkPinDialog = this.displayMessage;
  private readonly serverService = inject(ServerService);
  private readonly snackBar = inject(MatSnackBar);

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  public logout() {
    this.clearJwtRenewal();
    this.user = {
      id: '',
      pinHash: '',
      location: {
        latitude: 0,
        longitude: 0,
        plusCode: ''
      },
      locale: '',
      language: '',
      subscription: '',
      cryptoKeyPair: {
        publicKey: {},
        privateKey: {}
      },
      signingKeyPair: {
        publicKey: {},
        privateKey: {}
      },
      serverCryptoPublicKey: '',
      serverSigningPublicKey: '',
      type: UserType.USER
    };
    this.ready = false;
    this.blocked = false;
    this.initUserId();
  }

  getPinHash(pin: string, showAlways = false): Observable<GetPinHashResponse> {
    this.blocked = true;
    const url = `${environment.apiUrl}/user/hashpin`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Hashing your PIN`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = { pin: pin };
    return this.http.post<GetPinHashResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  setUser(user: User, jwt: string) {
    this.user = user;
    this.user.jwt = jwt;
    const payload = jwtDecode<JwtPayload>(jwt);
    this.user.jwtExpiresAt = payload.exp! * 1000;
    this.user.locale = navigator.language;
    this.user.language = this.getLanguageForLocation(this.user.locale);
    this.loadProfile();
    this.startJwtRenewal();
    this.ready = true;
    this._userSet.update(trigger => trigger + 1);
    this.blocked = false;
  }

  async initUserId() {
    const user = await this.indexedDbService.getUser();
    if (user) {
      this.user.id = user.id;
      this.loadProfile();
    }
  }

  async initUser(createUserResponse: CreateUserResponse, pinHash: string) {
    this.user.id = createUserResponse.userId;
    this.user.serverCryptoPublicKey = createUserResponse.cryptoPublicKey;
    this.user.serverSigningPublicKey = createUserResponse.signingPublicKey;
    this.user.cryptoKeyPair = await this.cryptoService.createEncryptionKey();
    this.user.signingKeyPair = await this.cryptoService.createSigningKey();
    const cryptedUser: CryptedUser = {
      id: this.user.id,
      cryptedUser: await this.cryptoService.encrypt(JSON.parse(this.user.serverCryptoPublicKey), JSON.stringify(this.user))
    };
    this.confirmUser(pinHash, cryptedUser)
      .subscribe({
        next: (confirmUserResponse: ConfirmUserResponse) => {
          if (confirmUserResponse.status === 200) {
            this.indexedDbService.setUser(cryptedUser)
              .then(() => {
                const dialogRef = this.displayMessage.open(DisplayMessage, {
                  panelClass: '',
                  closeOnNavigation: false,
                  data: {
                    showAlways: true,
                    title: 'User Service',
                    image: '',
                    icon: 'verified_user',
                    message: 'Your account has been created. You can log in now.',
                    button: 'Ok',
                    delay: 0,
                    showSpinner: false
                  },
                  maxWidth: '90vw',
                  maxHeight: '90vh',
                  hasBackdrop: true,
                  autoFocus: false
                });

                dialogRef.afterClosed().subscribe(() => {
                  // Optional: Aktionen nach Schließen
                  this.blocked = false;
                });
              });
          }
        },
        error: (err) => {
          console.error('Failed to hash PIN', err);
          const dialogRef = this.displayMessage.open(DisplayMessage, {
            panelClass: '',
            closeOnNavigation: false,
            data: {
              showAlways: true,
              title: 'User Service',
              image: '',
              icon: 'bug_report',
              message: 'Uuups! Something went wrong while creating your user. Please try again later.',
              button: 'Ok',
              delay: 0,
              showSpinner: false
            },
            maxWidth: '90vw',
            maxHeight: '90vh',
            hasBackdrop: true,
            autoFocus: false
          });

          dialogRef.afterClosed().subscribe(() => {
            // Optional: Aktionen nach Schließen
            this.blocked = false;
          });
        }
      });
  }

  isReady(): boolean {
    return this.ready;
  }

  isBlocked(): boolean {
    return this.blocked;
  }

  getUser(): User {
    return this.user;
  }

  getProfile(): Profile {
    if (this.profile) {
      return this.profile;
    } else {
      this.profile = {
        name: '',
        base64Avatar: ''
      };
      return this.profile;
    }
  }

  async saveUser() {
    const cryptedUser: CryptedUser = {
      id: this.user.id,
      cryptedUser: await this.cryptoService.encrypt(JSON.parse(this.user.serverCryptoPublicKey), JSON.stringify(this.user))
    };
    await this.indexedDbService.setUser(cryptedUser);
  }

  async saveProfile() {
    if (this.profile) {
      await this.indexedDbService.setProfile(this.user.id, this.profile);
    }
  }

  private async loadProfile() {
    this.profile = await this.indexedDbService.getProfile(this.user.id)
  }

  createUser(showAlways = true): Observable<CreateUserResponse> {
    const url = `${environment.apiUrl}/user/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Creating user`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = {};
    return this.http.post<CreateUserResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  confirmUser(pinHash: string, cryptedUser: CryptedUser, showAlways = true): Observable<ConfirmUserResponse> {
    const url = `${environment.apiUrl}/user/confirm`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Confirming user`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = {
      pinHash: pinHash,
      cryptedUser: cryptedUser,
    };
    return this.http.post<ConfirmUserResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  private clearJwtRenewal(): void {
    if (this.tokenRenewalTimeout) {
      clearTimeout(this.tokenRenewalTimeout);
      this.tokenRenewalTimeout = null;
    }
  }

  private renewJwt(): void {
    const url = `${environment.apiUrl}/user/renewjwt/`;
    this.http.get<{ token: string }>(url, this.httpOptions).subscribe({
      next: (res) => {
        if (res.token) {
          this.user.jwt = res.token;
          const payload = jwtDecode<JwtPayload>(res.token);
          this.user.jwtExpiresAt = payload.exp! * 1000;
          this.startJwtRenewal();
        } else {
          this.logout();
          const dialogRef = this.displayMessage.open(DisplayMessage, {
            panelClass: '',
            closeOnNavigation: false,
            data: {
              showAlways: true,
              title: 'Session expired',
              image: '',
              icon: 'logout', // oder: 'schedule', 'lock', 'warning'
              message: 'Your session has expired for security reasons. Please log in again to continue.',
              button: 'Ok',
              delay: 0,
              showSpinner: false
            },
            maxWidth: '90vw',
            maxHeight: '90vh',
            hasBackdrop: true,
            autoFocus: false
          });

          dialogRef.afterClosed().subscribe(() => {
            this.blocked = false;
          });
        }
      },
      error: (err) => {
        console.error('Failed to load user details', err);
        this.logout();
        const dialogRef = this.displayMessage.open(DisplayMessage, {
          panelClass: '',
          closeOnNavigation: false,
          data: {
            showAlways: true,
            title: 'Session expired',
            image: '',
            icon: 'logout', // oder: 'schedule', 'lock', 'warning'
            message: 'Your session has expired for security reasons. Please log in again to continue.',
            button: 'Ok',
            delay: 0,
            showSpinner: false
          },
          maxWidth: '90vw',
          maxHeight: '90vh',
          hasBackdrop: true,
          autoFocus: false
        });

        dialogRef.afterClosed().subscribe(() => {
          this.blocked = false;
        });
      }
    });
  }

  private startJwtRenewal(): void {
    if (!this.user?.jwtExpiresAt) return;

    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 Minuten vorher
    const delay = this.user.jwtExpiresAt - now - bufferTime;

    if (delay <= 0) {
      this.logout();
      return;
    }

    this.tokenRenewalTimeout = setTimeout(() => {
      this.renewJwt();
    }, delay);
  }

  getUserById(userId: string, showAlways = false): Observable<GetUserResponse> {
    const url = `${environment.apiUrl}/user/get/${userId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Getting user information`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetUserResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getUserMessages(user: User, showAlways = false): Observable<GetMessageResponse> {
    const url = `${environment.apiUrl}/message/get/userId/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Getting user messages`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteUser(userId: string, showAlways = false): Observable<SimpleStatusResponse> {
    const url = `${environment.apiUrl}/user/delete/${userId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Deleting user`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  subscribe(user: User, subscription: string, showAlways = false) {
    const url = `${environment.apiUrl}/user/subscribe`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Subscribing to user`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = {
      'userId': user.id,
      'subscription': subscription,
    };
    return this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribe(user: User, showAlways = false) {
    const url = `${environment.apiUrl}/user/unsubscribe/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'User service',
      image: '',
      icon: '',
      message: `Unsubscribing from user`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  registerSubscription(user: User) {
    this.swPush.requestSubscription({
      serverPublicKey: environment.vapid_public_key
    })
      .then(subscription => {
        const subscriptionJson = JSON.stringify(subscription);
        // Save subscription to user.
        this.subscribe(user, subscriptionJson)
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) {
                this.indexedDbService.setSetting('subscription', subscriptionJson);
              }
            },
            error: (err) => {
              console.error('Failed to register subscription with backend', err);
              user.subscription = '';
              this.saveUser();
            }
          });
      })
      .catch(err => {
        console.error('Push subscription request failed', err);
        user.subscription = '';
        this.saveUser();
      });
  }

  getLanguageForLocation(location: string): string {
    let language = '';
    const switchLocation: string = location.split('-').length === 2 ? location.split('-')[1].toUpperCase() : location.split('-')[0].toUpperCase();
    switch (switchLocation) {
      case 'AR':
        language = 'AR';
        break;
      case 'BG':
        language = 'BG';
        break;
      case 'CS':
        language = 'CS';
        break;
      case 'DE':
        language = 'DE';
        break;
      case 'EL':
        language = 'EL';
        break;
      case 'GB':
        language = location.toUpperCase();
        break;
      case 'US':
        language = location.toUpperCase();
        break;
      case 'ES':
        language = 'ES';
        break;
      case 'ET':
        language = 'ET';
        break;
      case 'FI':
        language = 'FI';
        break;
      case 'FR':
        language = 'FR';
        break;
      case 'HU':
        language = 'HU';
        break;
      case 'ID':
        language = 'ID';
        break;
      case 'IT':
        language = 'IT';
        break;
      case 'JA':
        language = 'JA';
        break;
      case 'KO':
        language = 'KO';
        break;
      case 'LT':
        language = 'LT';
        break;
      case 'LV':
        language = 'LV';
        break;
      case 'NB':
        language = 'NB';
        break;
      case 'NL':
        language = 'NL';
        break;
      case 'PL':
        language = 'PL';
        break;
      case 'BR':
        language = 'PT-BR';
        break;
      case 'PT':
        language = 'PT-PT';
        break;
      case 'RO':
        language = 'RO';
        break;
      case 'RU':
        language = 'RU';
        break;
      case 'SK':
        language = 'SK';
        break;
      case 'SL':
        language = 'SL';
        break;
      case 'SV':
        language = 'SV';
        break;
      case 'TR':
        language = 'TR';
        break;
      case 'UK':
        language = 'UK';
        break;
      case 'ZH':
        language = 'ZH';
        break;
      case 'HANS':
        language = 'HANS';
        break;
      case 'HANT':
        language = 'HANT';
        break;
      default:
        language = "EN-US";
        break;
    }
    return language;
  }

  public async login(afterLogin?: () => void) {
    if (await this.indexedDbService.hasUser()) {
      this.openCheckPinDialog(afterLogin);
    } else {
      const dialogRef = this.displayMessage.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: 'Want to create a user? It’s that easy.',
          image: '',
          icon: 'person_add',
          message: `Just choose a PIN — no username and no password required.

Please keep this PIN safe. We do not store it, cannot reset it, and cannot recover it for you.

If the PIN is lost, access to this user is permanently lost as well.

You can delete your user at any time in the app.

If the user is not used for 90 days, it will be automatically and permanently deleted, including all associated data.`,
          button: 'Get started',
          delay: 200,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        autoFocus: false
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.openCreatePinDialog();
        }
      });
    }
  }

  public openCreatePinDialog(): void {
    const dialogRef = this.createPinDialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true
    });
    dialogRef.afterClosed().pipe(take(1)).subscribe(async (pin: string | undefined) => {
      if (!pin) {
        this.blocked = false;
        return;
      }
      const encrypted = await this.cryptoService.encrypt(
        this.serverService.getCryptoPublicKey()!,
        pin
      );

      this.getPinHash(encrypted).subscribe({
        next: (getPinHashResponse: GetPinHashResponse) => {
          this.blocked = true;
          this.getUser().pinHash = getPinHashResponse.pinHash;

          this.createUser().subscribe({
            next: (createUserResponse: CreateUserResponse) => {
              this.initUser(createUserResponse, getPinHashResponse.pinHash);
            },
            error: (err) => {
              console.error('User creation via createPinDialog failed', err);
              const dialogRef = this.displayMessage.open(DisplayMessage, {
                panelClass: '',
                closeOnNavigation: false,
                data: {
                  showAlways: true,
                  title: 'User Service',
                  image: '',
                  icon: 'bug_report',
                  message: 'Uuups! Something went wrong while creating your user. Please try again later.',
                  button: 'Ok',
                  delay: 0,
                  showSpinner: false
                },
                maxWidth: '90vw',
                maxHeight: '90vh',
                hasBackdrop: true,
                autoFocus: false
              });

              dialogRef.afterClosed().subscribe(() => {
                this.blocked = false;
              });
            }
          });
        },
        error: (err) => {
          console.error('getPinHash failed during create pin', err);
          this.blocked = false;
        }
      });
    });
  }

  public openCheckPinDialog(callback?: () => void): void {
    const dialogRef = this.checkPinDialog.open(CheckPinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true
    });
    dialogRef.afterClosed().subscribe(async (data: string | undefined) => {
      if (data === 'reset') {
        const cryptedUser: CryptedUser | undefined = await this.indexedDbService.getUser()
        if (cryptedUser) {
          this.deleteUser(cryptedUser.id)
            .subscribe({
              next: () => {
                this.indexedDbService.clearAllData();
                this.openCreatePinDialog();
              },
              error: (err) => {
                console.error('Failed to delete user during reset', err);
                this.indexedDbService.clearAllData();
                this.openCreatePinDialog();
              }
            });
        }
        return;
      }

      if (!data) {
        return;
      }

      this.getPinHash(await this.cryptoService.encrypt(this.serverService.getCryptoPublicKey()!, data))
        .subscribe(async (getPinHashResponse: GetPinHashResponse) => {
          this.getUser().pinHash = getPinHashResponse.pinHash;
          const cryptedUser = await this.indexedDbService.getUser();
          if (cryptedUser) {
            this.confirmUser(getPinHashResponse.pinHash, cryptedUser)
              .subscribe({
                next: (confirmUserResponse: ConfirmUserResponse) => {
                  this.setUser(confirmUserResponse.user, confirmUserResponse.jwt);
                  if (Notification.permission === "granted") {
                    if (this.getUser().subscription !== '') {
                      this.indexedDbService.setSetting('subscription', this.getUser().subscription);
                    } else {
                      this.indexedDbService.deleteSetting('subscription');
                      this.registerSubscription(this.getUser());
                    }
                  }
                  if (callback) {
                    callback();
                  }
                },
                error: (err) => {
                  console.error('Confirm user failed during login', err);
                  if (err.status === 401) {
                    this.snackBar.open("Pin is not correct. Please try again.", undefined, {
                      panelClass: ['snack-warning'],
                      horizontalPosition: 'center',
                      verticalPosition: 'top',
                      duration: 3000
                    });
                    this.blocked = false;
                  } else if (err.status === 404) {
                    const dialogRef = this.displayMessage.open(DisplayMessage, {
                      panelClass: '',
                      closeOnNavigation: false,
                      data: {
                        showAlways: true,
                        title: 'User not found',
                        image: '',
                        icon: 'person_remove',
                        message: `Looks like this user has been inactive for a while. 
                          
                          To keep things clean and simple, users are automatically deleted after 90 days of inactivity.
                          
                          You can create a new one anytime — no signup, no hassle.`,
                        button: 'Create new user',
                        delay: 200,
                        showSpinner: false
                      },
                      maxWidth: '90vw',
                      maxHeight: '90vh',
                      hasBackdrop: true,
                      autoFocus: false
                    });

                    dialogRef.afterClosed().subscribe((result) => {
                      this.blocked = false;
                      this.indexedDbService.clearAllData();
                      if (result) {
                        this.openCreatePinDialog();
                      }
                    });
                  } else {
                    const dialogRef = this.displayMessage.open(DisplayMessage, {
                      panelClass: '',
                      closeOnNavigation: false,
                      data: {
                        showAlways: true,
                        title: 'Oops! Backend error!',
                        image: '',
                        icon: 'bug_report',
                        message: 'Something went wrong. Please try again later.',
                        button: 'Retry...',
                        delay: 10000,
                        showSpinner: false
                      },
                      maxWidth: '90vw',
                      maxHeight: '90vh',
                      hasBackdrop: true,
                      autoFocus: false
                    });
                    dialogRef.afterClosed().subscribe(() => {
                      this.blocked = false;
                    });
                  }
                }
              });
          }
        });
    });
  }

}
