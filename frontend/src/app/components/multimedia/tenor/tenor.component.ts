import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { TenorService } from '../../../services/tenor.service';
import { MessageComponent } from '../../message/message.component';

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
  templateUrl: './tenor.component.html',
  styleUrl: './tenor.component.css'
})
export class TenorComponent {
  public searchterm: string = '';
  private next: string = '';
  public results: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<MessageComponent>,
    private tensorService: TenorService,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  ngOnInit(): void {
    this.tensorGetFeatured();
  }

  tensorGetFeatured(): void {
    this.tensorService.getFeatured(this.next).subscribe({
      next: tensorResponse => {
        this.results = [];
        this.results.push(...tensorResponse.results);
        this.next = tensorResponse.next;
      },
      error: (err) => {
        console.log(err);
      },
      complete: () => { }
    });
  }

  search(): void {
    this.tensorGetFeatured();
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

}
