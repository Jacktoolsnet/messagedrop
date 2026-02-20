import { computed, inject, Injectable, signal } from '@angular/core';
import { ContactService } from './contact.service';
import { ExperienceBookmarkService } from './experience-bookmark.service';
import { MessageService } from './message.service';
import { NoteService } from './note.service';
import { PlaceService } from './place.service';
import { UserService } from './user.service';
import { normalizeHashtagToken } from '../utils/hashtag.util';

interface HashtagSuggestionOptions {
  limit?: number;
  exclude?: string[];
}

const HASHTAG_HISTORY_STORAGE_KEY = 'messagedrop.hashtag-history.v1';
const MAX_REMEMBERED_HASHTAGS = 500;

@Injectable({
  providedIn: 'root'
})
export class HashtagSuggestionService {
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly noteService = inject(NoteService);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);
  private readonly rememberedHashtagsSignal = signal<string[]>(this.loadRememberedHashtags());

  private readonly hashtagStats = computed(() => {
    this.userService.userSet();

    const stats = new Map<string, number>();
    const currentUserId = this.userService.getUser().id;

    const add = (tags: string[] | undefined): void => {
      if (!Array.isArray(tags)) {
        return;
      }
      tags.forEach((tag) => {
        const normalized = normalizeHashtagToken(tag);
        if (!normalized) {
          return;
        }
        stats.set(normalized, (stats.get(normalized) ?? 0) + 1);
      });
    };

    this.placeService.sortedPlacesSignal().forEach((place) => add(place.hashtags));
    this.contactService.sortedContactsSignal().forEach((contact) => add(contact.hashtags));
    this.noteService.getNotesSignal()().forEach((note) => add(note.hashtags));
    this.bookmarkService.bookmarksSignal().forEach((bookmark) => add(bookmark.hashtags));

    this.messageService.messagesSignal()
      .filter((message) => !!currentUserId && message.userId === currentUserId)
      .forEach((message) => add(message.hashtags));

    add(this.rememberedHashtagsSignal());

    return stats;
  });

  private readonly sortedHashtags = computed(() =>
    Array.from(this.hashtagStats().entries())
      .sort((a, b) => {
        const byCount = b[1] - a[1];
        if (byCount !== 0) {
          return byCount;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([tag]) => tag)
  );

  suggest(input: string, options?: HashtagSuggestionOptions): string[] {
    const limit = this.normalizeLimit(options?.limit);
    const prefix = this.normalizePrefix(input);
    const excludeSet = this.normalizeExclude(options?.exclude);
    const all = this.sortedHashtags();

    const filtered = prefix
      ? all.filter((tag) => tag.startsWith(prefix))
      : all;

    return filtered
      .filter((tag) => !excludeSet.has(tag))
      .slice(0, limit);
  }

  remember(tags: string[] | undefined): void {
    const normalized = this.normalizeHashtags(tags);
    if (normalized.length === 0) {
      return;
    }
    const current = new Set(this.rememberedHashtagsSignal());
    let changed = false;
    normalized.forEach((tag) => {
      if (current.has(tag)) {
        return;
      }
      current.add(tag);
      changed = true;
    });
    if (!changed) {
      return;
    }
    const next = Array.from(current.values()).slice(0, MAX_REMEMBERED_HASHTAGS);
    this.rememberedHashtagsSignal.set(next);
    this.persistRememberedHashtags(next);
  }

  private normalizeLimit(limit: number | undefined): number {
    if (!Number.isFinite(limit)) {
      return 12;
    }
    return Math.max(1, Math.floor(limit as number));
  }

  private normalizePrefix(value: string): string {
    return String(value ?? '')
      .trim()
      .replace(/^#+/, '')
      .normalize('NFKC')
      .toLowerCase();
  }

  private normalizeExclude(values: string[] | undefined): Set<string> {
    const result = new Set<string>();
    (values ?? []).forEach((value) => {
      const normalized = normalizeHashtagToken(value);
      if (normalized) {
        result.add(normalized);
      }
    });
    return result;
  }

  private normalizeHashtags(tags: string[] | undefined): string[] {
    const normalized = new Set<string>();
    (tags ?? []).forEach((tag) => {
      const next = normalizeHashtagToken(tag);
      if (next) {
        normalized.add(next);
      }
    });
    return Array.from(normalized.values());
  }

  private loadRememberedHashtags(): string[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const raw = localStorage.getItem(HASHTAG_HISTORY_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return this.normalizeHashtags(parsed.map((entry) => String(entry)));
    } catch {
      return [];
    }
  }

  private persistRememberedHashtags(tags: string[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(HASHTAG_HISTORY_STORAGE_KEY, JSON.stringify(tags));
    } catch {
      // ignore storage issues (private mode/quota)
    }
  }
}
