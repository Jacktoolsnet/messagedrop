import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, Injector, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SwPush } from '@angular/service-worker';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { catchError, firstValueFrom, Observable, take, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CheckPinComponent } from '../components/pin/check-pin/check-pin.component';
import { CreatePinComponent } from '../components/pin/create-pin/create-pin.component';
import { DeleteUserComponent } from '../components/user/delete-user/delete-user.component';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { UserServerBackup } from '../interfaces/backup';
import { Contact } from '../interfaces/contact';
import { CreateUserResponse } from '../interfaces/create-user-response';
import { CryptedUser } from '../interfaces/crypted-user';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { MultimediaType } from '../interfaces/multimedia-type';
import { Profile } from '../interfaces/profile';
import { RawContact } from '../interfaces/raw-contact';
import { ShortMessage } from '../interfaces/short-message';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { User } from '../interfaces/user';
import { UserChallengeResponse } from '../interfaces/user-challenge-response';
import { UserLoginResponse } from '../interfaces/user-login-response';
import { UserType } from '../interfaces/user-type';
import { AvatarStorageService } from './avatar-storage.service';
import { BackupStateService } from './backup-state.service';
import { ContactMessageService } from './contact-message.service';
import { ContactService } from './contact.service';
import { CryptoService } from './crypto.service';
import { DiagnosticLoggerService } from './diagnostic-logger.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { RestoreService } from './restore.service';
import { ServerService } from './server.service';
import { SocketioService } from './socketio.service';
import { TranslationHelperService } from './translation-helper.service';

interface VapidPublicKeyResponse {
  status?: number;
  publicKey?: string;
  message?: string;
}

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
  private readonly profileVersionSignal = signal(0);
  readonly profileVersion = this.profileVersionSignal.asReadonly();

  private tokenRenewalTimeout: ReturnType<typeof setTimeout> | null = null;
  private pinKey: CryptoKey | null = null;
  private pinSalt: Uint8Array<ArrayBuffer> | null = null;
  private pinIterations = 250000;
  private connectInProgress = false;

  private ready = false;
  private blocked = false;
  private lastPinCallback?: () => void;
  private lastPinOptions?: { requireJwt?: boolean; attemptBackend?: boolean };

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly cryptoService = inject(CryptoService);
  private readonly networkService = inject(NetworkService);
  private readonly displayMessage = inject(MatDialog);
  private readonly createPinDialog = this.displayMessage;
  private readonly checkPinDialog = this.displayMessage;
  private readonly injector = inject(Injector);
  private readonly serverService = inject(ServerService);
  private readonly backupState = inject(BackupStateService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly diagnosticLogger = inject(DiagnosticLoggerService);
  private vapidPublicKey?: string;
  private vapidKeyFetch?: Promise<string>;

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
    this.indexedDbService.setAtRestEncryptionKey(null);
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

  private setLocalUser(user: User) {
    this.user = user;
    this.user.jwt = undefined;
    this.user.jwtExpiresAt = undefined;
    this.user.locale = navigator.language;
    this.user.language = this.getLanguageForLocation(this.user.locale);
    this.loadProfile();
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
            this.indexedDbService.setAtRestEncryptionKey(this.pinKey);
            this.pinSalt = encrypted.salt;
            this.pinIterations = encrypted.iterations;
            const cryptedUser: CryptedUser = {
              id: this.user.id,
              cryptedUser: encrypted.envelope
            };
            await this.indexedDbService.setUser(cryptedUser);

            const challengeResponse = await firstValueFrom(this.requestLoginChallenge(this.user.id, true));
            const signature = await this.cryptoService.createSignature(
              this.user.signingKeyPair.privateKey,
              challengeResponse.challenge
            );
            const loginResponse = await firstValueFrom(
              this.loginUser(this.user.id, challengeResponse.challenge, signature, true)
            );
            this.setUser(this.user, loginResponse.jwt);
            void this.ensurePushSubscription(this.getUser());

            const dialogRef = this.displayMessage.open(DisplayMessage, {
              panelClass: '',
              closeOnNavigation: false,
              data: {
                showAlways: true,
                title: this.i18n.t('auth.serviceTitle'),
                image: '',
                icon: 'verified_user',
                message: this.i18n.t('auth.accountCreated'),
                button: '',
                delay: 2000,
                showSpinner: false,
                autoclose: true
              },
              maxWidth: '90vw',
              maxHeight: '90vh',
              hasBackdrop: true,
              backdropClass: 'dialog-backdrop',
              disableClose: false,
              autoFocus: false
            });

            dialogRef.afterClosed().subscribe(() => {
              this.blocked = false;
            });
          } catch (err) {
            console.error('User initialization failed', err);
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
              backdropClass: 'dialog-backdrop',
              disableClose: false,
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
            backdropClass: 'dialog-backdrop',
            disableClose: false,
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

  hasJwt(): boolean {
    if (!this.user?.jwt) {
      return false;
    }
    if (this.user.jwtExpiresAt && this.user.jwtExpiresAt <= Date.now()) {
      return false;
    }
    return true;
  }

  isBlocked(): boolean {
    return this.blocked;
  }

  isConnectingToBackend(): boolean {
    return this.connectInProgress;
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
      this.notifyProfileChanged();
      return this.profile;
    }
  }

  notifyProfileChanged(): void {
    this.profileVersionSignal.update((version) => version + 1);
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
    this.profile = await this.indexedDbService.getProfile(this.user.id);
    if (!this.profile) {
      this.profile = { name: '', base64Avatar: '' };
      this.notifyProfileChanged();
      return;
    }
    if (this.profile.avatarFileId && this.avatarStorage.isSupported()) {
      this.profile.base64Avatar = (await this.avatarStorage.getImageUrl(this.profile.avatarFileId)) || '';
    } else {
      this.profile.base64Avatar = '';
    }
    this.notifyProfileChanged();
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

  resetUserKeys(
    userId: string,
    signingPublicKey: JsonWebKey,
    cryptoPublicKey: JsonWebKey,
    showAlways = true
  ): Observable<SimpleStatusResponse> {
    const url = `${environment.apiUrl}/user/reset-keys`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('auth.serviceTitle'),
      image: '',
      icon: '',
      message: this.i18n.t('auth.resetKeysInProgress'),
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
            backdropClass: 'dialog-backdrop',
            disableClose: false,
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
          backdropClass: 'dialog-backdrop',
          disableClose: false,
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

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private async ensurePushSubscription(user: User): Promise<void> {
    if (!this.swPush.isEnabled) {
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      if (user.subscription) {
        user.subscription = '';
        void this.saveUser();
      }
      this.indexedDbService.deleteSetting('subscription');
      return;
    }

    let publicKey: string;
    try {
      publicKey = await this.getVapidPublicKey();
    } catch {
      return;
    }

    let currentSubscription: PushSubscription | null = null;
    try {
      currentSubscription = await firstValueFrom(this.swPush.subscription.pipe(take(1)));
    } catch {
      currentSubscription = null;
    }

    if (!currentSubscription) {
      if (permission === 'default' || permission === 'granted') {
        await this.registerSubscription(user);
      }
      return;
    }

    const serverKey = currentSubscription.options?.applicationServerKey
      ? this.arrayBufferToBase64Url(currentSubscription.options.applicationServerKey)
      : '';
    if (serverKey && serverKey !== publicKey) {
      try {
        await currentSubscription.unsubscribe();
      } catch (err) {
        console.error('Failed to unsubscribe outdated push subscription', err);
      }
      await this.registerSubscription(user);
      return;
    }

    const subscriptionJson = JSON.stringify(currentSubscription);
    user.subscription = subscriptionJson;
    void this.saveUser();
    this.indexedDbService.setSetting('subscription', subscriptionJson);
    this.subscribe(user, subscriptionJson).subscribe({
      error: (err) => {
        console.error('Failed to sync push subscription', err);
      }
    });
  }

  async registerSubscription(user: User): Promise<void> {
    if (!this.swPush.isEnabled || Notification.permission === 'denied') {
      return;
    }
    let publicKey: string;
    try {
      publicKey = await this.getVapidPublicKey();
    } catch (error) {
      console.error('Failed to load VAPID public key', error);
      this.diagnosticLogger.logHealthCheckError('vapid_key', error, {
        errorCode: 'vapid_key_fetch'
      });
      return;
    }

    this.swPush.requestSubscription({
      serverPublicKey: publicKey
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

  public async preloadVapidPublicKey(): Promise<void> {
    try {
      await this.getVapidPublicKey();
    } catch (error) {
      console.error('Failed to preload VAPID public key', error);
      this.diagnosticLogger.logHealthCheckError('vapid_key', error, {
        errorCode: 'vapid_key_preload'
      });
    }
  }

  private async getVapidPublicKey(): Promise<string> {
    if (this.vapidPublicKey) {
      return this.vapidPublicKey;
    }
    if (this.vapidKeyFetch) {
      return this.vapidKeyFetch;
    }

    this.vapidKeyFetch = (async () => {
      try {
        const response = await firstValueFrom(
          this.http.get<VapidPublicKeyResponse>(
            `${environment.apiUrl}/utils/vapid-public-key`,
            this.httpOptions
          ).pipe(catchError(this.handleError))
        );
        if (!response?.publicKey) {
          throw new Error('vapid_public_key_missing');
        }
        this.vapidPublicKey = response.publicKey;
        return response.publicKey;
      } catch (error) {
        this.vapidKeyFetch = undefined;
        throw error;
      }
    })();

    return this.vapidKeyFetch;
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

  public async login(afterLogin?: () => void, options?: { requireJwt?: boolean; attemptBackend?: boolean }) {
    if (await this.indexedDbService.hasUser()) {
      this.openCheckPinDialog(afterLogin, options);
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
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.openCreatePinDialog();
        }
      });
    }
  }

  public loginWithBackend(afterLogin?: () => void) {
    return this.login(afterLogin, { requireJwt: true });
  }

  private async ensureServerCryptoPublicKey(): Promise<JsonWebKey> {
    const existingKey = this.serverService.getCryptoPublicKey();
    if (existingKey) {
      return existingKey;
    }
    const response = await firstValueFrom(this.serverService.connect());
    if (response.status === 200 && response.cryptoPublicKey) {
      return response.cryptoPublicKey;
    }
    throw new Error('server_key_unavailable');
  }

  private async handleForgotPinFlow(): Promise<void> {
    const dialogRef = this.displayMessage.open(DeleteUserComponent, {
      data: {
        title: this.i18n.t('auth.pinForgotTitle'),
        message: this.i18n.t('auth.pinForgotMessage'),
        confirmLabel: this.i18n.t('auth.pinForgotRestore'),
        cancelLabel: this.i18n.t('auth.pinForgotNewUser')
      },
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result === true) {
      const restoreService = this.injector.get(RestoreService);
      await restoreService.startRestore();
      this.blocked = false;
      return;
    }
    if (result === false) {
      await this.indexedDbService.clearAllData();
      this.logout();
      this.openCreatePinDialog();
      return;
    }
    this.blocked = false;
  }

  private showPinIncorrectDialog(): void {
    const dialogRef = this.displayMessage.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.i18n.t('auth.serviceTitle'),
        image: '',
        icon: 'warning',
        message: this.i18n.t('auth.pinIncorrect'),
        button: this.i18n.t('auth.pinForgotAction'),
        secondaryButton: this.i18n.t('common.actions.retry'),
        delay: 0,
        showSpinner: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'secondary') {
        this.blocked = false;
        this.openCheckPinDialog(this.lastPinCallback, this.lastPinOptions);
        return;
      }
      if (result !== true) {
        this.blocked = false;
        return;
      }
      this.handleForgotPinFlow().catch((err) => {
        console.error('Forgot PIN flow failed', err);
        const errorDialog = this.displayMessage.open(DisplayMessage, {
          panelClass: '',
          closeOnNavigation: false,
          data: {
            showAlways: true,
            title: this.i18n.t('auth.backendErrorTitle'),
            image: '',
            icon: 'bug_report',
            message: this.i18n.t('auth.backendErrorMessage'),
            button: this.i18n.t('common.actions.ok'),
            delay: 0,
            showSpinner: false
          },
          maxWidth: '90vw',
          maxHeight: '90vh',
          hasBackdrop: true,
          backdropClass: 'dialog-backdrop',
          disableClose: false,
          autoFocus: false
        });
        errorDialog.afterClosed().subscribe(() => {
          this.blocked = false;
        });
      });
    });
  }

  private buildUserRow(
    userId: string,
    signingPublicKey: JsonWebKey | string,
    cryptoPublicKey: JsonWebKey | string,
    lastSignOfLife: number,
    subscription?: string,
    type?: UserType | null
  ) {
    return {
      id: userId,
      cryptoPublicKey: typeof cryptoPublicKey === 'string' ? cryptoPublicKey : JSON.stringify(cryptoPublicKey),
      signingPublicKey: typeof signingPublicKey === 'string' ? signingPublicKey : JSON.stringify(signingPublicKey),
      numberOfMessages: 0,
      numberOfBlockedMessages: 0,
      userStatus: 'enabled',
      lastSignOfLife,
      subscription: subscription ?? '',
      type: type ?? null
    };
  }

  private async buildServerRestoreBackup(user: User): Promise<UserServerBackup> {
    const [places, contacts, contactProfiles] = await Promise.all([
      this.indexedDbService.getAllPlaces(),
      this.indexedDbService.getAllContacts(),
      this.indexedDbService.getAllContactProfilesAsMap()
    ]);

    const cryptoPublicKey = await this.ensureServerCryptoPublicKey();
    const lastSignOfLife = Math.floor(Date.now() / 1000);

    const userRows = [this.buildUserRow(
      user.id,
      user.signingKeyPair.publicKey,
      user.cryptoKeyPair.publicKey,
      lastSignOfLife,
      user.subscription,
      user.type
    )];

    const contactUserIds = new Set<string>();
    contacts.forEach((contact) => {
      if (!contact.contactUserId || !contact.contactUserSigningPublicKey || !contact.contactUserEncryptionPublicKey) {
        return;
      }
      if (contactUserIds.has(contact.contactUserId)) {
        return;
      }
      contactUserIds.add(contact.contactUserId);
      userRows.push(this.buildUserRow(
        contact.contactUserId,
        contact.contactUserSigningPublicKey,
        contact.contactUserEncryptionPublicKey,
        lastSignOfLife
      ));
    });

    const placeRows = await Promise.all(places.map(async (place) => {
      const boundingBox = place.boundingBox;
      if (!boundingBox) {
        return null;
      }
      const encryptedName = await this.cryptoService.encrypt(cryptoPublicKey, place.name ?? '');
      return {
        id: place.id,
        userId: user.id,
        name: encryptedName,
        subscribed: place.subscribed ? 1 : 0,
        latMin: boundingBox.latMin,
        latMax: boundingBox.latMax,
        lonMin: boundingBox.lonMin,
        lonMax: boundingBox.lonMax
      };
    }));

    const contactRows = await Promise.all(contacts.map(async (contact) => {
      if (!contact.contactUserId || !contact.contactUserSigningPublicKey || !contact.contactUserEncryptionPublicKey) {
        return null;
      }
      const profile = contactProfiles.get(contact.id);
      const nameValue = profile?.name || contact.name || '';
      const encryptedName = nameValue ? await this.cryptoService.encrypt(cryptoPublicKey, nameValue) : null;
      return {
        id: contact.id,
        userId: user.id,
        contactUserId: contact.contactUserId,
        contactUserSigningPublicKey: JSON.stringify(contact.contactUserSigningPublicKey),
        contactUserEncryptionPublicKey: JSON.stringify(contact.contactUserEncryptionPublicKey),
        subscribed: contact.subscribed ? 1 : 0,
        hint: contact.hint ?? '',
        name: encryptedName,
        lastMessageFrom: contact.lastMessageFrom ?? '',
        lastMessageAt: contact.lastMessageAt ?? null
      };
    }));

    return {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      userId: user.id,
      tables: {
        tableUser: userRows,
        tableMessage: [],
        tableContact: contactRows.filter((row): row is NonNullable<typeof row> => Boolean(row)),
        tableContactMessage: [],
        tablePlace: placeRows.filter((row): row is NonNullable<typeof row> => Boolean(row)),
        tableNotification: [],
        tableLike: [],
        tableDislike: [],
        tableConnect: []
      }
    };
  }

  private async restoreServerFromIndexedDb(user: User, jwt: string): Promise<void> {
    const backup = await this.buildServerRestoreBackup(user);
    const url = `${environment.apiUrl}/user/restore`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: true,
      title: this.i18n.t('common.restore.title'),
      image: '',
      icon: 'cloud_download',
      message: this.i18n.t('common.restore.restoringServerData'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true',
      Authorization: `Bearer ${jwt}`
    });
    const response = await firstValueFrom(this.http.post<SimpleStatusResponse>(url, { backup }, { headers }));
    if (response.status !== 200) {
      throw new Error('restore_failed');
    }
  }

  private async recoverUserFromDevice(user: User, afterLogin?: () => void): Promise<void> {
    this.blocked = true;
    try {
      await firstValueFrom(this.registerUser(
        user.id,
        user.signingKeyPair.publicKey,
        user.cryptoKeyPair.publicKey,
        true
      ));
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (status !== 409) {
        throw err;
      }
    }

    const challengeResponse = await firstValueFrom(this.requestLoginChallenge(user.id, true));
    const signature = await this.cryptoService.createSignature(
      user.signingKeyPair.privateKey,
      challengeResponse.challenge
    );
    const loginResponse = await firstValueFrom(this.loginUser(user.id, challengeResponse.challenge, signature, true));
    await this.restoreServerFromIndexedDb(user, loginResponse.jwt);
    this.setUser(user, loginResponse.jwt);
    void this.ensurePushSubscription(this.getUser());
    if (afterLogin) {
      afterLogin();
    }
  }

  public async changePin(): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    const dialogRef = this.createPinDialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });
    const pin = await firstValueFrom(dialogRef.afterClosed());
    if (!pin) {
      return;
    }
    this.blocked = true;

    try {
      const encrypted = await this.cryptoService.encryptWithPin(pin, JSON.stringify(this.user), this.pinIterations);
      this.pinKey = encrypted.key;
      this.indexedDbService.setAtRestEncryptionKey(this.pinKey);
      this.pinSalt = encrypted.salt;
      this.pinIterations = encrypted.iterations;

      const cryptedUser: CryptedUser = {
        id: this.user.id,
        cryptedUser: encrypted.envelope
      };
      await this.indexedDbService.setUser(cryptedUser);

      const infoDialog = this.displayMessage.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: this.i18n.t('auth.serviceTitle'),
          image: '',
          icon: 'verified_user',
          message: this.i18n.t('auth.pinChangedMessage'),
          button: this.i18n.t('common.actions.ok'),
          delay: 0,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });

      infoDialog.afterClosed().subscribe(() => {
        this.logout();
      });
    } catch (err) {
      console.error('Change PIN failed', err);
      const errorDialog = this.displayMessage.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: this.i18n.t('auth.backendErrorTitle'),
          image: '',
          icon: 'bug_report',
          message: this.i18n.t('auth.backendErrorMessage'),
          button: this.i18n.t('common.actions.ok'),
          delay: 0,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });
      errorDialog.afterClosed().subscribe(() => {
        this.blocked = false;
      });
    }
  }

  public async resetKeys(): Promise<void> {
    if (!this.hasJwt()) {
      return;
    }

    const dialogRef = this.displayMessage.open(DeleteUserComponent, {
      data: {
        title: this.i18n.t('auth.resetKeysTitle'),
        message: this.i18n.t('auth.resetKeysMessage'),
        confirmLabel: this.i18n.t('auth.resetKeysAction')
      },
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    this.blocked = true;

    try {
      const newCryptoKeys = await this.cryptoService.createEncryptionKey();
      const newSigningKeys = await this.cryptoService.createSigningKey();

      await firstValueFrom(this.resetUserKeys(
        this.user.id,
        newSigningKeys.publicKey,
        newCryptoKeys.publicKey,
        true
      ));

      this.user.cryptoKeyPair = newCryptoKeys;
      this.user.signingKeyPair = newSigningKeys;
      await this.saveUser();
      await this.sendKeyResetSystemMessages();
      this.injector.get(ContactService).emitContactResetAll();

      const infoDialog = this.displayMessage.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: this.i18n.t('auth.resetKeysTitle'),
          image: '',
          icon: 'verified_user',
          message: this.i18n.t('auth.resetKeysSuccess'),
          button: this.i18n.t('common.actions.ok'),
          delay: 0,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });

      infoDialog.afterClosed().subscribe(() => {
        this.blocked = false;
      });
    } catch (err) {
      console.error('Reset keys failed', err);
      const errorDialog = this.displayMessage.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: this.i18n.t('auth.backendErrorTitle'),
          image: '',
          icon: 'bug_report',
          message: this.i18n.t('auth.resetKeysFailed'),
          button: this.i18n.t('common.actions.ok'),
          delay: 0,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });
      errorDialog.afterClosed().subscribe(() => {
        this.blocked = false;
      });
    }
  }

  private buildKeyResetSystemMessage(): ShortMessage {
    return {
      message: this.i18n.t('common.contact.chatroom.keyResetNotice'),
      style: 'font-style: italic; color: var(--mat-card-subtitle-text-color);',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        attribution: '',
        title: '',
        description: '',
        url: '',
        sourceUrl: '',
        contentId: ''
      }
    };
  }

  private async sendKeyResetSystemMessages(): Promise<void> {
    const contactService = this.injector.get(ContactService);
    const contactMessageService = this.injector.get(ContactMessageService);
    const socketioService = this.injector.get(SocketioService);
    let contacts = contactService.sortedContactsSignal();
    if (!Array.isArray(contacts) || contacts.length === 0) {
      contacts = await this.fetchContactsForSystemMessages(contactService);
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return;
    }

    const payload = this.buildKeyResetSystemMessage();
    await Promise.all(contacts.map(async (contact) => {
      if (!contact?.id || !contact.userId || !contact.contactUserId || !contact.contactUserEncryptionPublicKey) {
        return;
      }
      try {
        const { encryptedMessageForUser, encryptedMessageForContact, signature } =
          await contactMessageService.encryptMessageForContact(contact, payload);
        const res = await firstValueFrom(contactMessageService.send({
          contactId: contact.id,
          userId: contact.userId,
          contactUserId: contact.contactUserId,
          direction: 'user',
          encryptedMessageForUser,
          encryptedMessageForContact,
          signature
        }));
        socketioService.sendContactMessage({
          id: res.mirrorMessageId ?? res.messageId,
          messageId: res.sharedMessageId,
          contactId: contact.id,
          userId: contact.userId,
          contactUserId: contact.contactUserId,
          messageSignature: signature,
          userEncryptedMessage: encryptedMessageForUser,
          contactUserEncryptedMessage: encryptedMessageForContact
        });
      } catch (err) {
        console.error('Failed to send key reset notice', err);
      }
    }));
  }

  private async fetchContactsForSystemMessages(contactService: ContactService): Promise<Contact[]> {
    if (!this.user?.id) {
      return [];
    }
    try {
      const response = await firstValueFrom(contactService.getByUserId(this.user.id));
      const rows = response?.rows ?? [];
      return rows.map((raw) => this.mapRawContactForSystemMessage(raw));
    } catch {
      return [];
    }
  }

  private mapRawContactForSystemMessage(raw: RawContact): Contact {
    let signingKey: JsonWebKey | undefined;
    let cryptoKey: JsonWebKey | undefined;
    try {
      signingKey = raw.contactUserSigningPublicKey ? JSON.parse(raw.contactUserSigningPublicKey) : undefined;
    } catch {
      signingKey = undefined;
    }
    try {
      cryptoKey = raw.contactUserEncryptionPublicKey ? JSON.parse(raw.contactUserEncryptionPublicKey) : undefined;
    } catch {
      cryptoKey = undefined;
    }

    return {
      id: raw.id,
      userId: raw.userId,
      contactUserId: raw.contactUserId,
      contactUserSigningPublicKey: signingKey,
      contactUserEncryptionPublicKey: cryptoKey,
      hint: raw.hint ?? '',
      name: raw.name ?? '',
      base64Avatar: raw.base64Avatar ?? '',
      subscribed: raw.subscribed ?? false,
      pinned: false,
      provided: raw.provided ?? false,
      lastMessageFrom: raw.lastMessageFrom ?? '',
      lastMessageAt: raw.lastMessageAt ?? null
    };
  }

  public openCreatePinDialog(): void {
    const dialogRef = this.createPinDialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
            backdropClass: 'dialog-backdrop',
            disableClose: false,
            autoFocus: false
          });

          dialogRef.afterClosed().subscribe(() => {
            this.blocked = false;
          });
        }
      });
    });
  }

  public openCheckPinDialog(callback?: () => void, options?: { requireJwt?: boolean; attemptBackend?: boolean }): void {
    this.lastPinCallback = callback;
    this.lastPinOptions = options;
    const dialogRef = this.checkPinDialog.open(CheckPinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });
    dialogRef.afterClosed().subscribe(async (data: string | undefined) => {
      const requireJwt = options?.requireJwt ?? false;
      const attemptBackend = options?.attemptBackend ?? true;
      let callbackCalled = false;
      const runCallback = () => {
        if (callback && !callbackCalled) {
          callbackCalled = true;
          callback();
        }
      };
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
        this.showPinIncorrectDialog();
        return;
      }

      const user = JSON.parse(decrypted.plaintext) as User;
      this.pinKey = decrypted.key;
      this.indexedDbService.setAtRestEncryptionKey(this.pinKey);
      this.pinSalt = decrypted.salt;
      this.pinIterations = decrypted.iterations;
      this.setLocalUser(user);
      if (!requireJwt) {
        runCallback();
        if (attemptBackend && !this.hasJwt()) {
          void this.attemptBackendLogin(user, { showAlways: false, showError: false, blockUi: false });
        }
        return;
      }

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
                  void this.ensurePushSubscription(this.getUser());
                  if (requireJwt) {
                    runCallback();
                  }
                },
                error: (err) => {
                  console.error('Login user failed during login', err);
                  if (err.status === 401) {
                    this.showPinIncorrectDialog();
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
                      backdropClass: 'dialog-backdrop',
                      disableClose: false,
                      autoFocus: false
                    });

                    dialogRef.afterClosed().subscribe(() => {
                      this.recoverUserFromDevice(user, callback)
                        .catch((recoverErr) => {
                          console.error('User recovery failed', recoverErr);
                          const errorDialog = this.displayMessage.open(DisplayMessage, {
                            panelClass: '',
                            closeOnNavigation: false,
                            data: {
                              showAlways: true,
                              title: this.i18n.t('auth.backendErrorTitle'),
                              image: '',
                              icon: 'bug_report',
                              message: this.i18n.t('common.restore.failed'),
                              button: this.i18n.t('common.actions.retry'),
                              delay: 0,
                              showSpinner: false
                            },
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            hasBackdrop: true,
                            backdropClass: 'dialog-backdrop',
                            disableClose: false,
                            autoFocus: false
                          });
                          errorDialog.afterClosed().subscribe(() => {
                            this.blocked = false;
                          });
                        });
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
                      backdropClass: 'dialog-backdrop',
                      disableClose: false,
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
                backdropClass: 'dialog-backdrop',
                disableClose: false,
                autoFocus: false
              });

              dialogRef.afterClosed().subscribe(() => {
                this.recoverUserFromDevice(user, callback)
                  .catch((recoverErr) => {
                    console.error('User recovery failed', recoverErr);
                    const errorDialog = this.displayMessage.open(DisplayMessage, {
                      panelClass: '',
                      closeOnNavigation: false,
                      data: {
                        showAlways: true,
                        title: this.i18n.t('auth.backendErrorTitle'),
                        image: '',
                        icon: 'bug_report',
                        message: this.i18n.t('common.restore.failed'),
                        button: this.i18n.t('common.actions.retry'),
                        delay: 0,
                        showSpinner: false
                      },
                      maxWidth: '90vw',
                      maxHeight: '90vh',
                      hasBackdrop: true,
                      backdropClass: 'dialog-backdrop',
                      disableClose: false,
                      autoFocus: false
                    });
                    errorDialog.afterClosed().subscribe(() => {
                      this.blocked = false;
                    });
                  });
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
                backdropClass: 'dialog-backdrop',
                disableClose: false,
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

  private async attemptBackendLogin(
    user: User,
    options?: { showAlways?: boolean; showError?: boolean; blockUi?: boolean; afterLogin?: () => void }
  ): Promise<boolean> {
    if (!user?.id || !user.signingKeyPair?.privateKey) {
      return false;
    }
    if (this.hasJwt()) {
      return true;
    }
    if (this.connectInProgress) {
      return false;
    }
    this.connectInProgress = true;
    if (options?.blockUi) {
      this.blocked = true;
    }

    try {
      const showAlways = options?.showAlways ?? false;
      const challengeResponse = await firstValueFrom(this.requestLoginChallenge(user.id, showAlways));
      const signature = await this.cryptoService.createSignature(
        user.signingKeyPair.privateKey,
        challengeResponse.challenge
      );
      const loginResponse = await firstValueFrom(this.loginUser(user.id, challengeResponse.challenge, signature, showAlways));
      this.setUser(user, loginResponse.jwt);
      void this.ensurePushSubscription(this.getUser());
      if (options?.afterLogin) {
        options.afterLogin();
      }
      return true;
    } catch (err) {
      console.error('Backend login failed', err);
      if (options?.showError ?? true) {
        const dialogRef = this.displayMessage.open(DisplayMessage, {
          panelClass: '',
          closeOnNavigation: false,
          data: {
            showAlways: true,
            title: this.i18n.t('auth.backendErrorTitle'),
            image: '',
            icon: 'bug_report',
            message: this.i18n.t('auth.backendErrorMessage'),
            button: this.i18n.t('common.actions.ok'),
            delay: 0,
            showSpinner: false
          },
          maxWidth: '90vw',
          maxHeight: '90vh',
          hasBackdrop: true,
          backdropClass: 'dialog-backdrop',
          disableClose: false,
          autoFocus: false
        });
        dialogRef.afterClosed().subscribe(() => {
          if (options?.blockUi) {
            this.blocked = false;
          }
        });
      }
      return false;
    } finally {
      this.connectInProgress = false;
      if (options?.blockUi && !this.hasJwt()) {
        this.blocked = false;
      }
    }
  }

  public async connectToBackend(afterLogin?: () => void): Promise<void> {
    if (!this.isReady() || this.hasJwt()) {
      return;
    }
    const user = this.getUser();
    await this.attemptBackendLogin(user, {
      showAlways: true,
      showError: true,
      blockUi: true,
      afterLogin
    });
  }

}
