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
    switch (this.getRandomNumber(1, 65)) {
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
      case 24: return `font-family: "AbrilFatface";`;
      case 25: return `font-family: "Almendra";`;
      case 26: return `font-family: "AmaticSC";`;
      case 27: return `font-family: "Anton";`;
      case 28: return `font-family: "Audiowide";`;
      case 29: return `font-family: "Bangers";`;
      case 30: return `font-family: "BebasNeue";`;
      case 31: return `font-family: "BlackOpsOne";`;
      case 32: return `font-family: "BriemHand";`;
      case 33: return `font-family: "BungeeShade";`;
      case 34: return `font-family: "BungeeSpice";`;
      case 35: return `font-family: "Cinzel";`;
      case 36: return `font-family: "Creepster";`;
      case 37: return `font-family: "FjallaOne";`;
      case 38: return `font-family: "FrederickatheGreat";`;
      case 39: return `font-family: "Jaro";`;
      case 40: return `font-family: "Jersey10";`;
      case 41: return `font-family: "Jersey15";`;
      case 42: return `font-family: "Jersey25";`;
      case 43: return `font-family: "JosefinSans";`;
      case 44: return `font-family: "Knewave";`;
      case 45: return `font-family: "Lemon";`;
      case 46: return `font-family: "LilitaOne";`;
      case 47: return `font-family: "MadimiOne";`;
      case 48: return `font-family: "Micro5Charted";`;
      case 49: return `font-family: "Micro5";`;
      case 50: return `font-family: "Monoton";`;
      case 51: return `font-family: "Montserrat";`;
      case 52: return `font-family: "Nosifer";`;
      case 53: return `font-family: "Orbitron";`;
      case 54: return `font-family: "Oswald";`;
      case 55: return `font-family: "PlayfairDisplay";`;
      case 56: return `font-family: "PoetsenOne";`;
      case 57: return `font-family: "RubikMonoOne";`;
      case 58: return `font-family: "RubikMoonrocks";`;
      case 59: return `font-family: "RubikScribble";`;
      case 60: return `font-family: "SedanSC";`;
      case 61: return `font-family: "Sixtyfour";`;
      case 62: return `font-family: "SpecialElite";`;
      case 63: return `font-family: "UbuntuSansMono";`;
      case 64: return `font-family: "Allura";`;
      case 65: return `font-family: "Cookie";`;
      default: return `font-family: "LuckiestGuy";`;
    }
  }

}
