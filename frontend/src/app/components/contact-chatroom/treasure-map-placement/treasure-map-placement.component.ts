import{ChangeDetectionStrategy,Component,inject,output,signal}from'@angular/core';import{TreasureIslandItem}from'../../../interfaces/chat-game';import{GameFeedbackService}from'../../../services/game-feedback.service';import{getPrisonerSymbol,getTreasureSymbol,randomTreasureLayout,TREASURE_INVENTORY,validTreasureLayout}from'../../../utils/treasure-map-game';
@Component({selector:'app-treasure-map-placement',standalone:true,templateUrl:'./treasure-map-placement.component.html',styleUrl:'./treasure-map-placement.component.css',changeDetection:ChangeDetectionStrategy.OnPush})
export class TreasureMapPlacementComponent{
 readonly feedback=inject(GameFeedbackService);readonly layoutChange=output<(TreasureIslandItem|null)[]>();readonly layout=signal<(TreasureIslandItem|null)[]>(Array(49).fill(null));readonly selected=signal<TreasureIslandItem>('treasure');readonly cells=Array.from({length:49},(_,i)=>i);readonly items=Object.keys(TREASURE_INVENTORY)as TreasureIslandItem[];readonly treasureSymbol=getTreasureSymbol();readonly prisonerSymbol=getPrisonerSymbol();
 symbol(item:TreasureIslandItem){return({treasure:this.treasureSymbol,bomb:'💣',prisoner:this.prisonerSymbol,wine:'🍷',bride:'👑',map:'🗺',compass:'🧭'}as const)[item]}
 remaining(item:TreasureIslandItem){return TREASURE_INVENTORY[item]-this.layout().filter(value=>value===item).length}
 select(item:TreasureIslandItem){if(this.remaining(item)<=0)return;this.feedback.notifySelection();this.selected.set(item)}
 place(index:number){const next=[...this.layout()],current=next[index];if(current){next[index]=null;this.selected.set(current)}else{const item=this.selected();if(this.remaining(item)<=0)return;next[index]=item}this.feedback.notifySelection();this.layout.set(next);this.layoutChange.emit(next);const selected=this.selected();if(this.remaining(selected)<=0){const available=this.items.find(item=>this.remaining(item)>0);if(available)this.selected.set(available)}}
 randomize(){const next=randomTreasureLayout();this.layout.set(next);this.layoutChange.emit(next);this.feedback.notifySelection()}
 complete(){return validTreasureLayout(this.layout())}
}
