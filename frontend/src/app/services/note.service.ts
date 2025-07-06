import { Injectable } from '@angular/core';
import { BoundingBox } from '../interfaces/bounding-box';
import { Note } from '../interfaces/note';
import { User } from '../interfaces/user';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private notes: Note[] = [];

  constructor(private indexedDbService: IndexedDbService) { }

  logout(): void {
    this.notes = [];
  }

  getNotes(): Note[] {
    return this.notes;
  }

  async loadNotes(): Promise<Note[]> {
    this.notes = [];
    this.notes = await this.indexedDbService.getAllNotes();
    return this.notes;
  }

  async addNote(note: Note): Promise<Note> {
    const noteWithId: Note = { ...note, id: await this.indexedDbService.saveNote(note) };
    this.notes.unshift(noteWithId);
    return noteWithId;
  }

  async updateNote(note: Note): Promise<void> {
    await this.indexedDbService.updateNote(note);
    const index = this.notes.findIndex(n => n.id === note.id);
    if (index !== -1) {
      this.notes[index] = note;
    }
  }

  async deleteNote(note: Note): Promise<void> {
    await this.indexedDbService.deleteNote(note.id);
    this.notes = this.notes.filter(note => note.id !== note.id);
  }

  async filterByPlusCode(plusCode: string): Promise<Note[]> {
    const allNotes = await this.indexedDbService.getAllNotes();
    this.notes = allNotes.filter(note => note.location.plusCode.startsWith(plusCode));
    return this.notes;
  }

  async getNotesInBoundingBox(bbox: BoundingBox): Promise<Note[]> {
    this.notes = await this.indexedDbService.getNotesInBoundingBox(bbox);
    return this.notes;
  }

  navigateToNoteLocation(user: User, note: Note): void {
    const url = `https://www.google.com/maps/dir/${encodeURIComponent(user.location.plusCode)}/${encodeURIComponent(note.location.plusCode)}`;
    window.open(url, '_blank');
  }
}