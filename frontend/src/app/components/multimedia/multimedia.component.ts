import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { User } from '../../interfaces/user';
import { MessageService } from '../../services/message.service';
import { StyleService } from '../../services/style.service';
import { TenorService } from '../../services/tenor.service';
import { MessageComponent } from '../message/message.component';

@Component({
  selector: 'app-multimedia',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule
  ],
  templateUrl: './multimedia.component.html',
  styleUrl: './multimedia.component.css'
})
export class MultimediaComponent {
  public searchTermTenor: string = '';
  private next: string = '';
  public tensorResults: any[] = [];

  constructor(
    private snackBar: MatSnackBar,
    private messageService: MessageService,
    public dialogRef: MatDialogRef<MessageComponent>,
    private style: StyleService,
    private waitDialog: MatDialog,
    private tensorService: TenorService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, message: Message }
  ) { }

  ngOnInit(): void {
    this.data.message.style = this.data.user.defaultStyle;
    this.tensorGetFeatured();
  }

  tensorGetFeatured(): void {
    this.tensorService.getFeatured(this.next).subscribe({
      next: tensorResponse => {
        console.log(tensorResponse);
        this.tensorResults.push(...tensorResponse.results);
        this.next = tensorResponse.next;
      },
      error: (err) => {
        console.log(err);
      },
      complete: () => { }
    });
  }

  searchTenor(): void {
    this.tensorGetFeatured();
  }

  onApplyClick(): void {
    this.data.message.userId = this.data.user.id;
    this.dialogRef.close(this.data);
  }

  public showPolicy() {
    this.snackBar.open(`This information is stored on our server and is visible to everyone.`, 'OK', {});
  }
}
