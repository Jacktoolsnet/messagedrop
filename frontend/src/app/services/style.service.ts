import { Injectable } from '@angular/core';
import { colord, random } from "colord";

@Injectable({
  providedIn: 'root'
})
export class StyleService {

  constructor() { }

  getRandomNumber(from: number, to: number): number {
    return Math.floor(Math.random() * (to + 1)) + from;
  }

  getRandomFontFamily(): string {
    switch (this.getRandomNumber(1, 10)) {
      case 1: return `font-family: "DancingScript";`;
      case 2: return `font-family: "Pacifico";`;
      case 3: return `font-family: "Caveat";`;
      case 4: return `font-family: "HachiMaruPop";`;
      case 5: return `font-family: "Miniver";`;
      case 6: return `font-family: "CraftyGirls";`;
      case 7: return `font-family: "SedgwickAveDisplay";`;
      case 8: return `font-family: "OvertheRainbow";`;
      case 9: return `font-family: "LoveYaLikeASister";`;
      case 10: return `font-family: "SedgwickAve";`;
      case 11: return `font-family: "MrDafoe";`;
      case 12: return `font-family: "GochiHand";`;
      case 13: return `font-family: "RockSalt";`;
      case 14: return `font-family: "GloriaHallelujah";`;
      case 15: return `font-family: "KaushanScript";`;
      case 16: return `font-family: "LuckiestGuy";`;
      case 17: return `font-family: "Zeyada";`;
      case 18: return `font-family: "Kalam";`;
      case 19: return `font-family: "Yellowtail";`;
      case 20: return `font-family: "IndieFlower";`;
      case 21: return `font-family: "PermanentMarker";`;
      case 22: return `font-family: "Satisfy";`;
      case 23: return `font-family: "ShadowsIntoLight";`;
      default: return `font-family: "LuckiestGuy";`;
    }
  }

  getRandomFontSize(): string {
    switch (this.getRandomNumber(1, 5)) {
      case 1: return `font-size: 1rem;`;
      case 2: return `font-size: 1.25rem;`;
      case 3: return `font-size: 1.5rem;`;
      case 4: return `font-size: 1.75rem;`;
      case 5: return `font-size: 2rem;`;
      default: return `font-size: 1.5rem;`;
    }
  }

  getRandomColorCombination(): string {
    let beackGroundColor: string = random().toHex();
    let color: string = colord(beackGroundColor).invert().toHex();
    return `background-color: ${beackGroundColor}; color: ${color};`;
  }

  getRandomBorder(): string {
    let borderSize: string = '1rem';
    switch (this.getRandomNumber(1, 5)) {
      case 1:
         borderSize = `1rem`;
         break;
      case 2:
        borderSize = `1.25rem`;
        break;
      case 3:
        borderSize = `1.5rem`;
        break;
      case 4:
        borderSize = `1.75rem`;
        break;
      case 5:
        borderSize = `2rem`;
        break;  
    }
    let borderStyle: string = 'solid';
    switch (this.getRandomNumber(1, 8)) {
      case 1:
        borderStyle = `dotted`;
         break;
      case 2:
        borderStyle = `dashed`;
        break;
      case 3:
        borderStyle = `solid`;
        break;
      case 4:
        borderStyle = `double`;
        break;
      case 5:
        borderStyle = `groove`;
        break;
      case 6:
        borderStyle = `ridge`;
        break;
      case 7:
        borderStyle = `inset`;
        break;
      case 8:
        borderStyle = `outset`;
        break;  
    }
    return `border: ${borderSize} ${borderStyle} ${random().toHex()};`;
  }

}
