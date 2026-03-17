import { Injectable } from '@angular/core';

export interface ContentStyleOption {
  fontFamily: string;
  style: string;
}

const CONTENT_FONT_FAMILIES = [
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

const DEFAULT_FONT_SIZE = '1.75rem';

@Injectable({
  providedIn: 'root'
})
export class ContentStyleService {
  readonly styleOptions: readonly ContentStyleOption[] = CONTENT_FONT_FAMILIES.map((fontFamily) => ({
    fontFamily,
    style: this.buildStyle(fontFamily)
  }));

  getStyleOptions(): readonly ContentStyleOption[] {
    return this.styleOptions;
  }

  getRandomStyle(): string {
    const options = this.styleOptions;
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex]?.style ?? this.buildStyle('LuckiestGuy');
  }

  findOptionByStyle(style: string | null | undefined): ContentStyleOption | null {
    const normalized = this.normalizeStyle(style);
    if (!normalized) {
      return null;
    }
    return this.styleOptions.find((option) => option.style === normalized) ?? null;
  }

  normalizeStyle(style: string | null | undefined): string {
    const fontFamily = this.extractFontFamily(style);
    if (!fontFamily) {
      return '';
    }

    const matchingOption = this.styleOptions.find((option) => option.fontFamily === fontFamily);
    return matchingOption?.style ?? '';
  }

  private buildStyle(fontFamily: string): string {
    return `font-family: "${fontFamily}"; font-size: ${DEFAULT_FONT_SIZE};`;
  }

  private extractFontFamily(style: string | null | undefined): string | null {
    if (typeof style !== 'string' || !style.trim()) {
      return null;
    }

    const match = style.match(/font-family:\s*["']?([^;"']+)["']?/i);
    const fontFamily = match?.[1]?.trim();
    return fontFamily || null;
  }
}
