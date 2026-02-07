import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent, HelpDialogData, HelpItem } from './help-dialog.component';

const DEFAULT_HELP_DIALOG_CONFIG = {
  minWidth: 'min(520px, 95vw)',
  maxWidth: '95vw',
  width: 'min(680px, 95vw)',
  maxHeight: '90vh',
  height: 'auto',
  hasBackdrop: true,
  backdropClass: 'dialog-backdrop',
  disableClose: false,
  autoFocus: false
} as const;

const STANDARD_ACTIONS: HelpItem[] = [
  {
    icon: 'close',
    titleKey: 'common.items.cancel.title',
    descriptionKey: 'common.items.cancel.desc'
  },
  {
    icon: 'check',
    titleKey: 'common.items.apply.title',
    descriptionKey: 'common.items.apply.desc'
  },
  {
    icon: 'help',
    titleKey: 'common.items.help.title',
    descriptionKey: 'common.items.help.desc'
  }
];

export interface HelpOpenContext {
  hasJwt?: boolean;
}

type HelpTopicDefinition = HelpDialogData | ((context: HelpOpenContext) => HelpDialogData);

const ITEMS = {
  listBasic: [
    {
      icon: 'touch_app',
      titleKey: 'common.items.selection.title',
      descriptionKey: 'common.items.selection.desc'
    },
    ...STANDARD_ACTIONS
  ],
  listSort: [
    {
      icon: 'touch_app',
      titleKey: 'common.items.selection.title',
      descriptionKey: 'common.items.selection.desc'
    },
    {
      icon: 'sort',
      titleKey: 'common.items.sort.title',
      descriptionKey: 'common.items.sort.desc'
    },
    ...STANDARD_ACTIONS
  ],
  sortDialog: [
    {
      icon: 'sort',
      titleKey: 'common.items.sort.title',
      descriptionKey: 'common.items.sort.desc'
    },
    ...STANDARD_ACTIONS
  ],
  searchList: [
    {
      icon: 'search',
      titleKey: 'common.items.search.title',
      descriptionKey: 'common.items.search.desc'
    },
    {
      icon: 'touch_app',
      titleKey: 'common.items.selection.title',
      descriptionKey: 'common.items.selection.desc'
    },
    ...STANDARD_ACTIONS
  ],
  searchMap: [
    {
      icon: 'search',
      titleKey: 'common.items.search.title',
      descriptionKey: 'common.items.search.desc'
    },
    {
      icon: 'map',
      titleKey: 'common.items.map.title',
      descriptionKey: 'common.items.map.desc'
    },
    {
      icon: 'touch_app',
      titleKey: 'common.items.selection.title',
      descriptionKey: 'common.items.selection.desc'
    },
    ...STANDARD_ACTIONS
  ],
  editorBasic: [
    {
      icon: 'edit',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    ...STANDARD_ACTIONS
  ],
  editorMedia: [
    {
      icon: 'edit',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    {
      icon: 'photo',
      titleKey: 'common.items.media.title',
      descriptionKey: 'common.items.media.desc'
    },
    ...STANDARD_ACTIONS
  ],
  settings: [
    {
      icon: 'tune',
      titleKey: 'common.items.options.title',
      descriptionKey: 'common.items.options.desc'
    },
    ...STANDARD_ACTIONS
  ],
  info: [
    {
      icon: 'info',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    ...STANDARD_ACTIONS
  ],
  legal: [
    {
      icon: 'info',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    {
      icon: 'open_in_new',
      titleKey: 'common.items.links.title',
      descriptionKey: 'common.items.links.desc'
    },
    ...STANDARD_ACTIONS
  ],
  chat: [
    {
      icon: 'chat',
      titleKey: 'common.items.chat.title',
      descriptionKey: 'common.items.chat.desc'
    },
    ...STANDARD_ACTIONS
  ],
  picker: [
    {
      icon: 'touch_app',
      titleKey: 'common.items.selection.title',
      descriptionKey: 'common.items.selection.desc'
    },
    ...STANDARD_ACTIONS
  ],
  qr: [
    {
      icon: 'qr_code',
      titleKey: 'common.items.qr.title',
      descriptionKey: 'common.items.qr.desc'
    },
    ...STANDARD_ACTIONS
  ],
  scan: [
    {
      icon: 'qr_code_scanner',
      titleKey: 'common.items.scan.title',
      descriptionKey: 'common.items.scan.desc'
    },
    ...STANDARD_ACTIONS
  ],
  tiles: [
    {
      icon: 'edit',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    {
      icon: 'style',
      titleKey: 'common.items.style.title',
      descriptionKey: 'common.items.style.desc'
    },
    ...STANDARD_ACTIONS
  ],
  exif: [
    {
      icon: 'edit',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    {
      icon: 'tune',
      titleKey: 'common.items.options.title',
      descriptionKey: 'common.items.options.desc'
    },
    ...STANDARD_ACTIONS
  ]
} as const satisfies Record<string, HelpItem[]>;

const HELP_TOPICS = {
  airQuality: {
    titleKey: 'airQuality.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  },
  weather: {
    titleKey: 'weather.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  },
  appSettings: {
    titleKey: 'appSettings.title',
    introKey: 'common.intros.settings',
    items: ITEMS.settings
  },
  profile: {
    titleKey: 'profile.title',
    introKey: 'profile.intro',
    items: [
      {
        icon: 'photo_camera',
        titleKey: 'profile.items.avatar.title',
        descriptionKey: 'profile.items.avatar.desc'
      },
      {
        icon: 'delete',
        titleKey: 'profile.items.avatarDelete.title',
        descriptionKey: 'profile.items.avatarDelete.desc'
      },
      {
        icon: 'cycle',
        titleKey: 'profile.items.style.title',
        descriptionKey: 'profile.items.style.desc'
      },
      {
        icon: 'close',
        titleKey: 'profile.items.close.title',
        descriptionKey: 'profile.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'profile.items.help.title',
        descriptionKey: 'profile.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'profile.items.apply.title',
        descriptionKey: 'profile.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'profile.items.privacy.title',
        descriptionKey: 'profile.items.privacy.desc'
      }
    ]
  },
  user: (context: HelpOpenContext): HelpDialogData => {
    const items: HelpItem[] = [
      {
        icon: 'download',
        titleKey: 'user.items.backup.title',
        descriptionKey: 'user.items.backup.desc'
      },
      {
        icon: 'lock_reset',
        titleKey: 'user.items.changePin.title',
        descriptionKey: 'user.items.changePin.desc'
      }
    ];

    if (context.hasJwt) {
      items.push({
        icon: 'security',
        titleKey: 'user.items.resetKeys.title',
        descriptionKey: 'user.items.resetKeys.desc'
      });
    }

    items.push(
      {
        icon: 'delete',
        titleKey: 'user.items.delete.title',
        descriptionKey: 'user.items.delete.desc'
      },
      {
        icon: 'close',
        titleKey: 'user.items.close.title',
        descriptionKey: 'user.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'user.items.help.title',
        descriptionKey: 'user.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'user.items.privacy.title',
        descriptionKey: 'user.items.privacy.desc'
      }
    );

    return {
      titleKey: 'user.title',
      introKey: 'user.intro',
      items
    };
  },
  contactChatroom: {
    titleKey: 'contactChatroom.title',
    introKey: 'common.intros.chat',
    items: ITEMS.chat
  },
  contactConnect: {
    titleKey: 'contactConnect.title',
    introKey: 'common.intros.connect',
    items: ITEMS.qr
  },
  contactEditMessage: {
    titleKey: 'contactEditMessage.title',
    introKey: 'common.intros.editor',
    items: ITEMS.editorBasic
  },
  contactSettings: {
    titleKey: 'contactSettings.title',
    introKey: 'common.intros.settings',
    items: ITEMS.settings
  },
  contactList: {
    titleKey: 'contactList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listSort
  },
  contactSort: {
    titleKey: 'contactSort.title',
    introKey: 'common.intros.sort',
    items: ITEMS.sortDialog
  },
  documentList: {
    titleKey: 'documentList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  editMessage: {
    titleKey: 'editMessage.title',
    introKey: 'common.intros.editor',
    items: ITEMS.editorMedia
  },
  editNote: {
    titleKey: 'editNote.title',
    introKey: 'common.intros.editor',
    items: ITEMS.editorBasic
  },
  imageList: {
    titleKey: 'imageList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  imageExif: {
    titleKey: 'imageExif.title',
    introKey: 'common.intros.editor',
    items: ITEMS.exif
  },
  dsaReport: {
    titleKey: 'dsaReport.title',
    introKey: 'common.intros.report',
    items: ITEMS.editorBasic
  },
  dsaCase: {
    titleKey: 'dsaCase.title',
    introKey: 'common.intros.info',
    items: ITEMS.legal
  },
  dsaStatusLink: {
    titleKey: 'dsaStatusLink.title',
    introKey: 'common.intros.info',
    items: ITEMS.legal
  },
  legalDisclaimer: {
    titleKey: 'legalDisclaimer.title',
    introKey: 'common.intros.legal',
    items: ITEMS.legal
  },
  legalExternalContent: {
    titleKey: 'legalExternalContent.title',
    introKey: 'common.intros.legal',
    items: ITEMS.legal
  },
  legalNotice: {
    titleKey: 'legalNotice.title',
    introKey: 'common.intros.legal',
    items: ITEMS.legal
  },
  privacyPolicy: {
    titleKey: 'privacyPolicy.title',
    introKey: 'common.intros.legal',
    items: ITEMS.legal
  },
  termsOfService: {
    titleKey: 'termsOfService.title',
    introKey: 'common.intros.legal',
    items: ITEMS.legal
  },
  thirdPartyLicenses: {
    titleKey: 'thirdPartyLicenses.title',
    introKey: 'common.intros.legal',
    items: ITEMS.legal
  },
  messageList: {
    titleKey: 'messageList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  myMessageList: {
    titleKey: 'myMessageList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  messageProfile: {
    titleKey: 'messageProfile.title',
    introKey: 'common.intros.editor',
    items: ITEMS.editorMedia
  },
  noteList: {
    titleKey: 'noteList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  pinHint: {
    titleKey: 'pinHint.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  },
  placeList: {
    titleKey: 'placeList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listSort
  },
  placeSettings: {
    titleKey: 'placeSettings.title',
    introKey: 'common.intros.settings',
    items: ITEMS.settings
  },
  placeSort: {
    titleKey: 'placeSort.title',
    introKey: 'common.intros.sort',
    items: ITEMS.sortDialog
  },
  sharedContent: {
    titleKey: 'sharedContent.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  },
  tileList: {
    titleKey: 'tileList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  tileSettings: {
    titleKey: 'tileSettings.title',
    introKey: 'common.intros.settings',
    items: ITEMS.settings
  },
  tileEditAnniversary: {
    titleKey: 'tileEditAnniversary.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditFile: {
    titleKey: 'tileEditFile.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditMigraine: {
    titleKey: 'tileEditMigraine.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditMultitext: {
    titleKey: 'tileEditMultitext.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditPollution: {
    titleKey: 'tileEditPollution.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditQuickActionAction: {
    titleKey: 'tileEditQuickActionAction.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditQuickAction: {
    titleKey: 'tileEditQuickAction.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditText: {
    titleKey: 'tileEditText.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  tileEditTodo: {
    titleKey: 'tileEditTodo.title',
    introKey: 'common.intros.tileEdit',
    items: ITEMS.tiles
  },
  avatarCropper: {
    titleKey: 'avatarCropper.title',
    introKey: 'avatarCropper.intro',
    items: [
      {
        icon: 'crop_square',
        titleKey: 'avatarCropper.items.crop.title',
        descriptionKey: 'avatarCropper.items.crop.desc'
      },
      {
        icon: 'close',
        titleKey: 'avatarCropper.items.abort.title',
        descriptionKey: 'avatarCropper.items.abort.desc'
      },
      {
        icon: 'help',
        titleKey: 'avatarCropper.items.help.title',
        descriptionKey: 'avatarCropper.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'avatarCropper.items.apply.title',
        descriptionKey: 'avatarCropper.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'avatarCropper.items.privacy.title',
        descriptionKey: 'avatarCropper.items.privacy.desc'
      }
    ]
  },
  avatarSource: {
    titleKey: 'avatarSource.title',
    introKey: 'common.intros.picker',
    items: ITEMS.picker
  },
  emoticonPicker: {
    titleKey: 'emoticonPicker.title',
    introKey: 'common.intros.picker',
    items: ITEMS.picker
  },
  locationPicker: {
    titleKey: 'locationPicker.title',
    introKey: 'common.intros.searchMap',
    items: ITEMS.searchMap
  },
  maticonPicker: {
    titleKey: 'maticonPicker.title',
    introKey: 'common.intros.picker',
    items: ITEMS.picker
  },
  nominatimResult: {
    titleKey: 'nominatimResult.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  },
  nominatimSearch: {
    titleKey: 'nominatimSearch.title',
    introKey: 'common.intros.searchMap',
    items: ITEMS.searchMap
  },
  qrCode: {
    titleKey: 'qrCode.title',
    introKey: 'common.intros.qr',
    items: ITEMS.qr
  },
  scanner: {
    titleKey: 'scanner.title',
    introKey: 'common.intros.scan',
    items: ITEMS.scan
  },
  searchSettings: {
    titleKey: 'searchSettings.title',
    introKey: 'common.intros.settings',
    items: ITEMS.settings
  },
  experienceSearch: {
    titleKey: 'experienceSearch.title',
    introKey: 'common.intros.searchMap',
    items: ITEMS.searchMap
  },
  importMultimedia: {
    titleKey: 'importMultimedia.title',
    introKey: 'common.intros.editor',
    items: ITEMS.editorMedia
  },
  tenorSearch: {
    titleKey: 'tenorSearch.title',
    introKey: 'common.intros.search',
    items: ITEMS.searchList
  },
  textDialog: {
    titleKey: 'textDialog.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  }
} as const satisfies Record<string, HelpTopicDefinition>;

export type HelpTopic = keyof typeof HELP_TOPICS;

@Injectable({ providedIn: 'root' })
export class HelpDialogService {
  private readonly dialog = inject(MatDialog);

  open(topic: HelpTopic, context: HelpOpenContext = {}): void {
    const topicConfig = HELP_TOPICS[topic];
    const data = typeof topicConfig === 'function' ? topicConfig(context) : topicConfig;
    this.dialog.open(HelpDialogComponent, {
      data,
      ...DEFAULT_HELP_DIALOG_CONFIG
    });
  }
}
