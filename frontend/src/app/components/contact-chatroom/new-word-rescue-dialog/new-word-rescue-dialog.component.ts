import{ChangeDetectionStrategy,Component,inject,signal}from'@angular/core';
import{FormsModule}from'@angular/forms';
import{MatButtonModule}from'@angular/material/button';
import{MatDialogActions,MatDialogContent,MatDialogRef}from'@angular/material/dialog';
import{MatFormFieldModule}from'@angular/material/form-field';
import{MatIconModule}from'@angular/material/icon';
import{MatInputModule}from'@angular/material/input';
import{TranslocoPipe}from'@jsverse/transloco';
import{isValidWordRescueSolution,normalizeWordRescueText}from'../../../utils/word-rescue-game';
import{DialogHeaderComponent}from'../../utils/dialog-header/dialog-header.component';
export interface NewWordRescueDialogResult{solution:string;hint:string}
@Component({selector:'app-new-word-rescue-dialog',standalone:true,imports:[DialogHeaderComponent,FormsModule,MatButtonModule,MatDialogActions,MatDialogContent,MatFormFieldModule,MatIconModule,MatInputModule,TranslocoPipe],templateUrl:'./new-word-rescue-dialog.component.html',styleUrl:'./new-word-rescue-dialog.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class NewWordRescueDialogComponent{
 private readonly ref=inject(MatDialogRef<NewWordRescueDialogComponent,NewWordRescueDialogResult>);
 readonly solution=signal('');readonly hint=signal('');
 valid(){return isValidWordRescueSolution(this.solution())}
 close(){this.ref.close()}
 submit(){if(!this.valid())return;this.ref.close({solution:normalizeWordRescueText(this.solution()),hint:this.hint().trim()})}
}
