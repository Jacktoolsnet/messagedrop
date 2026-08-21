import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { MinefieldBoardComponent } from '../minefield-board/minefield-board.component';

@Component({selector:'app-new-minefield-dialog',standalone:true,
 imports:[DialogHeaderComponent,MinefieldBoardComponent,MatDialogContent,MatDialogActions,MatButtonModule,MatIconModule,TranslocoPipe],
 templateUrl:'./new-minefield-dialog.component.html',styleUrl:'./new-minefield-dialog.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class NewMinefieldDialogComponent{
 private readonly dialogRef=inject(MatDialogRef<NewMinefieldDialogComponent,number>);
 readonly firstCell=signal<number|null>(null);
 selectCell(index:number):void{this.firstCell.set(index)}
 send():void{const cell=this.firstCell();if(cell!==null)this.dialogRef.close(cell)}
 close():void{this.dialogRef.close()}
}
