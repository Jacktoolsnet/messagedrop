import {WordRescueAction,WordRescueGame,WordRescueTheme} from '../interfaces/chat-game';

export const WORD_RESCUE_ALPHABET=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜẞ'] as const;

export function normalizeWordRescueText(value:string):string{
  return value.trim().replace(/\s+/g,' ').toLocaleUpperCase('de-DE');
}

export function isValidWordRescueSolution(value:string):boolean{
  const word=normalizeWordRescueText(value);
  return word.length>=2&&word.length<=32&&/^[A-ZÄÖÜẞ -]+$/u.test(word)&&/[A-ZÄÖÜẞ]/u.test(word);
}

export function createWordRescueGame(creatorUserId:string,guesserUserId:string,solution:string,hint='',rescueTheme:WordRescueTheme='bridge'):WordRescueGame{
  if(!creatorUserId||!guesserUserId||creatorUserId===guesserUserId||!isValidWordRescueSolution(solution))throw new Error('invalid_word_rescue');
  return{type:'wordRescue',version:1,gameId:crypto.randomUUID(),creatorUserId,guesserUserId,
    solution:normalizeWordRescueText(solution),hint:hint.trim().slice(0,120),rescueTheme,
    guessedLetters:[],wrongLetters:[],wrongWordAttempts:[],wrongCount:0,maxWrong:8,
    nextPlayerUserId:guesserUserId,status:'active',winnerUserId:null,moveNumber:0};
}

export function applyWordRescueAction(game:WordRescueGame,userId:string,action:WordRescueAction):WordRescueGame|null{
  if(game.status!=='active'||game.nextPlayerUserId!==userId||userId!==game.guesserUserId)return null;
  let guessed=[...game.guessedLetters],wrongLetters=[...game.wrongLetters],wrongWords=[...game.wrongWordAttempts],wrong=game.wrongCount;
  if(action.type==='letter'){
    const letter=normalizeWordRescueText(action.letter);
    if(!/^[A-ZÄÖÜẞ]$/u.test(letter)||guessed.includes(letter)||wrongLetters.includes(letter))return null;
    if(game.solution.includes(letter))guessed.push(letter);else{wrongLetters.push(letter);wrong++;}
  }else{
    const word=normalizeWordRescueText(action.word);
    if(!isValidWordRescueSolution(word)||wrongWords.includes(word))return null;
    if(word===game.solution){guessed=[...new Set([...guessed,...lettersIn(game.solution)])];}
    else{wrongWords.push(word);wrong=Math.min(game.maxWrong,wrong+2);}
  }
  const solved=lettersIn(game.solution).every(letter=>guessed.includes(letter));
  const lost=!solved&&wrong>=game.maxWrong;
  return{...game,guessedLetters:guessed,wrongLetters,wrongWordAttempts:wrongWords,wrongCount:Math.min(game.maxWrong,wrong),
    nextPlayerUserId:solved||lost?null:game.guesserUserId,status:solved||lost?'won':'active',
    winnerUserId:solved?game.guesserUserId:lost?game.creatorUserId:null,moveNumber:game.moveNumber+1};
}

export function visibleWordRescueCharacters(game:WordRescueGame):string[]{
  const reveal=game.status!=='active';
  return[...game.solution].map(char=>char===' '||char==='-'?char:reveal||game.guessedLetters.includes(char)?char:'');
}

function lettersIn(word:string):string[]{return[...new Set([...word].filter(char=>/[A-ZÄÖÜẞ]/u.test(char)))];}
