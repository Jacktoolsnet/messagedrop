import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
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
  private _userSet = signal(false);
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

  private tokenRenewalTimeout: any = null;

  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private http: HttpClient,
    private swPush: SwPush,
    private indexedDbService: IndexedDbService,
    private cryptoService: CryptoService,
    private networkService: NetworkService,
    private displayMessage: MatDialog,
    private createPinDialog: MatDialog,
    private checkPinDialog: MatDialog,
    private serverService: ServerService,
    private snackBar: MatSnackBar
  ) { }

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
  }

  getPinHash(pin: string, showAlways: boolean = false): Observable<GetPinHashResponse> {
    let url = `${environment.apiUrl}/user/hashpin`;
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
    let body = { pin: pin };
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
    this._userSet.set(true);
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

                dialogRef.afterOpened().subscribe(() => {
                  // Optional: Aktionen nach Öffnen
                });

                dialogRef.afterClosed().subscribe(() => {
                  // Optional: Aktionen nach Schließen
                });
              });
          }
        },
        error: (err) => {
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

          dialogRef.afterOpened().subscribe(() => {
            // Optional: Aktionen nach Öffnen
          });

          dialogRef.afterClosed().subscribe(() => {
            // Optional: Aktionen nach Schließen
          });
        }
      });
  }

  isReady(): boolean {
    return this.ready;
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
    this.indexedDbService.setUser(cryptedUser).then(() => { });
  }

  async saveProfile() {
    if (this.profile) {
      this.indexedDbService.setProfile(this.user.id, this.profile).then(() => { });
    }
  }

  private async loadProfile() {
    this.profile = await this.indexedDbService.getProfile(this.user.id)
  }

  createUser(showAlways: boolean = true): Observable<CreateUserResponse> {
    let url = `${environment.apiUrl}/user/create`;
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
    let body = {};
    return this.http.post<CreateUserResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  confirmUser(pinHash: string, cryptedUser: CryptedUser, showAlways: boolean = true): Observable<ConfirmUserResponse> {
    let url = `${environment.apiUrl}/user/confirm`;
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
    let body = {
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
    let url = `${environment.apiUrl}/user/renewjwt/`;
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

          dialogRef.afterOpened().subscribe(() => {
            // Optional: Aktionen nach Öffnen
          });

          dialogRef.afterClosed().subscribe(() => {
            // Optional: Aktionen nach Schließen
          });
        }
      },
      error: (err) => {
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

        dialogRef.afterOpened().subscribe(() => {
          // Optional: Aktionen nach Öffnen
        });

        dialogRef.afterClosed().subscribe(() => {
          // Optional: Aktionen nach Schließen
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

  getUserById(userId: string, showAlways: boolean = false): Observable<GetUserResponse> {
    let url = `${environment.apiUrl}/user/get/${userId}`;
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

  getUserMessages(user: User, showAlways: boolean = false): Observable<GetMessageResponse> {
    let url = `${environment.apiUrl}/message/get/userId/${user.id}`;
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

  deleteUser(userId: string, showAlways: boolean = false): Observable<SimpleStatusResponse> {
    let url = `${environment.apiUrl}/user/delete/${userId}`;
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

  subscribe(user: User, subscription: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/user/subscribe`;
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
    let body = {
      'userId': user.id,
      'subscription': subscription,
    };
    return this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribe(user: User, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/user/unsubscribe/${user.id}`;
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
        let subscriptionJson = JSON.stringify(subscription);
        // Save subscription to user.
        this.subscribe(user, subscriptionJson)
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) {
                this.indexedDbService.setSetting('subscription', subscriptionJson);
              }
            },
            error: (err) => {
              user.subscription = '';
              this.saveUser();
            },
            complete: () => { }
          });
      })
      .catch(err => {
        user.subscription = '';
        this.saveUser();
      });
  }

  getLanguageForLocation(location: string): string {
    let language: string = '';
    let switchLocation: string = location.split('-').length === 2 ? location.split('-')[1].toUpperCase() : location.split('-')[0].toUpperCase();
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
          title: 'Want to create a user? Easy peasy.',
          image: '',
          icon: 'person_add',
          message: `Just pick a PIN – no username, no password, no DNA sample.

But hey, *don’t forget that PIN!*

We don’t store it, we don’t back it up, and we definitely can’t send you a “forgot PIN?” email.  
Basically: lose it, and your user is gone like your last cup of coffee.

You can delete your user anytime (rage quit or just Marie Kondo your data).

Also, if you ghost us for 90 days, your user and all its data get quietly deleted.`,
          button: 'Create PIN',
          delay: 200,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        autoFocus: false
      });

      dialogRef.afterOpened().subscribe(e => { });

      dialogRef.afterClosed().subscribe(() => {
        this.openCreatePinDialog();
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

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().pipe(take(1)).subscribe(async (data: any) => {

      const encrypted = await this.cryptoService.encrypt(
        this.serverService.getCryptoPublicKey()!,
        data
      );

      this.getPinHash(encrypted).subscribe({
        next: (getPinHashResponse: GetPinHashResponse) => {
          this.getUser().pinHash = getPinHashResponse.pinHash;

          this.createUser().subscribe({
            next: (createUserResponse: CreateUserResponse) => {
              this.initUser(createUserResponse, getPinHashResponse.pinHash);
            },
            error: (err) => {
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

              dialogRef.afterOpened().subscribe(() => {
                // Optional: Aktionen nach Öffnen
              });

              dialogRef.afterClosed().subscribe(() => {
                // Optional: Aktionen nach Schließen
              });
            },
            complete: () => { }
          });
        },
        error: (err) => { },
        complete: () => { }
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

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe(async (data: any) => {
      if (data === 'reset') {
        let cryptedUser: CryptedUser | undefined = await this.indexedDbService.getUser()
        if (cryptedUser) {
          this.deleteUser(cryptedUser.id)
            .subscribe({
              next: () => {
                this.indexedDbService.clearAllData();
                this.openCreatePinDialog();
              },
              error: (err) => {
                this.indexedDbService.clearAllData();
                this.openCreatePinDialog();
              },
              complete: () => { }
            });
        }
      } else {
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
                    if (err.status === 401) {
                      this.snackBar.open("Pin is not correct. Please try again.", undefined, {
                        panelClass: ['snack-warning'],
                        horizontalPosition: 'center',
                        verticalPosition: 'top',
                        duration: 3000
                      });
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

                      dialogRef.afterOpened().subscribe(e => { });

                      dialogRef.afterClosed().subscribe(() => {
                        this.deleteUser(cryptedUser.id)
                          .subscribe({
                            next: () => {
                              this.indexedDbService.clearAllData();
                            },
                            error: (err) => {
                              this.indexedDbService.clearAllData();
                            },
                            complete: () => { }
                          });
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

                      dialogRef.afterOpened().subscribe(e => { });

                      dialogRef.afterClosed().subscribe(() => { });
                    }
                  }
                });
            }
          });
      }
    });
  }

}
