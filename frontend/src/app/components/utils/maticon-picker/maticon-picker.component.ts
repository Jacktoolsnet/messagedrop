
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';

interface IconCategory {
  nameKey: string;
  icons: string[];
}

@Component({
  selector: 'app-maticon-picker',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatTabsModule, TranslocoPipe],
  templateUrl: './maticon-picker.component.html',
  styleUrl: './maticon-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaticonPickerComponent {
  readonly iconCategories: IconCategory[] = [
    {
      nameKey: 'common.iconPicker.categories.basics',
      icons: [
        'home', 'house', 'apartment', 'dashboard', 'widgets', 'favorite', 'star', 'thumb_up', 'thumb_down',
        'search', 'settings', 'info', 'help', 'lock', 'lock_open', 'visibility', 'visibility_off', 'warning',
        'delete', 'edit', 'add', 'remove', 'close', 'check', 'done', 'refresh', 'menu', 'more_vert', 'more_horiz'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.placesMap',
      icons: [
        'place', 'map', 'navigation', 'location_on', 'my_location', 'directions', 'pin_drop', 'explore',
        'public', 'flag', 'terrain', 'home_pin', 'restaurant', 'local_cafe', 'local_hospital', 'local_florist',
        'park', 'hotel', 'beach_access', 'directions_walk', 'hiking', 'tram', 'train', 'airport_shuttle'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.weatherNature',
      icons: [
        'sunny', 'cloud', 'cloud_queue', 'cloud_sync', 'water_drop', 'thunderstorm', 'ac_unit', 'thermostat',
        'forest', 'eco', 'compost', 'local_florist', 'hive', 'tsunami', 'flood'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.communication',
      icons: [
        'chat', 'forum', 'sms', 'alternate_email', 'mail', 'inbox', 'call', 'call_end', 'contacts', 'share',
        'send', 'mark_email_unread', 'notifications', 'notifications_active', 'support_agent', 'link'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.media',
      icons: [
        'photo', 'image', 'collections', 'camera_alt', 'video_call', 'videocam', 'music_note', 'mic', 'audiotrack',
        'play_arrow', 'pause', 'stop', 'skip_next', 'skip_previous', 'library_music'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.contentFiles',
      icons: [
        'article', 'description', 'folder', 'folder_open', 'upload_file', 'download', 'cloud_upload', 'cloud_download',
        'attach_file', 'insert_drive_file', 'inventory_2', 'table_chart', 'list', 'grid_view'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.statusActions',
      icons: [
        'check_circle', 'cancel', 'error', 'pending', 'schedule', 'timer', 'timer_off', 'sync', 'autorenew',
        'bolt', 'power_settings_new', 'battery_full', 'battery_charging_full', 'wifi', 'signal_cellular_alt'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.travelTransport',
      icons: [
        'directions_car', 'electric_car', 'two_wheeler', 'pedal_bike', 'sailing', 'directions_boat',
        'flight', 'local_taxi', 'directions_bus', 'train', 'tram', 'subway', 'local_shipping'
      ]
    },
    {
      nameKey: 'common.iconPicker.categories.homeLifestyle',
      icons: [
        'weekend', 'chair', 'bed', 'kitchen', 'countertops', 'garden_cart', 'lightbulb', 'coffee',
        'pets', 'sports_soccer', 'sports_basketball', 'sports_esports', 'fitness_center'
      ]
    }
  ];

  readonly dialogRef = inject(MatDialogRef<MaticonPickerComponent, string | null>);
  readonly data = inject<{ current?: string | null }>(MAT_DIALOG_DATA);

  pick(icon: string | null): void {
    this.dialogRef.close(icon);
  }
}
