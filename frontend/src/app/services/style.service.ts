import { Injectable } from '@angular/core';

export interface FontOption {
  readonly id: number;
  readonly family: string;
  readonly label: string;
}

const FONT_FAMILIES = [
  'DancingScript',
  'Pacifico',
  'Caveat',
  'HachiMaruPop',
  'Miniver',
  'CraftyGirls',
  'SedgwickAveDisplay',
  'OvertheRainbow',
  'LoveYaLikeASister',
  'SedgwickAve',
  'MrDafoe',
  'GochiHand',
  'RockSalt',
  'GloriaHallelujah',
  'KaushanScript',
  'LuckiestGuy',
  'Zeyada',
  'Kalam',
  'Yellowtail',
  'IndieFlower',
  'PermanentMarker',
  'Satisfy',
  'ShadowsIntoLight',
  'AbrilFatface',
  'Almendra',
  'AmaticSC',
  'Anton',
  'Audiowide',
  'Bangers',
  'BebasNeue',
  'BlackOpsOne',
  'BriemHand',
  'BungeeShade',
  'BungeeSpice',
  'Cinzel',
  'Creepster',
  'FjallaOne',
  'FrederickatheGreat',
  'Jaro',
  'Jersey10',
  'Jersey15',
  'Jersey25',
  'JosefinSans',
  'Knewave',
  'Lemon',
  'LilitaOne',
  'MadimiOne',
  'Micro5Charted',
  'Micro5',
  'Monoton',
  'Montserrat',
  'Nosifer',
  'Orbitron',
  'Oswald',
  'PlayfairDisplay',
  'PoetsenOne',
  'RubikMonoOne',
  'RubikMoonrocks',
  'RubikScribble',
  'SedanSC',
  'Sixtyfour',
  'SpecialElite',
  'UbuntuSansMono',
  'Allura',
  'Cookie'
] as const;

@Injectable({
  providedIn: 'root'
})
export class StyleService {
  private readonly fonts: readonly FontOption[] = FONT_FAMILIES.map((family, index) => ({
    id: index + 1,
    family,
    label: this.formatFontLabel(family)
  }));

  getFonts(): readonly FontOption[] {
    return this.fonts;
  }

  getFontFamilyStyle(font: FontOption | string): string {
    const family = typeof font === 'string' ? font : font.family;
    return `font-family: "${family}";`;
  }

  getStyleForFont(font: FontOption | string): string {
    return `${this.getFontFamilyStyle(font)} font-size: 1.75rem;`;
  }

  getFontFamilyFromStyle(style: string | undefined | null): string | null {
    if (!style) {
      return null;
    }
    const match = /font-family\s*:\s*["']?([^"';]+)["']?/i.exec(style);
    return match?.[1]?.trim() || null;
  }

  getRandomFontFamily(): string {
    const font = this.fonts[this.getRandomNumber(0, this.fonts.length - 1)];
    return this.getFontFamilyStyle(font);
  }

  getRandomStyle(): string {
    const font = this.fonts[this.getRandomNumber(0, this.fonts.length - 1)];
    return this.getStyleForFont(font);
  }

  private getRandomNumber(from: number, to: number): number {
    return Math.floor(Math.random() * (to - from + 1)) + from;
  }

  private formatFontLabel(family: string): string {
    return family
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/([0-9])([A-Z])/g, '$1 $2')
      .trim();
  }
}
