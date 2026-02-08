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
    introKey: 'airQuality.intro',
    items: [
      {
        icon: 'calendar_today',
        titleKey: 'airQuality.items.day.title',
        descriptionKey: 'airQuality.items.day.desc'
      },
      {
        icon: 'tune',
        titleKey: 'airQuality.items.category.title',
        descriptionKey: 'airQuality.items.category.desc'
      },
      {
        icon: 'schedule',
        titleKey: 'airQuality.items.hour.title',
        descriptionKey: 'airQuality.items.hour.desc'
      },
      {
        icon: 'dashboard',
        titleKey: 'airQuality.items.tiles.title',
        descriptionKey: 'airQuality.items.tiles.desc'
      },
      {
        icon: 'show_chart',
        titleKey: 'airQuality.items.detail.title',
        descriptionKey: 'airQuality.items.detail.desc'
      },
      {
        icon: 'swap_horiz',
        titleKey: 'airQuality.items.navigation.title',
        descriptionKey: 'airQuality.items.navigation.desc'
      },
      {
        icon: 'public',
        titleKey: 'airQuality.items.source.title',
        descriptionKey: 'airQuality.items.source.desc'
      },
      {
        icon: 'close',
        titleKey: 'airQuality.items.close.title',
        descriptionKey: 'airQuality.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'airQuality.items.help.title',
        descriptionKey: 'airQuality.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'airQuality.items.privacy.title',
        descriptionKey: 'airQuality.items.privacy.desc'
      }
    ]
  },
  weather: {
    titleKey: 'weather.title',
    introKey: 'weather.intro',
    items: [
      {
        icon: 'calendar_today',
        titleKey: 'weather.items.day.title',
        descriptionKey: 'weather.items.day.desc'
      },
      {
        icon: 'schedule',
        titleKey: 'weather.items.hour.title',
        descriptionKey: 'weather.items.hour.desc'
      },
      {
        icon: 'dashboard',
        titleKey: 'weather.items.tiles.title',
        descriptionKey: 'weather.items.tiles.desc'
      },
      {
        icon: 'show_chart',
        titleKey: 'weather.items.detail.title',
        descriptionKey: 'weather.items.detail.desc'
      },
      {
        icon: 'swap_horiz',
        titleKey: 'weather.items.navigation.title',
        descriptionKey: 'weather.items.navigation.desc'
      },
      {
        icon: 'public',
        titleKey: 'weather.items.source.title',
        descriptionKey: 'weather.items.source.desc'
      },
      {
        icon: 'close',
        titleKey: 'weather.items.close.title',
        descriptionKey: 'weather.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'weather.items.help.title',
        descriptionKey: 'weather.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'weather.items.privacy.title',
        descriptionKey: 'weather.items.privacy.desc'
      }
    ]
  },
  appMenu: {
    titleKey: 'appMenu.title',
    introKey: 'appMenu.intro',
    items: [
      {
        icon: 'apps',
        titleKey: 'appMenu.items.overview.title',
        descriptionKey: 'appMenu.items.overview.desc'
      },
      {
        icon: 'lock',
        titleKey: 'appMenu.items.restricted.title',
        descriptionKey: 'appMenu.items.restricted.desc'
      },
      {
        icon: 'person',
        titleKey: 'appMenu.items.userMenu.title',
        descriptionKey: 'appMenu.items.userMenu.desc'
      },
      {
        icon: 'lock',
        titleKey: 'appMenu.items.logout.title',
        descriptionKey: 'appMenu.items.logout.desc'
      },
      {
        icon: 'cloud_sync',
        titleKey: 'appMenu.items.connectBackend.title',
        descriptionKey: 'appMenu.items.connectBackend.desc'
      },
      {
        icon: 'account_circle',
        titleKey: 'appMenu.items.myUser.title',
        descriptionKey: 'appMenu.items.myUser.desc'
      },
      {
        icon: 'badge',
        titleKey: 'appMenu.items.myProfile.title',
        descriptionKey: 'appMenu.items.myProfile.desc'
      },
      {
        icon: 'notifications',
        titleKey: 'appMenu.items.systemMessages.title',
        descriptionKey: 'appMenu.items.systemMessages.desc'
      },
      {
        icon: 'speaker_notes',
        titleKey: 'appMenu.items.myPublicMessages.title',
        descriptionKey: 'appMenu.items.myPublicMessages.desc'
      },
      {
        icon: 'clinical_notes',
        titleKey: 'appMenu.items.myPrivateNotes.title',
        descriptionKey: 'appMenu.items.myPrivateNotes.desc'
      },
      {
        icon: 'personal_places',
        titleKey: 'appMenu.items.myPlaces.title',
        descriptionKey: 'appMenu.items.myPlaces.desc'
      },
      {
        icon: 'bookmark_star',
        titleKey: 'appMenu.items.myExperiences.title',
        descriptionKey: 'appMenu.items.myExperiences.desc'
      },
      {
        icon: 'contacts',
        titleKey: 'appMenu.items.myContacts.title',
        descriptionKey: 'appMenu.items.myContacts.desc'
      },
      {
        icon: 'apps',
        titleKey: 'appMenu.items.appMenu.title',
        descriptionKey: 'appMenu.items.appMenu.desc'
      },
      {
        icon: 'settings_applications',
        titleKey: 'appMenu.items.appSettings.title',
        descriptionKey: 'appMenu.items.appSettings.desc'
      },
      {
        icon: 'manage_search',
        titleKey: 'appMenu.items.searchSettings.title',
        descriptionKey: 'appMenu.items.searchSettings.desc'
      },
      {
        icon: 'public',
        titleKey: 'appMenu.items.externalContent.title',
        descriptionKey: 'appMenu.items.externalContent.desc'
      },
      {
        icon: 'restore',
        titleKey: 'appMenu.items.restore.title',
        descriptionKey: 'appMenu.items.restore.desc'
      },
      {
        icon: 'rule',
        titleKey: 'appMenu.items.terms.title',
        descriptionKey: 'appMenu.items.terms.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'appMenu.items.privacyPolicy.title',
        descriptionKey: 'appMenu.items.privacyPolicy.desc'
      },
      {
        icon: 'policy',
        titleKey: 'appMenu.items.disclaimer.title',
        descriptionKey: 'appMenu.items.disclaimer.desc'
      },
      {
        icon: 'gavel',
        titleKey: 'appMenu.items.legalNotice.title',
        descriptionKey: 'appMenu.items.legalNotice.desc'
      },
      {
        icon: 'receipt_long',
        titleKey: 'appMenu.items.licenses.title',
        descriptionKey: 'appMenu.items.licenses.desc'
      },
      {
        icon: 'help',
        titleKey: 'appMenu.items.menuHelp.title',
        descriptionKey: 'appMenu.items.menuHelp.desc'
      },
      {
        icon: 'pin_drop',
        titleKey: 'appMenu.items.mainMenu.title',
        descriptionKey: 'appMenu.items.mainMenu.desc'
      },
      {
        icon: 'my_location',
        titleKey: 'appMenu.items.locateMe.title',
        descriptionKey: 'appMenu.items.locateMe.desc'
      },
      {
        icon: 'send',
        titleKey: 'appMenu.items.publicMessage.title',
        descriptionKey: 'appMenu.items.publicMessage.desc'
      },
      {
        icon: 'add_notes',
        titleKey: 'appMenu.items.privateNote.title',
        descriptionKey: 'appMenu.items.privateNote.desc'
      },
      {
        icon: 'image_search',
        titleKey: 'appMenu.items.privateImage.title',
        descriptionKey: 'appMenu.items.privateImage.desc'
      },
      {
        icon: 'description',
        titleKey: 'appMenu.items.privateDocument.title',
        descriptionKey: 'appMenu.items.privateDocument.desc'
      },
      {
        icon: 'weather_mix',
        titleKey: 'appMenu.items.weather.title',
        descriptionKey: 'appMenu.items.weather.desc'
      },
      {
        icon: 'eco',
        titleKey: 'appMenu.items.airQuality.title',
        descriptionKey: 'appMenu.items.airQuality.desc'
      },
      {
        icon: 'search',
        titleKey: 'appMenu.items.searchMenu.title',
        descriptionKey: 'appMenu.items.searchMenu.desc'
      },
      {
        icon: 'travel_explore',
        titleKey: 'appMenu.items.searchPlace.title',
        descriptionKey: 'appMenu.items.searchPlace.desc'
      },
      {
        icon: 'local_activity',
        titleKey: 'appMenu.items.searchExperiences.title',
        descriptionKey: 'appMenu.items.searchExperiences.desc'
      },
      {
        icon: 'zoom_in_map',
        titleKey: 'appMenu.items.zoom.title',
        descriptionKey: 'appMenu.items.zoom.desc'
      },
      {
        icon: 'pin_drop',
        titleKey: 'appMenu.items.pins.title',
        descriptionKey: 'appMenu.items.pins.desc'
      },
      {
        icon: 'verified_user',
        titleKey: 'appMenu.items.privacy.title',
        descriptionKey: 'appMenu.items.privacy.desc'
      }
    ]
  },
  appSettings: {
    titleKey: 'appSettings.title',
    introKey: 'appSettings.intro',
    items: [
      {
        icon: 'palette',
        titleKey: 'appSettings.items.theme.title',
        descriptionKey: 'appSettings.items.theme.desc'
      },
      {
        icon: 'light_mode',
        titleKey: 'appSettings.items.themeMode.title',
        descriptionKey: 'appSettings.items.themeMode.desc'
      },
      {
        icon: 'translate',
        titleKey: 'appSettings.items.language.title',
        descriptionKey: 'appSettings.items.language.desc'
      },
      {
        icon: 'my_location',
        titleKey: 'appSettings.items.location.title',
        descriptionKey: 'appSettings.items.location.desc'
      },
      {
        icon: 'inventory_2',
        titleKey: 'appSettings.items.storage.title',
        descriptionKey: 'appSettings.items.storage.desc'
      },
      {
        icon: 'timer',
        titleKey: 'appSettings.items.usageProtection.title',
        descriptionKey: 'appSettings.items.usageProtection.desc'
      },
      {
        icon: 'bug_report',
        titleKey: 'appSettings.items.logging.title',
        descriptionKey: 'appSettings.items.logging.desc'
      },
      {
        icon: 'save',
        titleKey: 'appSettings.items.backup.title',
        descriptionKey: 'appSettings.items.backup.desc'
      },
      {
        icon: 'info',
        titleKey: 'appSettings.items.version.title',
        descriptionKey: 'appSettings.items.version.desc'
      },
      {
        icon: 'close',
        titleKey: 'appSettings.items.close.title',
        descriptionKey: 'appSettings.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'appSettings.items.help.title',
        descriptionKey: 'appSettings.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'appSettings.items.apply.title',
        descriptionKey: 'appSettings.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'appSettings.items.privacy.title',
        descriptionKey: 'appSettings.items.privacy.desc'
      }
    ]
  },
  usageProtectionLock: {
    titleKey: 'usageProtectionLock.title',
    introKey: 'usageProtectionLock.intro',
    items: [
      {
        icon: 'timer_off',
        titleKey: 'usageProtectionLock.items.dailyLimit.title',
        descriptionKey: 'usageProtectionLock.items.dailyLimit.desc'
      },
      {
        icon: 'schedule',
        titleKey: 'usageProtectionLock.items.schedule.title',
        descriptionKey: 'usageProtectionLock.items.schedule.desc'
      },
      {
        icon: 'bolt',
        titleKey: 'usageProtectionLock.items.selfExtension.title',
        descriptionKey: 'usageProtectionLock.items.selfExtension.desc'
      },
      {
        icon: 'pin',
        titleKey: 'usageProtectionLock.items.parentPin.title',
        descriptionKey: 'usageProtectionLock.items.parentPin.desc'
      },
      {
        icon: 'settings_applications',
        titleKey: 'usageProtectionLock.items.settings.title',
        descriptionKey: 'usageProtectionLock.items.settings.desc'
      },
      {
        icon: 'help',
        titleKey: 'usageProtectionLock.items.help.title',
        descriptionKey: 'usageProtectionLock.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'usageProtectionLock.items.privacy.title',
        descriptionKey: 'usageProtectionLock.items.privacy.desc'
      }
    ]
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
  systemMessages: {
    titleKey: 'systemMessages.title',
    introKey: 'systemMessages.intro',
    items: [
      {
        icon: 'mark_email_unread',
        titleKey: 'systemMessages.items.filterUnread.title',
        descriptionKey: 'systemMessages.items.filterUnread.desc'
      },
      {
        icon: 'drafts',
        titleKey: 'systemMessages.items.filterRead.title',
        descriptionKey: 'systemMessages.items.filterRead.desc'
      },
      {
        icon: 'all_inbox',
        titleKey: 'systemMessages.items.filterAll.title',
        descriptionKey: 'systemMessages.items.filterAll.desc'
      },
      {
        icon: 'notifications',
        titleKey: 'systemMessages.items.openDetails.title',
        descriptionKey: 'systemMessages.items.openDetails.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'systemMessages.items.openCaseLink.title',
        descriptionKey: 'systemMessages.items.openCaseLink.desc'
      },
      {
        icon: 'mark_email_read',
        titleKey: 'systemMessages.items.toggleRead.title',
        descriptionKey: 'systemMessages.items.toggleRead.desc'
      },
      {
        icon: 'delete',
        titleKey: 'systemMessages.items.deleteOne.title',
        descriptionKey: 'systemMessages.items.deleteOne.desc'
      },
      {
        icon: 'delete_sweep',
        titleKey: 'systemMessages.items.deleteAll.title',
        descriptionKey: 'systemMessages.items.deleteAll.desc'
      },
      {
        icon: 'close',
        titleKey: 'systemMessages.items.close.title',
        descriptionKey: 'systemMessages.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'systemMessages.items.help.title',
        descriptionKey: 'systemMessages.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'systemMessages.items.privacy.title',
        descriptionKey: 'systemMessages.items.privacy.desc'
      }
    ]
  },
  contactChatroom: {
    titleKey: 'contactChatroom.title',
    introKey: 'common.intros.chat',
    items: ITEMS.chat
  },
  myContactChatroom: {
    titleKey: 'myContactChatroom.title',
    introKey: 'myContactChatroom.intro',
    items: [
      {
        icon: 'person',
        titleKey: 'myContactChatroom.items.profile.title',
        descriptionKey: 'myContactChatroom.items.profile.desc'
      },
      {
        icon: 'add_comment',
        titleKey: 'myContactChatroom.items.compose.title',
        descriptionKey: 'myContactChatroom.items.compose.desc'
      },
      {
        icon: 'bookmark_add',
        titleKey: 'myContactChatroom.items.experience.title',
        descriptionKey: 'myContactChatroom.items.experience.desc'
      },
      {
        icon: 'add_location_alt',
        titleKey: 'myContactChatroom.items.location.title',
        descriptionKey: 'myContactChatroom.items.location.desc'
      },
      {
        icon: 'mic',
        titleKey: 'myContactChatroom.items.audio.title',
        descriptionKey: 'myContactChatroom.items.audio.desc'
      },
      {
        icon: 'mood',
        titleKey: 'myContactChatroom.items.reaction.title',
        descriptionKey: 'myContactChatroom.items.reaction.desc'
      },
      {
        icon: 'translate',
        titleKey: 'myContactChatroom.items.translate.title',
        descriptionKey: 'myContactChatroom.items.translate.desc'
      },
      {
        icon: 'map',
        titleKey: 'myContactChatroom.items.map.title',
        descriptionKey: 'myContactChatroom.items.map.desc'
      },
      {
        icon: 'edit',
        titleKey: 'myContactChatroom.items.edit.title',
        descriptionKey: 'myContactChatroom.items.edit.desc'
      },
      {
        icon: 'delete',
        titleKey: 'myContactChatroom.items.delete.title',
        descriptionKey: 'myContactChatroom.items.delete.desc'
      },
      {
        icon: 'close',
        titleKey: 'myContactChatroom.items.close.title',
        descriptionKey: 'myContactChatroom.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myContactChatroom.items.help.title',
        descriptionKey: 'myContactChatroom.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myContactChatroom.items.privacy.title',
        descriptionKey: 'myContactChatroom.items.privacy.desc'
      }
    ]
  },
  contactConnect: {
    titleKey: 'contactConnect.title',
    introKey: 'common.intros.connect',
    items: ITEMS.qr
  },
  myContactConnectId: {
    titleKey: 'myContactConnectId.title',
    introKey: 'myContactConnectId.intro',
    items: [
      {
        icon: 'link',
        titleKey: 'myContactConnectId.items.id.title',
        descriptionKey: 'myContactConnectId.items.id.desc'
      },
      {
        icon: 'content_paste_go',
        titleKey: 'myContactConnectId.items.paste.title',
        descriptionKey: 'myContactConnectId.items.paste.desc'
      },
      {
        icon: 'close',
        titleKey: 'myContactConnectId.items.close.title',
        descriptionKey: 'myContactConnectId.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myContactConnectId.items.help.title',
        descriptionKey: 'myContactConnectId.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'myContactConnectId.items.apply.title',
        descriptionKey: 'myContactConnectId.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myContactConnectId.items.privacy.title',
        descriptionKey: 'myContactConnectId.items.privacy.desc'
      }
    ]
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
  myContactSettings: {
    titleKey: 'myContactSettings.title',
    introKey: 'myContactSettings.intro',
    items: [
      {
        icon: 'edit',
        titleKey: 'myContactSettings.items.name.title',
        descriptionKey: 'myContactSettings.items.name.desc'
      },
      {
        icon: 'photo_camera',
        titleKey: 'myContactSettings.items.avatar.title',
        descriptionKey: 'myContactSettings.items.avatar.desc'
      },
      {
        icon: 'delete',
        titleKey: 'myContactSettings.items.avatarRemove.title',
        descriptionKey: 'myContactSettings.items.avatarRemove.desc'
      },
      {
        icon: 'wallpaper',
        titleKey: 'myContactSettings.items.background.title',
        descriptionKey: 'myContactSettings.items.background.desc'
      },
      {
        icon: 'delete',
        titleKey: 'myContactSettings.items.backgroundRemove.title',
        descriptionKey: 'myContactSettings.items.backgroundRemove.desc'
      },
      {
        icon: 'opacity',
        titleKey: 'myContactSettings.items.transparency.title',
        descriptionKey: 'myContactSettings.items.transparency.desc'
      },
      {
        icon: 'connect_without_contact',
        titleKey: 'myContactSettings.items.syncProfile.title',
        descriptionKey: 'myContactSettings.items.syncProfile.desc'
      },
      {
        icon: 'close',
        titleKey: 'myContactSettings.items.close.title',
        descriptionKey: 'myContactSettings.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myContactSettings.items.help.title',
        descriptionKey: 'myContactSettings.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'myContactSettings.items.apply.title',
        descriptionKey: 'myContactSettings.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myContactSettings.items.privacy.title',
        descriptionKey: 'myContactSettings.items.privacy.desc'
      }
    ]
  },
  contactList: {
    titleKey: 'contactList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listSort
  },
  myContactList: {
    titleKey: 'myContactList.title',
    introKey: 'myContactList.intro',
    items: [
      {
        icon: 'settings_account_box',
        titleKey: 'myContactList.items.open.title',
        descriptionKey: 'myContactList.items.open.desc'
      },
      {
        icon: 'delete_forever',
        titleKey: 'myContactList.items.delete.title',
        descriptionKey: 'myContactList.items.delete.desc'
      },
      {
        icon: 'conversation',
        titleKey: 'myContactList.items.chat.title',
        descriptionKey: 'myContactList.items.chat.desc'
      },
      {
        icon: 'dashboard',
        titleKey: 'myContactList.items.tiles.title',
        descriptionKey: 'myContactList.items.tiles.desc'
      },
      {
        icon: 'more_horiz',
        titleKey: 'myContactList.items.more.title',
        descriptionKey: 'myContactList.items.more.desc'
      },
      {
        icon: 'bookmark_add',
        titleKey: 'myContactList.items.subscribe.title',
        descriptionKey: 'myContactList.items.subscribe.desc'
      },
      {
        icon: 'bookmark_remove',
        titleKey: 'myContactList.items.unsubscribe.title',
        descriptionKey: 'myContactList.items.unsubscribe.desc'
      },
      {
        icon: 'swap_vert',
        titleKey: 'myContactList.items.sort.title',
        descriptionKey: 'myContactList.items.sort.desc'
      },
      {
        icon: 'connect_without_contact',
        titleKey: 'myContactList.items.add.title',
        descriptionKey: 'myContactList.items.add.desc'
      },
      {
        icon: 'close',
        titleKey: 'myContactList.items.close.title',
        descriptionKey: 'myContactList.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myContactList.items.help.title',
        descriptionKey: 'myContactList.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myContactList.items.privacy.title',
        descriptionKey: 'myContactList.items.privacy.desc'
      }
    ]
  },
  contactSort: {
    titleKey: 'contactSort.title',
    introKey: 'common.intros.sort',
    items: ITEMS.sortDialog
  },
  myContactSort: {
    titleKey: 'myContactSort.title',
    introKey: 'myContactSort.intro',
    items: [
      {
        icon: 'drag_indicator',
        titleKey: 'myContactSort.items.reorder.title',
        descriptionKey: 'myContactSort.items.reorder.desc'
      },
      {
        icon: 'settings',
        titleKey: 'myContactSort.items.settings.title',
        descriptionKey: 'myContactSort.items.settings.desc'
      },
      {
        icon: 'close',
        titleKey: 'myContactSort.items.close.title',
        descriptionKey: 'myContactSort.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myContactSort.items.help.title',
        descriptionKey: 'myContactSort.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'myContactSort.items.apply.title',
        descriptionKey: 'myContactSort.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myContactSort.items.privacy.title',
        descriptionKey: 'myContactSort.items.privacy.desc'
      }
    ]
  },
  documentList: {
    titleKey: 'documentList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  editMessage: {
    titleKey: 'editMessage.title',
    introKey: 'editMessage.intro',
    items: [
      {
        icon: 'photo',
        titleKey: 'editMessage.items.media.title',
        descriptionKey: 'editMessage.items.media.desc'
      },
      {
        icon: 'edit',
        titleKey: 'editMessage.items.text.title',
        descriptionKey: 'editMessage.items.text.desc'
      },
      {
        icon: 'cycle',
        titleKey: 'editMessage.items.style.title',
        descriptionKey: 'editMessage.items.style.desc'
      },
      {
        icon: 'place',
        titleKey: 'editMessage.items.location.title',
        descriptionKey: 'editMessage.items.location.desc'
      },
      {
        icon: 'delete',
        titleKey: 'editMessage.items.remove.title',
        descriptionKey: 'editMessage.items.remove.desc'
      },
      {
        icon: 'close',
        titleKey: 'editMessage.items.close.title',
        descriptionKey: 'editMessage.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'editMessage.items.help.title',
        descriptionKey: 'editMessage.items.help.desc'
      },
      {
        icon: 'send',
        titleKey: 'editMessage.items.apply.title',
        descriptionKey: 'editMessage.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'editMessage.items.privacy.title',
        descriptionKey: 'editMessage.items.privacy.desc'
      }
    ]
  },
  editNote: {
    titleKey: 'editNote.title',
    introKey: 'editNote.intro',
    items: [
      {
        icon: 'photo',
        titleKey: 'editNote.items.media.title',
        descriptionKey: 'editNote.items.media.desc'
      },
      {
        icon: 'edit',
        titleKey: 'editNote.items.text.title',
        descriptionKey: 'editNote.items.text.desc'
      },
      {
        icon: 'cycle',
        titleKey: 'editNote.items.style.title',
        descriptionKey: 'editNote.items.style.desc'
      },
      {
        icon: 'place',
        titleKey: 'editNote.items.location.title',
        descriptionKey: 'editNote.items.location.desc'
      },
      {
        icon: 'delete',
        titleKey: 'editNote.items.remove.title',
        descriptionKey: 'editNote.items.remove.desc'
      },
      {
        icon: 'close',
        titleKey: 'editNote.items.close.title',
        descriptionKey: 'editNote.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'editNote.items.help.title',
        descriptionKey: 'editNote.items.help.desc'
      },
      {
        icon: 'send',
        titleKey: 'editNote.items.apply.title',
        descriptionKey: 'editNote.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'editNote.items.privacy.title',
        descriptionKey: 'editNote.items.privacy.desc'
      }
    ]
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
    introKey: 'legalDisclaimer.intro',
    items: [
      {
        icon: 'translate',
        titleKey: 'legalDisclaimer.items.language.title',
        descriptionKey: 'legalDisclaimer.items.language.desc'
      },
      {
        icon: 'description',
        titleKey: 'legalDisclaimer.items.content.title',
        descriptionKey: 'legalDisclaimer.items.content.desc'
      },
      {
        icon: 'fact_check',
        titleKey: 'legalDisclaimer.items.consent.title',
        descriptionKey: 'legalDisclaimer.items.consent.desc'
      },
      {
        icon: 'restart_alt',
        titleKey: 'legalDisclaimer.items.retry.title',
        descriptionKey: 'legalDisclaimer.items.retry.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'legalDisclaimer.items.open.title',
        descriptionKey: 'legalDisclaimer.items.open.desc'
      },
      {
        icon: 'download',
        titleKey: 'legalDisclaimer.items.download.title',
        descriptionKey: 'legalDisclaimer.items.download.desc'
      },
      {
        icon: 'close',
        titleKey: 'legalDisclaimer.items.close.title',
        descriptionKey: 'legalDisclaimer.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'legalDisclaimer.items.help.title',
        descriptionKey: 'legalDisclaimer.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'legalDisclaimer.items.privacy.title',
        descriptionKey: 'legalDisclaimer.items.privacy.desc'
      }
    ]
  },
  legalExternalContent: {
    titleKey: 'legalExternalContent.title',
    introKey: 'legalExternalContent.intro',
    items: [
      {
        icon: 'public',
        titleKey: 'legalExternalContent.items.providers.title',
        descriptionKey: 'legalExternalContent.items.providers.desc'
      },
      {
        icon: 'toggle_on',
        titleKey: 'legalExternalContent.items.toggle.title',
        descriptionKey: 'legalExternalContent.items.toggle.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'legalExternalContent.items.links.title',
        descriptionKey: 'legalExternalContent.items.links.desc'
      },
      {
        icon: 'close',
        titleKey: 'legalExternalContent.items.close.title',
        descriptionKey: 'legalExternalContent.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'legalExternalContent.items.help.title',
        descriptionKey: 'legalExternalContent.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'legalExternalContent.items.apply.title',
        descriptionKey: 'legalExternalContent.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'legalExternalContent.items.privacy.title',
        descriptionKey: 'legalExternalContent.items.privacy.desc'
      }
    ]
  },
  legalNotice: {
    titleKey: 'legalNotice.title',
    introKey: 'legalNotice.intro',
    items: [
      {
        icon: 'translate',
        titleKey: 'legalNotice.items.language.title',
        descriptionKey: 'legalNotice.items.language.desc'
      },
      {
        icon: 'description',
        titleKey: 'legalNotice.items.content.title',
        descriptionKey: 'legalNotice.items.content.desc'
      },
      {
        icon: 'restart_alt',
        titleKey: 'legalNotice.items.retry.title',
        descriptionKey: 'legalNotice.items.retry.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'legalNotice.items.open.title',
        descriptionKey: 'legalNotice.items.open.desc'
      },
      {
        icon: 'download',
        titleKey: 'legalNotice.items.download.title',
        descriptionKey: 'legalNotice.items.download.desc'
      },
      {
        icon: 'close',
        titleKey: 'legalNotice.items.close.title',
        descriptionKey: 'legalNotice.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'legalNotice.items.help.title',
        descriptionKey: 'legalNotice.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'legalNotice.items.privacy.title',
        descriptionKey: 'legalNotice.items.privacy.desc'
      }
    ]
  },
  privacyPolicy: {
    titleKey: 'privacyPolicy.title',
    introKey: 'privacyPolicy.intro',
    items: [
      {
        icon: 'translate',
        titleKey: 'privacyPolicy.items.language.title',
        descriptionKey: 'privacyPolicy.items.language.desc'
      },
      {
        icon: 'description',
        titleKey: 'privacyPolicy.items.content.title',
        descriptionKey: 'privacyPolicy.items.content.desc'
      },
      {
        icon: 'fact_check',
        titleKey: 'privacyPolicy.items.consent.title',
        descriptionKey: 'privacyPolicy.items.consent.desc'
      },
      {
        icon: 'restart_alt',
        titleKey: 'privacyPolicy.items.retry.title',
        descriptionKey: 'privacyPolicy.items.retry.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'privacyPolicy.items.open.title',
        descriptionKey: 'privacyPolicy.items.open.desc'
      },
      {
        icon: 'download',
        titleKey: 'privacyPolicy.items.download.title',
        descriptionKey: 'privacyPolicy.items.download.desc'
      },
      {
        icon: 'close',
        titleKey: 'privacyPolicy.items.close.title',
        descriptionKey: 'privacyPolicy.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'privacyPolicy.items.help.title',
        descriptionKey: 'privacyPolicy.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'privacyPolicy.items.privacy.title',
        descriptionKey: 'privacyPolicy.items.privacy.desc'
      }
    ]
  },
  termsOfService: {
    titleKey: 'termsOfService.title',
    introKey: 'termsOfService.intro',
    items: [
      {
        icon: 'translate',
        titleKey: 'termsOfService.items.language.title',
        descriptionKey: 'termsOfService.items.language.desc'
      },
      {
        icon: 'description',
        titleKey: 'termsOfService.items.content.title',
        descriptionKey: 'termsOfService.items.content.desc'
      },
      {
        icon: 'fact_check',
        titleKey: 'termsOfService.items.consent.title',
        descriptionKey: 'termsOfService.items.consent.desc'
      },
      {
        icon: 'restart_alt',
        titleKey: 'termsOfService.items.retry.title',
        descriptionKey: 'termsOfService.items.retry.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'termsOfService.items.open.title',
        descriptionKey: 'termsOfService.items.open.desc'
      },
      {
        icon: 'download',
        titleKey: 'termsOfService.items.download.title',
        descriptionKey: 'termsOfService.items.download.desc'
      },
      {
        icon: 'close',
        titleKey: 'termsOfService.items.close.title',
        descriptionKey: 'termsOfService.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'termsOfService.items.help.title',
        descriptionKey: 'termsOfService.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'termsOfService.items.privacy.title',
        descriptionKey: 'termsOfService.items.privacy.desc'
      }
    ]
  },
  thirdPartyLicenses: {
    titleKey: 'thirdPartyLicenses.title',
    introKey: 'thirdPartyLicenses.intro',
    items: [
      {
        icon: 'description',
        titleKey: 'thirdPartyLicenses.items.content.title',
        descriptionKey: 'thirdPartyLicenses.items.content.desc'
      },
      {
        icon: 'restart_alt',
        titleKey: 'thirdPartyLicenses.items.retry.title',
        descriptionKey: 'thirdPartyLicenses.items.retry.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'thirdPartyLicenses.items.open.title',
        descriptionKey: 'thirdPartyLicenses.items.open.desc'
      },
      {
        icon: 'download',
        titleKey: 'thirdPartyLicenses.items.download.title',
        descriptionKey: 'thirdPartyLicenses.items.download.desc'
      },
      {
        icon: 'close',
        titleKey: 'thirdPartyLicenses.items.close.title',
        descriptionKey: 'thirdPartyLicenses.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'thirdPartyLicenses.items.help.title',
        descriptionKey: 'thirdPartyLicenses.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'thirdPartyLicenses.items.privacy.title',
        descriptionKey: 'thirdPartyLicenses.items.privacy.desc'
      }
    ]
  },
  messageList: {
    titleKey: 'messageList.title',
    introKey: 'common.intros.list',
    items: ITEMS.listBasic
  },
  myMessageList: {
    titleKey: 'myMessageList.title',
    introKey: 'myMessageList.intro',
    items: [
      {
        icon: 'chat_add_on',
        titleKey: 'myMessageList.items.add.title',
        descriptionKey: 'myMessageList.items.add.desc'
      },
      {
        icon: 'forum',
        titleKey: 'myMessageList.items.comments.title',
        descriptionKey: 'myMessageList.items.comments.desc'
      },
      {
        icon: 'thumb_up',
        titleKey: 'myMessageList.items.like.title',
        descriptionKey: 'myMessageList.items.like.desc'
      },
      {
        icon: 'thumb_down',
        titleKey: 'myMessageList.items.unlike.title',
        descriptionKey: 'myMessageList.items.unlike.desc'
      },
      {
        icon: 'edit',
        titleKey: 'myMessageList.items.edit.title',
        descriptionKey: 'myMessageList.items.edit.desc'
      },
      {
        icon: 'delete_forever',
        titleKey: 'myMessageList.items.delete.title',
        descriptionKey: 'myMessageList.items.delete.desc'
      },
      {
        icon: 'public',
        titleKey: 'myMessageList.items.moderation.title',
        descriptionKey: 'myMessageList.items.moderation.desc'
      },
      {
        icon: 'auto_delete',
        titleKey: 'myMessageList.items.retention.title',
        descriptionKey: 'myMessageList.items.retention.desc'
      },
      {
        icon: 'flag',
        titleKey: 'myMessageList.items.dsa.title',
        descriptionKey: 'myMessageList.items.dsa.desc'
      },
      {
        icon: 'more_horiz',
        titleKey: 'myMessageList.items.more.title',
        descriptionKey: 'myMessageList.items.more.desc'
      },
      {
        icon: 'translate',
        titleKey: 'myMessageList.items.translate.title',
        descriptionKey: 'myMessageList.items.translate.desc'
      },
      {
        icon: 'place',
        titleKey: 'myMessageList.items.flyTo.title',
        descriptionKey: 'myMessageList.items.flyTo.desc'
      },
      {
        icon: 'assistant_direction',
        titleKey: 'myMessageList.items.navigate.title',
        descriptionKey: 'myMessageList.items.navigate.desc'
      },
      {
        icon: 'person',
        titleKey: 'myMessageList.items.profile.title',
        descriptionKey: 'myMessageList.items.profile.desc'
      },
      {
        icon: 'flag',
        titleKey: 'myMessageList.items.report.title',
        descriptionKey: 'myMessageList.items.report.desc'
      },
      {
        icon: 'close',
        titleKey: 'myMessageList.items.close.title',
        descriptionKey: 'myMessageList.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myMessageList.items.help.title',
        descriptionKey: 'myMessageList.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myMessageList.items.privacy.title',
        descriptionKey: 'myMessageList.items.privacy.desc'
      }
    ]
  },
  messageProfile: {
    titleKey: 'messageProfile.title',
    introKey: 'common.intros.editor',
    items: ITEMS.editorMedia
  },
  noteList: {
    titleKey: 'noteList.title',
    introKey: 'noteList.intro',
    items: [
      {
        icon: 'touch_app',
        titleKey: 'noteList.items.open.title',
        descriptionKey: 'noteList.items.open.desc'
      },
      {
        icon: 'delete_forever',
        titleKey: 'noteList.items.delete.title',
        descriptionKey: 'noteList.items.delete.desc'
      },
      {
        icon: 'edit',
        titleKey: 'noteList.items.edit.title',
        descriptionKey: 'noteList.items.edit.desc'
      },
      {
        icon: 'place',
        titleKey: 'noteList.items.flyTo.title',
        descriptionKey: 'noteList.items.flyTo.desc'
      },
      {
        icon: 'assistant_direction',
        titleKey: 'noteList.items.navigate.title',
        descriptionKey: 'noteList.items.navigate.desc'
      },
      {
        icon: 'close',
        titleKey: 'noteList.items.close.title',
        descriptionKey: 'noteList.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'noteList.items.help.title',
        descriptionKey: 'noteList.items.help.desc'
      },
      {
        icon: 'add_notes',
        titleKey: 'noteList.items.add.title',
        descriptionKey: 'noteList.items.add.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'noteList.items.privacy.title',
        descriptionKey: 'noteList.items.privacy.desc'
      }
    ]
  },
  pinHint: {
    titleKey: 'pinHint.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  },
  placeList: {
    titleKey: 'placeList.title',
    introKey: 'placeList.intro',
    items: [
      {
        icon: 'touch_app',
        titleKey: 'placeList.items.open.title',
        descriptionKey: 'placeList.items.open.desc'
      },
      {
        icon: 'delete_forever',
        titleKey: 'placeList.items.delete.title',
        descriptionKey: 'placeList.items.delete.desc'
      },
      {
        icon: 'dashboard',
        titleKey: 'placeList.items.tiles.title',
        descriptionKey: 'placeList.items.tiles.desc'
      },
      {
        icon: 'place',
        titleKey: 'placeList.items.flyTo.title',
        descriptionKey: 'placeList.items.flyTo.desc'
      },
      {
        icon: 'more_horiz',
        titleKey: 'placeList.items.more.title',
        descriptionKey: 'placeList.items.more.desc'
      },
      {
        icon: 'settings_account_box',
        titleKey: 'placeList.items.edit.title',
        descriptionKey: 'placeList.items.edit.desc'
      },
      {
        icon: 'map',
        titleKey: 'placeList.items.openMaps.title',
        descriptionKey: 'placeList.items.openMaps.desc'
      },
      {
        icon: 'bookmark_add',
        titleKey: 'placeList.items.subscribe.title',
        descriptionKey: 'placeList.items.subscribe.desc'
      },
      {
        icon: 'bookmark_remove',
        titleKey: 'placeList.items.unsubscribe.title',
        descriptionKey: 'placeList.items.unsubscribe.desc'
      },
      {
        icon: 'swap_vert',
        titleKey: 'placeList.items.sort.title',
        descriptionKey: 'placeList.items.sort.desc'
      },
      {
        icon: 'add_location',
        titleKey: 'placeList.items.add.title',
        descriptionKey: 'placeList.items.add.desc'
      },
      {
        icon: 'close',
        titleKey: 'placeList.items.close.title',
        descriptionKey: 'placeList.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'placeList.items.help.title',
        descriptionKey: 'placeList.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'placeList.items.privacy.title',
        descriptionKey: 'placeList.items.privacy.desc'
      }
    ]
  },
  placeSettings: {
    titleKey: 'placeSettings.title',
    introKey: 'common.intros.settings',
    items: ITEMS.settings
  },
  myPlaceSettings: {
    titleKey: 'myPlaceSettings.title',
    introKey: 'myPlaceSettings.intro',
    items: [
      {
        icon: 'edit',
        titleKey: 'myPlaceSettings.items.name.title',
        descriptionKey: 'myPlaceSettings.items.name.desc'
      },
      {
        icon: 'photo_camera',
        titleKey: 'myPlaceSettings.items.avatar.title',
        descriptionKey: 'myPlaceSettings.items.avatar.desc'
      },
      {
        icon: 'delete',
        titleKey: 'myPlaceSettings.items.avatarRemove.title',
        descriptionKey: 'myPlaceSettings.items.avatarRemove.desc'
      },
      {
        icon: 'wallpaper',
        titleKey: 'myPlaceSettings.items.background.title',
        descriptionKey: 'myPlaceSettings.items.background.desc'
      },
      {
        icon: 'delete',
        titleKey: 'myPlaceSettings.items.backgroundRemove.title',
        descriptionKey: 'myPlaceSettings.items.backgroundRemove.desc'
      },
      {
        icon: 'opacity',
        titleKey: 'myPlaceSettings.items.transparency.title',
        descriptionKey: 'myPlaceSettings.items.transparency.desc'
      },
      {
        icon: 'close',
        titleKey: 'myPlaceSettings.items.close.title',
        descriptionKey: 'myPlaceSettings.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myPlaceSettings.items.help.title',
        descriptionKey: 'myPlaceSettings.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'myPlaceSettings.items.apply.title',
        descriptionKey: 'myPlaceSettings.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myPlaceSettings.items.privacy.title',
        descriptionKey: 'myPlaceSettings.items.privacy.desc'
      }
    ]
  },
  placeSort: {
    titleKey: 'placeSort.title',
    introKey: 'common.intros.sort',
    items: ITEMS.sortDialog
  },
  myPlaceSort: {
    titleKey: 'myPlaceSort.title',
    introKey: 'myPlaceSort.intro',
    items: [
      {
        icon: 'drag_indicator',
        titleKey: 'myPlaceSort.items.reorder.title',
        descriptionKey: 'myPlaceSort.items.reorder.desc'
      },
      {
        icon: 'settings',
        titleKey: 'myPlaceSort.items.settings.title',
        descriptionKey: 'myPlaceSort.items.settings.desc'
      },
      {
        icon: 'close',
        titleKey: 'myPlaceSort.items.close.title',
        descriptionKey: 'myPlaceSort.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myPlaceSort.items.help.title',
        descriptionKey: 'myPlaceSort.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'myPlaceSort.items.apply.title',
        descriptionKey: 'myPlaceSort.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myPlaceSort.items.privacy.title',
        descriptionKey: 'myPlaceSort.items.privacy.desc'
      }
    ]
  },
  sharedContent: {
    titleKey: 'sharedContent.title',
    introKey: 'common.intros.info',
    items: ITEMS.info
  },
  tileList: {
    titleKey: 'tileList.title',
    introKey: 'tileList.intro',
    items: [
      {
        icon: 'touch_app',
        titleKey: 'tileList.items.open.title',
        descriptionKey: 'tileList.items.open.desc'
      },
      {
        icon: 'settings',
        titleKey: 'tileList.items.settings.title',
        descriptionKey: 'tileList.items.settings.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileList.items.close.title',
        descriptionKey: 'tileList.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileList.items.help.title',
        descriptionKey: 'tileList.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileList.items.privacy.title',
        descriptionKey: 'tileList.items.privacy.desc'
      }
    ]
  },
  tileSettings: {
    titleKey: 'tileSettings.title',
    introKey: 'tileSettings.intro',
    items: [
      {
        icon: 'add',
        titleKey: 'tileSettings.items.add.title',
        descriptionKey: 'tileSettings.items.add.desc'
      },
      {
        icon: 'drag_indicator',
        titleKey: 'tileSettings.items.reorder.title',
        descriptionKey: 'tileSettings.items.reorder.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileSettings.items.edit.title',
        descriptionKey: 'tileSettings.items.edit.desc'
      },
      {
        icon: 'delete',
        titleKey: 'tileSettings.items.delete.title',
        descriptionKey: 'tileSettings.items.delete.desc'
      },
      {
        icon: 'visibility',
        titleKey: 'tileSettings.items.toggle.title',
        descriptionKey: 'tileSettings.items.toggle.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileSettings.items.close.title',
        descriptionKey: 'tileSettings.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileSettings.items.help.title',
        descriptionKey: 'tileSettings.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'tileSettings.items.apply.title',
        descriptionKey: 'tileSettings.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileSettings.items.privacy.title',
        descriptionKey: 'tileSettings.items.privacy.desc'
      }
    ]
  },
  tileEditAnniversary: {
    titleKey: 'tileEditAnniversary.title',
    introKey: 'tileEditAnniversary.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditAnniversary.items.icon.title',
        descriptionKey: 'tileEditAnniversary.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditAnniversary.items.title.title',
        descriptionKey: 'tileEditAnniversary.items.title.desc'
      },
      {
        icon: 'calendar_month',
        titleKey: 'tileEditAnniversary.items.date.title',
        descriptionKey: 'tileEditAnniversary.items.date.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditAnniversary.items.close.title',
        descriptionKey: 'tileEditAnniversary.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditAnniversary.items.help.title',
        descriptionKey: 'tileEditAnniversary.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditAnniversary.items.apply.title',
        descriptionKey: 'tileEditAnniversary.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditAnniversary.items.privacy.title',
        descriptionKey: 'tileEditAnniversary.items.privacy.desc'
      }
    ]
  },
  tileEditFile: {
    titleKey: 'tileEditFile.title',
    introKey: 'tileEditFile.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditFile.items.icon.title',
        descriptionKey: 'tileEditFile.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditFile.items.title.title',
        descriptionKey: 'tileEditFile.items.title.desc'
      },
      {
        icon: 'add',
        titleKey: 'tileEditFile.items.addFiles.title',
        descriptionKey: 'tileEditFile.items.addFiles.desc'
      },
      {
        icon: 'drag_indicator',
        titleKey: 'tileEditFile.items.reorder.title',
        descriptionKey: 'tileEditFile.items.reorder.desc'
      },
      {
        icon: 'open_in_new',
        titleKey: 'tileEditFile.items.open.title',
        descriptionKey: 'tileEditFile.items.open.desc'
      },
      {
        icon: 'delete',
        titleKey: 'tileEditFile.items.remove.title',
        descriptionKey: 'tileEditFile.items.remove.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditFile.items.close.title',
        descriptionKey: 'tileEditFile.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditFile.items.help.title',
        descriptionKey: 'tileEditFile.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditFile.items.apply.title',
        descriptionKey: 'tileEditFile.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditFile.items.privacy.title',
        descriptionKey: 'tileEditFile.items.privacy.desc'
      }
    ]
  },
  tileEditMigraine: {
    titleKey: 'tileEditMigraine.title',
    introKey: 'tileEditMigraine.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditMigraine.items.icon.title',
        descriptionKey: 'tileEditMigraine.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditMigraine.items.title.title',
        descriptionKey: 'tileEditMigraine.items.title.desc'
      },
      {
        icon: 'device_thermostat',
        titleKey: 'tileEditMigraine.items.temperature.title',
        descriptionKey: 'tileEditMigraine.items.temperature.desc'
      },
      {
        icon: 'compress',
        titleKey: 'tileEditMigraine.items.pressure.title',
        descriptionKey: 'tileEditMigraine.items.pressure.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditMigraine.items.close.title',
        descriptionKey: 'tileEditMigraine.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditMigraine.items.help.title',
        descriptionKey: 'tileEditMigraine.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditMigraine.items.apply.title',
        descriptionKey: 'tileEditMigraine.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditMigraine.items.privacy.title',
        descriptionKey: 'tileEditMigraine.items.privacy.desc'
      }
    ]
  },
  tileEditMultitext: {
    titleKey: 'tileEditMultitext.title',
    introKey: 'tileEditMultitext.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditMultitext.items.icon.title',
        descriptionKey: 'tileEditMultitext.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditMultitext.items.title.title',
        descriptionKey: 'tileEditMultitext.items.title.desc'
      },
      {
        icon: 'notes',
        titleKey: 'tileEditMultitext.items.text.title',
        descriptionKey: 'tileEditMultitext.items.text.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditMultitext.items.close.title',
        descriptionKey: 'tileEditMultitext.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditMultitext.items.help.title',
        descriptionKey: 'tileEditMultitext.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditMultitext.items.apply.title',
        descriptionKey: 'tileEditMultitext.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditMultitext.items.privacy.title',
        descriptionKey: 'tileEditMultitext.items.privacy.desc'
      }
    ]
  },
  tileEditPollution: {
    titleKey: 'tileEditPollution.title',
    introKey: 'tileEditPollution.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditPollution.items.icon.title',
        descriptionKey: 'tileEditPollution.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditPollution.items.title.title',
        descriptionKey: 'tileEditPollution.items.title.desc'
      },
      {
        icon: 'checklist',
        titleKey: 'tileEditPollution.items.keys.title',
        descriptionKey: 'tileEditPollution.items.keys.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditPollution.items.close.title',
        descriptionKey: 'tileEditPollution.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditPollution.items.help.title',
        descriptionKey: 'tileEditPollution.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditPollution.items.apply.title',
        descriptionKey: 'tileEditPollution.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditPollution.items.privacy.title',
        descriptionKey: 'tileEditPollution.items.privacy.desc'
      }
    ]
  },
  tileEditQuickActionAction: {
    titleKey: 'tileEditQuickActionAction.title',
    introKey: 'tileEditQuickActionAction.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditQuickActionAction.items.icon.title',
        descriptionKey: 'tileEditQuickActionAction.items.icon.desc'
      },
      {
        icon: 'label',
        titleKey: 'tileEditQuickActionAction.items.label.title',
        descriptionKey: 'tileEditQuickActionAction.items.label.desc'
      },
      {
        icon: 'category',
        titleKey: 'tileEditQuickActionAction.items.type.title',
        descriptionKey: 'tileEditQuickActionAction.items.type.desc'
      },
      {
        icon: 'ads_click',
        titleKey: 'tileEditQuickActionAction.items.target.title',
        descriptionKey: 'tileEditQuickActionAction.items.target.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditQuickActionAction.items.close.title',
        descriptionKey: 'tileEditQuickActionAction.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditQuickActionAction.items.help.title',
        descriptionKey: 'tileEditQuickActionAction.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditQuickActionAction.items.apply.title',
        descriptionKey: 'tileEditQuickActionAction.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditQuickActionAction.items.privacy.title',
        descriptionKey: 'tileEditQuickActionAction.items.privacy.desc'
      }
    ]
  },
  tileEditQuickAction: {
    titleKey: 'tileEditQuickAction.title',
    introKey: 'tileEditQuickAction.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditQuickAction.items.icon.title',
        descriptionKey: 'tileEditQuickAction.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditQuickAction.items.title.title',
        descriptionKey: 'tileEditQuickAction.items.title.desc'
      },
      {
        icon: 'add',
        titleKey: 'tileEditQuickAction.items.addAction.title',
        descriptionKey: 'tileEditQuickAction.items.addAction.desc'
      },
      {
        icon: 'drag_indicator',
        titleKey: 'tileEditQuickAction.items.reorder.title',
        descriptionKey: 'tileEditQuickAction.items.reorder.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditQuickAction.items.editAction.title',
        descriptionKey: 'tileEditQuickAction.items.editAction.desc'
      },
      {
        icon: 'delete',
        titleKey: 'tileEditQuickAction.items.deleteAction.title',
        descriptionKey: 'tileEditQuickAction.items.deleteAction.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditQuickAction.items.close.title',
        descriptionKey: 'tileEditQuickAction.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditQuickAction.items.help.title',
        descriptionKey: 'tileEditQuickAction.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditQuickAction.items.apply.title',
        descriptionKey: 'tileEditQuickAction.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditQuickAction.items.privacy.title',
        descriptionKey: 'tileEditQuickAction.items.privacy.desc'
      }
    ]
  },
  tileEditText: {
    titleKey: 'tileEditText.title',
    introKey: 'tileEditText.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditText.items.icon.title',
        descriptionKey: 'tileEditText.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditText.items.title.title',
        descriptionKey: 'tileEditText.items.title.desc'
      },
      {
        icon: 'text_fields',
        titleKey: 'tileEditText.items.text.title',
        descriptionKey: 'tileEditText.items.text.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditText.items.close.title',
        descriptionKey: 'tileEditText.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditText.items.help.title',
        descriptionKey: 'tileEditText.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditText.items.apply.title',
        descriptionKey: 'tileEditText.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditText.items.privacy.title',
        descriptionKey: 'tileEditText.items.privacy.desc'
      }
    ]
  },
  tileEditTodo: {
    titleKey: 'tileEditTodo.title',
    introKey: 'tileEditTodo.intro',
    items: [
      {
        icon: 'style',
        titleKey: 'tileEditTodo.items.icon.title',
        descriptionKey: 'tileEditTodo.items.icon.desc'
      },
      {
        icon: 'edit',
        titleKey: 'tileEditTodo.items.title.title',
        descriptionKey: 'tileEditTodo.items.title.desc'
      },
      {
        icon: 'add',
        titleKey: 'tileEditTodo.items.addTodo.title',
        descriptionKey: 'tileEditTodo.items.addTodo.desc'
      },
      {
        icon: 'drag_indicator',
        titleKey: 'tileEditTodo.items.reorder.title',
        descriptionKey: 'tileEditTodo.items.reorder.desc'
      },
      {
        icon: 'check_circle',
        titleKey: 'tileEditTodo.items.toggleDone.title',
        descriptionKey: 'tileEditTodo.items.toggleDone.desc'
      },
      {
        icon: 'delete',
        titleKey: 'tileEditTodo.items.deleteTodo.title',
        descriptionKey: 'tileEditTodo.items.deleteTodo.desc'
      },
      {
        icon: 'close',
        titleKey: 'tileEditTodo.items.close.title',
        descriptionKey: 'tileEditTodo.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tileEditTodo.items.help.title',
        descriptionKey: 'tileEditTodo.items.help.desc'
      },
      {
        icon: 'save',
        titleKey: 'tileEditTodo.items.apply.title',
        descriptionKey: 'tileEditTodo.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tileEditTodo.items.privacy.title',
        descriptionKey: 'tileEditTodo.items.privacy.desc'
      }
    ]
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
    introKey: 'locationPicker.intro',
    items: [
      {
        icon: 'search',
        titleKey: 'locationPicker.items.search.title',
        descriptionKey: 'locationPicker.items.search.desc'
      },
      {
        icon: 'touch_app',
        titleKey: 'locationPicker.items.select.title',
        descriptionKey: 'locationPicker.items.select.desc'
      },
      {
        icon: 'my_location',
        titleKey: 'locationPicker.items.locate.title',
        descriptionKey: 'locationPicker.items.locate.desc'
      },
      {
        icon: 'map',
        titleKey: 'locationPicker.items.view.title',
        descriptionKey: 'locationPicker.items.view.desc'
      },
      {
        icon: 'assistant_direction',
        titleKey: 'locationPicker.items.navigate.title',
        descriptionKey: 'locationPicker.items.navigate.desc'
      },
      {
        icon: 'close',
        titleKey: 'locationPicker.items.close.title',
        descriptionKey: 'locationPicker.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'locationPicker.items.help.title',
        descriptionKey: 'locationPicker.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'locationPicker.items.apply.title',
        descriptionKey: 'locationPicker.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'locationPicker.items.privacy.title',
        descriptionKey: 'locationPicker.items.privacy.desc'
      }
    ]
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
    introKey: 'nominatimSearch.intro',
    items: [
      {
        icon: 'search',
        titleKey: 'nominatimSearch.items.query.title',
        descriptionKey: 'nominatimSearch.items.query.desc'
      },
      {
        icon: 'map',
        titleKey: 'nominatimSearch.items.viewMap.title',
        descriptionKey: 'nominatimSearch.items.viewMap.desc'
      },
      {
        icon: 'list',
        titleKey: 'nominatimSearch.items.viewList.title',
        descriptionKey: 'nominatimSearch.items.viewList.desc'
      },
      {
        icon: 'place',
        titleKey: 'nominatimSearch.items.actions.title',
        descriptionKey: 'nominatimSearch.items.actions.desc'
      },
      {
        icon: 'add_location',
        titleKey: 'nominatimSearch.items.add.title',
        descriptionKey: 'nominatimSearch.items.add.desc'
      },
      {
        icon: 'close',
        titleKey: 'nominatimSearch.items.close.title',
        descriptionKey: 'nominatimSearch.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'nominatimSearch.items.help.title',
        descriptionKey: 'nominatimSearch.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'nominatimSearch.items.privacy.title',
        descriptionKey: 'nominatimSearch.items.privacy.desc'
      }
    ]
  },
  qrCode: {
    titleKey: 'qrCode.title',
    introKey: 'common.intros.qr',
    items: ITEMS.qr
  },
  myContactShareQr: {
    titleKey: 'myContactShareQr.title',
    introKey: 'myContactShareQr.intro',
    items: [
      {
        icon: 'qr_code_2',
        titleKey: 'myContactShareQr.items.show.title',
        descriptionKey: 'myContactShareQr.items.show.desc'
      },
      {
        icon: 'qr_code_scanner',
        titleKey: 'myContactShareQr.items.scanByOther.title',
        descriptionKey: 'myContactShareQr.items.scanByOther.desc'
      },
      {
        icon: 'close',
        titleKey: 'myContactShareQr.items.close.title',
        descriptionKey: 'myContactShareQr.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myContactShareQr.items.help.title',
        descriptionKey: 'myContactShareQr.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myContactShareQr.items.privacy.title',
        descriptionKey: 'myContactShareQr.items.privacy.desc'
      }
    ]
  },
  scanner: {
    titleKey: 'scanner.title',
    introKey: 'common.intros.scan',
    items: ITEMS.scan
  },
  myContactScanQr: {
    titleKey: 'myContactScanQr.title',
    introKey: 'myContactScanQr.intro',
    items: [
      {
        icon: 'photo_camera',
        titleKey: 'myContactScanQr.items.camera.title',
        descriptionKey: 'myContactScanQr.items.camera.desc'
      },
      {
        icon: 'qr_code_scanner',
        titleKey: 'myContactScanQr.items.scan.title',
        descriptionKey: 'myContactScanQr.items.scan.desc'
      },
      {
        icon: 'close',
        titleKey: 'myContactScanQr.items.close.title',
        descriptionKey: 'myContactScanQr.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myContactScanQr.items.help.title',
        descriptionKey: 'myContactScanQr.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myContactScanQr.items.privacy.title',
        descriptionKey: 'myContactScanQr.items.privacy.desc'
      }
    ]
  },
  searchSettings: {
    titleKey: 'searchSettings.title',
    introKey: 'searchSettings.intro',
    items: [
      {
        icon: 'manage_search',
        titleKey: 'searchSettings.items.sources.title',
        descriptionKey: 'searchSettings.items.sources.desc'
      },
      {
        icon: 'zoom_in_map',
        titleKey: 'searchSettings.items.zoom.title',
        descriptionKey: 'searchSettings.items.zoom.desc'
      },
      {
        icon: 'map',
        titleKey: 'searchSettings.items.preview.title',
        descriptionKey: 'searchSettings.items.preview.desc'
      },
      {
        icon: 'close',
        titleKey: 'searchSettings.items.close.title',
        descriptionKey: 'searchSettings.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'searchSettings.items.help.title',
        descriptionKey: 'searchSettings.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'searchSettings.items.apply.title',
        descriptionKey: 'searchSettings.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'searchSettings.items.privacy.title',
        descriptionKey: 'searchSettings.items.privacy.desc'
      }
    ]
  },
  experienceSearch: {
    titleKey: 'experienceSearch.title',
    introKey: 'experienceSearch.intro',
    items: [
      {
        icon: 'search',
        titleKey: 'experienceSearch.items.query.title',
        descriptionKey: 'experienceSearch.items.query.desc'
      },
      {
        icon: 'tune',
        titleKey: 'experienceSearch.items.filter.title',
        descriptionKey: 'experienceSearch.items.filter.desc'
      },
      {
        icon: 'sort',
        titleKey: 'experienceSearch.items.sort.title',
        descriptionKey: 'experienceSearch.items.sort.desc'
      },
      {
        icon: 'map',
        titleKey: 'experienceSearch.items.viewMap.title',
        descriptionKey: 'experienceSearch.items.viewMap.desc'
      },
      {
        icon: 'list',
        titleKey: 'experienceSearch.items.viewList.title',
        descriptionKey: 'experienceSearch.items.viewList.desc'
      },
      {
        icon: 'refresh',
        titleKey: 'experienceSearch.items.loadMore.title',
        descriptionKey: 'experienceSearch.items.loadMore.desc'
      },
      {
        icon: 'expand_content',
        titleKey: 'experienceSearch.items.details.title',
        descriptionKey: 'experienceSearch.items.details.desc'
      },
      {
        icon: 'bookmark_add',
        titleKey: 'experienceSearch.items.saveOrShare.title',
        descriptionKey: 'experienceSearch.items.saveOrShare.desc'
      },
      {
        icon: 'shopping_cart',
        titleKey: 'experienceSearch.items.provider.title',
        descriptionKey: 'experienceSearch.items.provider.desc'
      },
      {
        icon: 'close',
        titleKey: 'experienceSearch.items.close.title',
        descriptionKey: 'experienceSearch.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'experienceSearch.items.help.title',
        descriptionKey: 'experienceSearch.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'experienceSearch.items.privacy.title',
        descriptionKey: 'experienceSearch.items.privacy.desc'
      }
    ]
  },
  myExperienceList: {
    titleKey: 'myExperienceList.title',
    introKey: 'myExperienceList.intro',
    items: [
      {
        icon: 'expand_content',
        titleKey: 'myExperienceList.items.details.title',
        descriptionKey: 'myExperienceList.items.details.desc'
      },
      {
        icon: 'bookmark_remove',
        titleKey: 'myExperienceList.items.remove.title',
        descriptionKey: 'myExperienceList.items.remove.desc'
      },
      {
        icon: 'place',
        titleKey: 'myExperienceList.items.flyTo.title',
        descriptionKey: 'myExperienceList.items.flyTo.desc'
      },
      {
        icon: 'dashboard',
        titleKey: 'myExperienceList.items.tiles.title',
        descriptionKey: 'myExperienceList.items.tiles.desc'
      },
      {
        icon: 'map',
        titleKey: 'myExperienceList.items.openMaps.title',
        descriptionKey: 'myExperienceList.items.openMaps.desc'
      },
      {
        icon: 'shopping_cart',
        titleKey: 'myExperienceList.items.openProvider.title',
        descriptionKey: 'myExperienceList.items.openProvider.desc'
      },
      {
        icon: 'swap_vert',
        titleKey: 'myExperienceList.items.sort.title',
        descriptionKey: 'myExperienceList.items.sort.desc'
      },
      {
        icon: 'close',
        titleKey: 'myExperienceList.items.close.title',
        descriptionKey: 'myExperienceList.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myExperienceList.items.help.title',
        descriptionKey: 'myExperienceList.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myExperienceList.items.privacy.title',
        descriptionKey: 'myExperienceList.items.privacy.desc'
      }
    ]
  },
  myExperienceSort: {
    titleKey: 'myExperienceSort.title',
    introKey: 'myExperienceSort.intro',
    items: [
      {
        icon: 'drag_indicator',
        titleKey: 'myExperienceSort.items.reorder.title',
        descriptionKey: 'myExperienceSort.items.reorder.desc'
      },
      {
        icon: 'close',
        titleKey: 'myExperienceSort.items.close.title',
        descriptionKey: 'myExperienceSort.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'myExperienceSort.items.help.title',
        descriptionKey: 'myExperienceSort.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'myExperienceSort.items.apply.title',
        descriptionKey: 'myExperienceSort.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'myExperienceSort.items.privacy.title',
        descriptionKey: 'myExperienceSort.items.privacy.desc'
      }
    ]
  },
  importMultimedia: {
    titleKey: 'importMultimedia.title',
    introKey: 'importMultimedia.intro',
    items: [
      {
        icon: 'link',
        titleKey: 'importMultimedia.items.url.title',
        descriptionKey: 'importMultimedia.items.url.desc'
      },
      {
        icon: 'content_paste_go',
        titleKey: 'importMultimedia.items.paste.title',
        descriptionKey: 'importMultimedia.items.paste.desc'
      },
      {
        icon: 'visibility',
        titleKey: 'importMultimedia.items.preview.title',
        descriptionKey: 'importMultimedia.items.preview.desc'
      },
      {
        icon: 'tune',
        titleKey: 'importMultimedia.items.external.title',
        descriptionKey: 'importMultimedia.items.external.desc'
      },
      {
        icon: 'delete',
        titleKey: 'importMultimedia.items.clear.title',
        descriptionKey: 'importMultimedia.items.clear.desc'
      },
      {
        icon: 'close',
        titleKey: 'importMultimedia.items.close.title',
        descriptionKey: 'importMultimedia.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'importMultimedia.items.help.title',
        descriptionKey: 'importMultimedia.items.help.desc'
      },
      {
        icon: 'check',
        titleKey: 'importMultimedia.items.apply.title',
        descriptionKey: 'importMultimedia.items.apply.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'importMultimedia.items.privacy.title',
        descriptionKey: 'importMultimedia.items.privacy.desc'
      }
    ]
  },
  tenorSearch: {
    titleKey: 'tenorSearch.title',
    introKey: 'tenorSearch.intro',
    items: [
      {
        icon: 'search',
        titleKey: 'tenorSearch.items.search.title',
        descriptionKey: 'tenorSearch.items.search.desc'
      },
      {
        icon: 'photo_library',
        titleKey: 'tenorSearch.items.select.title',
        descriptionKey: 'tenorSearch.items.select.desc'
      },
      {
        icon: 'arrow_circle_right',
        titleKey: 'tenorSearch.items.more.title',
        descriptionKey: 'tenorSearch.items.more.desc'
      },
      {
        icon: 'toggle_on',
        titleKey: 'tenorSearch.items.enable.title',
        descriptionKey: 'tenorSearch.items.enable.desc'
      },
      {
        icon: 'close',
        titleKey: 'tenorSearch.items.close.title',
        descriptionKey: 'tenorSearch.items.close.desc'
      },
      {
        icon: 'help',
        titleKey: 'tenorSearch.items.help.title',
        descriptionKey: 'tenorSearch.items.help.desc'
      },
      {
        icon: 'privacy_tip',
        titleKey: 'tenorSearch.items.privacy.title',
        descriptionKey: 'tenorSearch.items.privacy.desc'
      }
    ]
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
