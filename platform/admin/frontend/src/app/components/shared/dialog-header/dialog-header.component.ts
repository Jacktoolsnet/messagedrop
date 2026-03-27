import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dialog-header',
  standalone: true,
  imports: [MatDialogTitle, MatIconModule],
  templateUrl: './dialog-header.component.html',
  styleUrl: './dialog-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogHeaderComponent {
  readonly icon = input('');
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
