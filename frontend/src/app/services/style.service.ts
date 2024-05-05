import { Injectable } from '@angular/core';
import { colord, random } from "colord";
import { Animation } from '../interfaces/animation';

@Injectable({
  providedIn: 'root'
})
export class StyleService {

  constructor() { }

  private getRandomNumber(from: number, to: number): number {
    return Math.floor(Math.random() * (to + 1)) + from;
  }

  private getGradiantColorAnimation(): Animation {
    let animation: Animation = {
      'cssclass' : 'gradientAnimation',
      'style': `
      background-color: ${random().toHex()};
      background-image: linear-gradient(${this.getRandomNumber(0, 365)}deg, ${random().toHex()}, ${random().toHex()}, ${random().toHex()}, ${random().toHex()});
      background-size: 400% 400%;
      animation-duration: ${this.getRandomNumber(5, 15)}s;
      animation-iteration-count: infinite;
      animation-timing-function: ease;`
    };
    return animation;
  }

  private getRadialColorAnimation(): Animation {
    let animation: Animation = {
      'cssclass' : 'radialAnimation',
      'style': `
      background-color: ${random().toHex()};
      background-image: radial-gradient(ellipse farthest-corner at ${this.getRandomNumber(25, 75)}% ${this.getRandomNumber(25, 75)}%, ${random().toHex()} 0%, ${random().toHex()} 8%, ${random().toHex()} 25%, ${random().toHex()} 62.5%, ${random().toHex()} 100%);
      background-size: 400% 400%;
      animation-duration: ${this.getRandomNumber(5, 15)}s;
      animation-iteration-count: infinite;
      animation-timing-function: ease;`
    };
    return animation;
  }
  

  private getConicColorAnimation(): Animation {
    let animation: Animation = {
      'cssclass' : 'conicAnimation',
      'style': `
      background-color: ${random().toHex()};
      background-image: conic-gradient(at ${this.getRandomNumber(25, 75)}% ${this.getRandomNumber(25, 75)}%, ${random().toHex()}, ${random().toHex()}, ${random().toHex()}, ${random().toHex()}, ${random().toHex()});
      background-size: 400% 400%;
      animation-duration: ${this.getRandomNumber(5, 15)}s;
      animation-iteration-count: infinite;
      animation-timing-function: ease;`
    };
    return animation;
  }

  getRandomColorAnimation(): Animation {
    switch (this.getRandomNumber(1, 3)) {
      case 1: return this.getRadialColorAnimation();
      case 2: return this.getGradiantColorAnimation();
      case 3: return this.getConicColorAnimation();
      default: return this.getRadialColorAnimation();
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
