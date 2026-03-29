import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Message } from '../../interfaces/message';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { AppService } from '../../services/app.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { DsaStatusService } from '../../services/dsa-status.service';
import { LanguageService } from '../../services/language.service';
import { MapService } from '../../services/map.service';
import { MessageService } from '../../services/message.service';
import { ProfileService } from '../../services/profile.service';
import { SharedContentService } from '../../services/shared-content.service';
import { SpeechService } from '../../services/speech.service';
import { TranslateService } from '../../services/translate.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { MyMessagelistComponent } from './my-messagelist.component';

class MessageServiceStub {
  readonly messagesSignal = signal<Message[]>([]);
  readonly selectedMessagesSignal = signal<Message[]>([]);
  readonly commentCountsSignal = signal<Record<string, number>>({});
  readonly commentsSignals = new Map<string, WritableSignal<Message[]>>();

  readonly saveOwnPublicMessages = jasmine.createSpy('saveOwnPublicMessages').and.resolveTo();
  readonly syncOwnPublicMessages = jasmine.createSpy('syncOwnPublicMessages').and.resolveTo([]);
  readonly loadOwnPublicMessages = jasmine.createSpy('loadOwnPublicMessages').and.resolveTo([]);

  setMessages(messages: Message[]): void {
    this.messagesSignal.set(messages);
    const nextCounts: Record<string, number> = {};
    for (const message of messages) {
      nextCounts[message.uuid] = message.commentsNumber;
    }
    this.commentCountsSignal.set(nextCounts);
  }

  clearSelectedMessages(): void {
    this.selectedMessagesSignal.set([]);
  }

  getCommentsSignalForMessage(parentUuid: string): WritableSignal<Message[]> {
    if (!this.commentsSignals.has(parentUuid)) {
      this.commentsSignals.set(parentUuid, signal<Message[]>([]));
    }
    return this.commentsSignals.get(parentUuid)!;
  }

  isRejectedByAutomatedModeration(): boolean {
    return false;
  }

  isDsaLocked(): boolean {
    return false;
  }
}

describe('MyMessagelistComponent', () => {
  let fixture: ComponentFixture<MyMessagelistComponent>;
  let component: MyMessagelistComponent;
  let messageService: MessageServiceStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyMessagelistComponent],
      providers: [
        { provide: MessageService, useClass: MessageServiceStub },
        {
          provide: UserService,
          useValue: {
            getUser: () => ({ id: 'user-1' }),
            getProfile: () => ({ name: 'Tester', base64Avatar: '', defaultStyle: '' }),
            hasJwt: () => true,
            isReady: () => true
          }
        },
        {
          provide: MatDialogRef,
          useValue: {
            updateSize: jasmine.createSpy('updateSize'),
            close: jasmine.createSpy('close')
          }
        },
        {
          provide: MatDialog,
          useValue: {
            open: jasmine.createSpy('open').and.returnValue({
              afterClosed: () => of(undefined),
              afterOpened: () => of(undefined)
            })
          }
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            location: { latitude: 0, longitude: 0, plusCode: '' }
          }
        },
        {
          provide: ProfileService,
          useValue: {
            loadAllProfiles: jasmine.createSpy('loadAllProfiles').and.resolveTo(),
            getProfile: jasmine.createSpy('getProfile').and.returnValue(undefined)
          }
        },
        { provide: AppService, useValue: { getAppSettings: () => ({ speech: { enabled: true, preferTranslatedText: true } }) } },
        { provide: TranslateService, useValue: { translate: () => of({ status: 200, result: { text: 'translated' } }) } },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        { provide: MapService, useValue: { moveToWithZoom: jasmine.createSpy('moveToWithZoom') } },
        { provide: SharedContentService, useValue: { addSharedContentToMessage: jasmine.createSpy('addSharedContentToMessage').and.resolveTo() } },
        { provide: SpeechService, useValue: { supported: () => true, isActive: () => false, toggle: jasmine.createSpy('toggle') } },
        { provide: DisplayMessageService, useValue: { open: jasmine.createSpy('open') } },
        { provide: DsaStatusService, useValue: { getStatus: () => of({}) } },
        { provide: LanguageService, useValue: { effectiveLanguage: () => 'de' } },
        { provide: HelpDialogService, useValue: {} }
      ]
    })
      .overrideComponent(MyMessagelistComponent, {
        set: {
          template: '<div></div>'
        }
      })
      .compileComponents();

    messageService = TestBed.inject(MessageService) as unknown as MessageServiceStub;
    fixture = TestBed.createComponent(MyMessagelistComponent);
    component = fixture.componentInstance;
  });

  it('should create for a logged-in user with an empty own-message list', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(messageService.syncOwnPublicMessages).toHaveBeenCalled();
    expect(messageService.saveOwnPublicMessages.calls.count()).toBeLessThan(5);
  });

  it('should keep existing local messages when an empty service snapshot arrives without explicit empty sync', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const existingMessage: Message = {
      id: 1,
      uuid: 'message-1',
      parentId: 0,
      parentUuid: '',
      typ: 'public',
      createDateTime: Date.now(),
      deleteDateTime: null,
      location: { latitude: 0, longitude: 0, plusCode: '' },
      message: 'Hallo',
      markerType: 'default',
      style: '',
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: [],
      commentsNumber: 0,
      status: 'enabled',
      publishState: 'published',
      userId: 'user-1',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };

    component.messagesSignal.set([existingMessage]);
    messageService.setMessages([]);
    await fixture.whenStable();

    expect(component.messagesSignal()).toEqual([existingMessage]);
  });
});
