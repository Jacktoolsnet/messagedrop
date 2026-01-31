import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-dialog-header',
  standalone: true,
  imports: [MatDialogTitle, MatIconModule],
  templateUrl: './dialog-header.component.html',
  styleUrl: './dialog-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogHeaderComponent {
  @Input() icon = '';
  @Input() title = '';
  @Input() subtitle?: string;
}
