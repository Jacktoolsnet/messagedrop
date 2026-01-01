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
import { CreateUserResponse } from '../interfaces/create-user-response';
import { CryptedUser } from '../interfaces/crypted-user';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { Profile } from '../interfaces/profile';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { UserChallengeResponse } from '../interfaces/user-challenge-response';
import { UserLoginResponse } from '../interfaces/user-login-response';
import { User } from '../interfaces/user';
import { UserType } from '../interfaces/user-type';
import { BackupStateService } from './backup-state.service';
import { CryptoService } from './crypto.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private _userSet = signal(0);
  readonly userSet = this._userSet.asReadonly();

  private user: User = {
    id: '',
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
    type: UserType.USER
  };

  private profile: Profile | undefined = {
    name: '',
    base64Avatar: ''
  };

  private tokenRenewalTimeout: ReturnType<typeof setTimeout> | null = null;
  private pinKey: CryptoKey | null = null;
  private pinSalt: Uint8Array | null = null;
  private pinIterations = 250000;

  private ready = false;
  private blocked = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly backupState = inject(BackupStateService);
  private readonly i18n = inject(TranslationHelperService);

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  public logout() {
    this.clearJwtRenewal();
    this.user = {
      id: '',
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
      type: UserType.USER
    };
    this.ready = false;
    this.blocked = false;
    this.pinKey = null;
    this.pinSalt = null;
    this.backupState.clearDirty();
    this.initUserId();
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

  async initUser(createUserResponse: CreateUserResponse, pin: string) {
    this.user.id = createUserResponse.userId;
    this.user.cryptoKeyPair = await this.cryptoService.createEncryptionKey();
    this.user.signingKeyPair = await this.cryptoService.createSigningKey();
    this.registerUser(this.user.id, this.user.signingKeyPair.publicKey, this.user.cryptoKeyPair.publicKey)
      .subscribe({
        next: async () => {
          try {
            const encrypted = await this.cryptoService.encryptWithPin(pin, JSON.stringify(this.user), this.pinIterations);
            this.pinKey = encrypted.key;
            this.pinSalt = encrypted.salt;
            this.pinIterations = encrypted.iterations;
            const cryptedUser: CryptedUser = {
              id: this.user.id,
              cryptedUser: encrypted.envelope
            };
            await this.indexedDbService.setUser(cryptedUser);

            const dialogRef = this.displayMessage.open(DisplayMessage, {
              panelClass: '',
              closeOnNavigation: false,
              data: {
                showAlways: true,
                title: this.i18n.t('auth.serviceTitle'),
                image: '',
                icon: 'verified_user',
                message: this.i18n.t('auth.accountCreated'),
                button: this.i18n.t('common.actions.ok'),
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
          } catch (err) {
            console.error('User encryption failed', err);
            const dialogRef = this.displayMessage.open(DisplayMessage, {
              panelClass: '',
              closeOnNavigation: false,
              data: {
                showAlways: true,
                title: this.i18n.t('auth.serviceTitle'),
                image: '',
                icon: 'bug_report',
                message: this.i18n.t('auth.userCreationFailed'),
                button: this.i18n.t('common.actions.ok'),
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
          console.error('User register failed', err);
          const dialogRef = this.displayMessage.open(DisplayMessage, {
            panelClass: '',
            closeOnNavigation: false,
            data: {
              showAlways: true,
              title: this.i18n.t('auth.serviceTitle'),
              image: '',
              icon: 'bug_report',
              message: this.i18n.t('auth.userCreationFailed'),
              button: this.i18n.t('common.actions.ok'),
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
    if (!this.pinKey || !this.pinSalt) {
      return;
    }
    const cryptedUser: CryptedUser = {
      id: this.user.id,
      cryptedUser: await this.cryptoService.encryptWithKey(
        this.pinKey,
        JSON.stringify(this.user),
        this.pinSalt,
        this.pinIterations
      )
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
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.creatingUser'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const body = {};
    return this.http.post<CreateUserResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  registerUser(
    userId: string,
    signingPublicKey: JsonWebKey,
    cryptoPublicKey: JsonWebKey,
    showAlways = true
  ): Observable<SimpleStatusResponse> {
    const url = `${environment.apiUrl}/user/register`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.confirmingUser'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const body = {
      userId,
      signingPublicKey,
      cryptoPublicKey
    };
    return this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  requestLoginChallenge(userId: string, showAlways = false): Observable<UserChallengeResponse> {
    const url = `${environment.apiUrl}/user/challenge`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.confirmingUser'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const body = { userId };
    return this.http.post<UserChallengeResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  loginUser(userId: string, challenge: string, signature: string, showAlways = true): Observable<UserLoginResponse> {
    const url = `${environment.apiUrl}/user/login`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.confirmingUser'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const body = {
      userId,
      challenge,
      signature
    };
    return this.http.post<UserLoginResponse>(url, body, this.httpOptions)
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
              title: this.i18n.t('auth.sessionExpiredTitle'),
              image: '',
              icon: 'logout', // oder: 'schedule', 'lock', 'warning'
              message: this.i18n.t('auth.sessionExpiredMessage'),
              button: this.i18n.t('common.actions.ok'),
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
            title: this.i18n.t('auth.sessionExpiredTitle'),
            image: '',
            icon: 'logout', // oder: 'schedule', 'lock', 'warning'
            message: this.i18n.t('auth.sessionExpiredMessage'),
            button: this.i18n.t('common.actions.ok'),
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

  getUserMessages(user: User, showAlways = false): Observable<GetMessageResponse> {
    const url = `${environment.apiUrl}/message/get/userId/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.gettingUserMessages'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.deletingUser'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.subscribingUser'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.unsubscribingUser'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
          title: this.i18n.t('auth.createUserTitle'),
          image: '',
          icon: 'person_add',
          message: this.i18n.t('auth.createUserMessage'),
          button: this.i18n.t('auth.createUserAction'),
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
      this.blocked = true;
      this.createUser().subscribe({
        next: (createUserResponse: CreateUserResponse) => {
          this.initUser(createUserResponse, pin);
        },
        error: (err) => {
          console.error('User creation via createPinDialog failed', err);
          const dialogRef = this.displayMessage.open(DisplayMessage, {
            panelClass: '',
            closeOnNavigation: false,
            data: {
              showAlways: true,
              title: this.i18n.t('auth.serviceTitle'),
              image: '',
              icon: 'bug_report',
              message: this.i18n.t('auth.userCreationFailed'),
              button: this.i18n.t('common.actions.ok'),
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
      this.blocked = true;
      const cryptedUser = await this.indexedDbService.getUser();
      if (!cryptedUser) {
        this.blocked = false;
        return;
      }
      const decrypted = await this.cryptoService.decryptWithPin(data, cryptedUser.cryptedUser);
      if (!decrypted) {
        this.snackBar.open(this.i18n.t('auth.pinIncorrect'), undefined, {
          panelClass: ['snack-warning'],
          horizontalPosition: 'center',
          verticalPosition: 'top',
          duration: 3000
        });
        this.blocked = false;
        return;
      }

      const user = JSON.parse(decrypted.plaintext) as User;
      this.pinKey = decrypted.key;
      this.pinSalt = decrypted.salt;
      this.pinIterations = decrypted.iterations;

      this.requestLoginChallenge(user.id)
        .subscribe({
          next: async (challengeResponse: UserChallengeResponse) => {
            const signature = await this.cryptoService.createSignature(
              user.signingKeyPair.privateKey,
              challengeResponse.challenge
            );
            this.loginUser(user.id, challengeResponse.challenge, signature)
              .subscribe({
                next: (loginResponse: UserLoginResponse) => {
                  this.setUser(user, loginResponse.jwt);
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
                  console.error('Login user failed during login', err);
                  if (err.status === 401) {
                    this.snackBar.open(this.i18n.t('auth.pinIncorrect'), undefined, {
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
                        title: this.i18n.t('auth.userNotFoundTitle'),
                        image: '',
                        icon: 'person_remove',
                        message: this.i18n.t('auth.userNotFoundMessage'),
                        button: this.i18n.t('auth.userNotFoundAction'),
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
                        title: this.i18n.t('auth.backendErrorTitle'),
                        image: '',
                        icon: 'bug_report',
                        message: this.i18n.t('auth.backendErrorMessage'),
                        button: this.i18n.t('common.actions.retry'),
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
          },
          error: (err) => {
            console.error('Login challenge failed during login', err);
            if (err.status === 404) {
              const dialogRef = this.displayMessage.open(DisplayMessage, {
                panelClass: '',
                closeOnNavigation: false,
                data: {
                  showAlways: true,
                  title: this.i18n.t('auth.userNotFoundTitle'),
                  image: '',
                  icon: 'person_remove',
                  message: this.i18n.t('auth.userNotFoundMessage'),
                  button: this.i18n.t('auth.userNotFoundAction'),
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
                  title: this.i18n.t('auth.backendErrorTitle'),
                  image: '',
                  icon: 'bug_report',
                  message: this.i18n.t('auth.backendErrorMessage'),
                  button: this.i18n.t('common.actions.retry'),
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
    });
  }

}
