import { Injectable } from '@angular/core';

export interface PowChallenge {
  nonce: string;
  ts: number;
  ttl: number;
  difficulty: number;
  signature: string;
  scope?: string;
}

export interface PowSolution {
  solution: string;
  headerValue: string;
}

@Injectable({ providedIn: 'root' })
export class PowService {
  private readonly encoder = new TextEncoder();
  private readonly maxSolveMs = 4000;

  extractChallenge(err: unknown): PowChallenge | null {
    const anyErr = err as { status?: number; error?: { errorCode?: string; challenge?: PowChallenge } };
    if (anyErr?.status !== 428) return null;
    if (anyErr?.error?.errorCode !== 'POW_REQUIRED') return null;
    const challenge = anyErr?.error?.challenge;
    if (!challenge?.nonce || !challenge?.signature) return null;
    if (!Number.isFinite(challenge?.difficulty)) return null;
    return challenge;
  }

  buildHeader(challenge: PowChallenge, solution: string): string {
    return `${challenge.nonce}:${challenge.ts}:${challenge.ttl}:${challenge.difficulty}:${solution}:${challenge.signature}`;
  }

  async solve(challenge: PowChallenge): Promise<PowSolution> {
    if (!crypto?.subtle) {
      throw new Error('pow_unavailable');
    }
    const scope = challenge.scope || 'unknown';
    const start = Date.now();
    let counter = 0;

    while (Date.now() - start < this.maxSolveMs) {
      const text = `${challenge.nonce}.${counter}.${scope}`;
      const hash = await this.sha256(text);
      if (this.leadingZeroBits(hash) >= challenge.difficulty) {
        const solution = String(counter);
        return {
          solution,
          headerValue: this.buildHeader(challenge, solution)
        };
      }
      counter += 1;
      if (counter % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve));
      }
    }
    throw new Error('pow_timeout');
  }

  private async sha256(text: string): Promise<Uint8Array> {
    const data = this.encoder.encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(digest);
  }

  private leadingZeroBits(bytes: Uint8Array): number {
    let zeros = 0;
    for (const byte of bytes) {
      if (byte === 0) {
        zeros += 8;
        continue;
      }
      zeros += Math.clz32(byte) - 24;
      break;
    }
    return zeros;
  }
}
