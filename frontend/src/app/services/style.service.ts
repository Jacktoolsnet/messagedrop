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

  getGradiantColorAnimation(): string {
    return `
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation-name: gradient;
    animation-duration: 15s;
    animation-iteration-count: infinite;
    animation-timing-function: ease;`;
  }

  getRandomColorAnimation(): string {
    switch (this.getRandomNumber(1, 10)) {
      default: return this.getGradiantColorAnimation();
    }
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

}
