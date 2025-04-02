import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { TenorService } from '../../../services/tenor.service';
import { EditMessageComponent } from '../../editmessage/edit-message.component';

@Component({
  selector: 'app-multimedia',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './tenor.component.html',
  styleUrl: './tenor.component.css'
})
export class TenorComponent {
  public searchterm: string = '';
  public lastSearchterm: string = '';
  public nextFeatured: string = '';
  public nextSearch: string = '';
  public results: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<EditMessageComponent>,
    private tensorService: TenorService,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  ngOnInit(): void {
    this.tensorGetFeaturedGifs();
  }

  tensorGetFeaturedGifs(): void {
    this.tensorService.getFeaturedGifs(this.nextFeatured).subscribe({
      next: tensorResponse => {
        this.results = [];
        this.results.push(...tensorResponse.results);
        this.nextFeatured = tensorResponse.next;
        this.nextSearch = '';
      },
      error: (err) => { },
      complete: () => { }
    });
  }

  tensorSearchGifs(): void {
    this.tensorService.searchGifs(this.searchterm, this.nextSearch).subscribe({
      next: tensorResponse => {
        this.results = [];
        this.results.push(...tensorResponse.results);
        this.nextSearch = tensorResponse.next;
        this.nextFeatured = '';
      },
      error: (err) => {
        console.log(err);
      },
      complete: () => { }
    });
  }

  search(): void {
    if (this.searchterm === '') {
      this.tensorGetFeaturedGifs();
    } else {
      if (this.searchterm !== this.lastSearchterm) {
        this.lastSearchterm = this.searchterm;
        this.nextSearch = '';
      }
      this.tensorSearchGifs();
    }
  }

  onApplyClick(result: any): void {
    let multimedia: Multimedia = {
      type: MultimediaType.TENOR,
      url: result.media_formats.gif.url,
      sourceUrl: result.itemurl,
      attribution: 'Powered by Tenor',
      title: result.title,
      description: result.content_description,
      videoId: ''
    };
    this.dialogRef.close(multimedia);
  }

}
