import{ChangeDetectionStrategy,Component,computed,inject,input,output,signal}from'@angular/core';
import{FormsModule}from'@angular/forms';
import{MatButtonModule}from'@angular/material/button';
import{MatIconModule}from'@angular/material/icon';
import{TranslocoPipe}from'@jsverse/transloco';
import{WordRescueAction,WordRescueGame}from'../../../interfaces/chat-game';
import{GameFeedbackService}from'../../../services/game-feedback.service';
import{normalizeWordRescueText,visibleWordRescueCharacters,WORD_RESCUE_ALPHABET}from'../../../utils/word-rescue-game';
@Component({selector:'app-word-rescue-board',standalone:true,imports:[FormsModule,MatButtonModule,MatIconModule,TranslocoPipe],templateUrl:'./word-rescue-board.component.html',styleUrl:'./word-rescue-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class WordRescueBoardComponent{
 readonly game=input<WordRescueGame|null>(null);readonly currentUserId=input('');readonly disabled=input(false);readonly action=output<WordRescueAction>();
 readonly alphabet=WORD_RESCUE_ALPHABET;readonly wordAttempt=signal('');readonly revealSecret=signal(false);readonly feedback=inject(GameFeedbackService);
 readonly isCreator=computed(()=>this.game()?.creatorUserId===this.currentUserId());readonly chars=computed(()=>{const g=this.game();return g?visibleWordRescueCharacters(g):[]});
 used(letter:string){const g=this.game();return !!g&&(g.guessedLetters.includes(letter)||g.wrongLetters.includes(letter))}
 correct(letter:string){return !!this.game()?.guessedLetters.includes(letter)}
 choose(letter:string){if(this.disabled()||this.used(letter))return;this.feedback.notifySelection();this.action.emit({type:'letter',letter})}
 submitWord(){const word=normalizeWordRescueText(this.wordAttempt());if(word.length<2||this.disabled())return;this.feedback.notifySelection();this.action.emit({type:'word',word});this.wordAttempt.set('')}
 showSolution(){const g=this.game();return !!g&&(g.status!=='active'||(this.isCreator()&&this.revealSecret()))}
 remaining(){const g=this.game();return g?g.maxWrong-g.wrongCount:0}
}
