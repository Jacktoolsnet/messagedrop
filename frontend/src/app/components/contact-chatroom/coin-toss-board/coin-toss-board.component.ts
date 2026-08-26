import{ChangeDetectionStrategy,Component,effect,inject,input,output,signal}from'@angular/core';import{MatButtonModule}from'@angular/material/button';import{MatIconModule}from'@angular/material/icon';import{TranslocoPipe}from'@jsverse/transloco';import{CoinTossGame}from'../../../interfaces/chat-game';import{GameFeedbackService}from'../../../services/game-feedback.service';
@Component({selector:'app-coin-toss-board',standalone:true,imports:[MatButtonModule,MatIconModule,TranslocoPipe],templateUrl:'./coin-toss-board.component.html',styleUrl:'./coin-toss-board.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class CoinTossBoardComponent{
 readonly game=input<CoinTossGame|null>(null);readonly currentUserId=input('');readonly disabled=input(false);readonly deleted=input(false);readonly toss=output<void>();readonly animating=signal(false);private readonly feedback=inject(GameFeedbackService);
 constructor(){effect(onCleanup=>{const g=this.game(),user=this.currentUserId(),deleted=this.deleted();if(deleted||!g?.result||!user)return;const key=`coin-toss-animation:${user}:${g.gameId}:${g.moveNumber}`;if(this.wasSeen(key))return;this.animating.set(true);const finish=setTimeout(()=>{this.animating.set(false);this.markSeen(key);this.feedback.notifyCoinLanding()},1900);onCleanup(()=>clearTimeout(finish))})}
 flip(){if(this.disabled())return;this.feedback.notifyCoinToss();this.toss.emit()}
 private wasSeen(key:string){try{return sessionStorage.getItem(key)==='1'}catch{return false}}
 private markSeen(key:string){try{sessionStorage.setItem(key,'1')}catch{/* storage can be unavailable */}}
}
