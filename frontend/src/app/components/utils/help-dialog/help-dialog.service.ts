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

const ITEMS = {
  listBasic: [
    {
      icon: 'touch_app',
      titleKey: 'common.items.selection.title',
      descriptionKey: 'common.items.selection.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  sortDialog: [
    {
      icon: 'sort',
      titleKey: 'common.items.sort.title',
      descriptionKey: 'common.items.sort.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  editorBasic: [
    {
      icon: 'edit',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  settings: [
    {
      icon: 'tune',
      titleKey: 'common.items.options.title',
      descriptionKey: 'common.items.options.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  info: [
    {
      icon: 'info',
      titleKey: 'common.items.content.title',
      descriptionKey: 'common.items.content.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  chat: [
    {
      icon: 'chat',
      titleKey: 'common.items.chat.title',
      descriptionKey: 'common.items.chat.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  picker: [
    {
      icon: 'touch_app',
      titleKey: 'common.items.selection.title',
      descriptionKey: 'common.items.selection.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  qr: [
    {
      icon: 'qr_code',
      titleKey: 'common.items.qr.title',
      descriptionKey: 'common.items.qr.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
  ],
  scan: [
    {
      icon: 'qr_code_scanner',
      titleKey: 'common.items.scan.title',
      descriptionKey: 'common.items.scan.desc'
    },
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    {
      icon: 'check_circle',
      titleKey: 'common.items.actions.title',
      descriptionKey: 'common.items.actions.desc'
    }
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
    introKey: 'common.intros.editor',
    items: ITEMS.editorMedia
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
} as const satisfies Record<string, HelpDialogData>;

export type HelpTopic = keyof typeof HELP_TOPICS;

@Injectable({ providedIn: 'root' })
export class HelpDialogService {
  private readonly dialog = inject(MatDialog);

  open(topic: HelpTopic): void {
    const data = HELP_TOPICS[topic];
    this.dialog.open(HelpDialogComponent, {
      data,
      ...DEFAULT_HELP_DIALOG_CONFIG
    });
  }
}
