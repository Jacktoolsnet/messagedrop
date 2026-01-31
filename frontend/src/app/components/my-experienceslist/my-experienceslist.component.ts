import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

@Component({
  selector: 'app-my-experienceslist',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './my-experienceslist.component.html',
  styleUrl: './my-experienceslist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyExperienceslistComponent {
  readonly help = inject(HelpDialogService);
}
