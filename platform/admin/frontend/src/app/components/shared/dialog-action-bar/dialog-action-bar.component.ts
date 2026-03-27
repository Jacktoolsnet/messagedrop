import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { MatDialogActions } from '@angular/material/dialog';

type DialogActionAlignment = 'start' | 'center' | 'end';

@Component({
  selector: 'app-dialog-action-bar',
  standalone: true,
  imports: [MatDialogActions],
  templateUrl: './dialog-action-bar.component.html',
  styleUrl: './dialog-action-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class DialogActionBarComponent {
  readonly align = input<DialogActionAlignment>('end');
  readonly sticky = input(true);
}
