import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AsteroidDuelAction } from '../../../interfaces/chat-game';
import { createAsteroidDuelPreview, createAsteroidField } from '../../../utils/asteroid-duel-game';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { AsteroidDuelBoardComponent } from '../asteroid-duel-board/asteroid-duel-board.component';

export interface NewAsteroidDuelDialogResult{asteroids:boolean[];action:AsteroidDuelAction}
@Component({selector:'app-new-asteroid-duel-dialog',standalone:true,imports:[DialogHeaderComponent,AsteroidDuelBoardComponent,MatDialogContent,MatDialogActions,MatButtonModule,MatIconModule,TranslocoPipe],templateUrl:'./new-asteroid-duel-dialog.component.html',styleUrl:'./new-asteroid-duel-dialog.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class NewAsteroidDuelDialogComponent{
  private readonly ref=inject(MatDialogRef<NewAsteroidDuelDialogComponent,NewAsteroidDuelDialogResult>);
  readonly asteroids=signal(createAsteroidField());
  readonly preview=computed(()=>createAsteroidDuelPreview('sender','recipient',this.asteroids()));
  select(action:AsteroidDuelAction):void{this.ref.close({asteroids:[...this.asteroids()],action})}
  shuffle():void{this.asteroids.set(createAsteroidField())}
  close():void{this.ref.close()}
}
