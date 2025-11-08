import { Injectable, inject, signal } from '@angular/core';
import { BoundingBox } from '../interfaces/bounding-box';
import { Note } from '../interfaces/note';
import { User } from '../interfaces/user';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class NoteService {
  private notesSignal = signal<Note[]>([]);

  private readonly indexedDbService = inject(IndexedDbService);

  /** Zugriff auf die Notes als Signal */
  getNotesSignal() {
    return this.notesSignal.asReadonly();
  }

  logout(): void {
    this.notesSignal.set([]);
  }

  async loadNotes(): Promise<Note[]> {
    const notes = await this.indexedDbService.getAllNotes();
    this.notesSignal.set(notes);
    return notes;
  }

  async addNote(note: Note): Promise<Note> {
    const id = await this.indexedDbService.saveNote(note);
    const newNote: Note = { ...note, id };
    this.notesSignal.update(notes => [newNote, ...notes]);
    return newNote;
  }

  async updateNote(note: Note): Promise<void> {
    await this.indexedDbService.updateNote(note);
    this.notesSignal.update(notes => notes.map(n => n.id === note.id ? note : n));
  }

  async deleteNote(note: Note): Promise<void> {
    await this.indexedDbService.deleteNote(note.id);
    this.notesSignal.update(notes => notes.filter(n => n.id !== note.id));
  }

  async filterByPlusCode(plusCode: string): Promise<Note[]> {
    const allNotes = await this.indexedDbService.getAllNotes();
    const filteredNotes = allNotes.filter(note => note.location.plusCode.startsWith(plusCode));
    this.notesSignal.set(filteredNotes);
    return filteredNotes;
  }

  async getNotesInBoundingBox(boundingBox: BoundingBox): Promise<Note[]> {
    const notes = await this.indexedDbService.getNotesInBoundingBox(boundingBox);
    this.notesSignal.set(notes);
    return notes;
  }

  navigateToNoteLocation(user: User, note: Note): void {
    const url = `https://www.google.com/maps/dir/${encodeURIComponent(user.location.plusCode)}/${encodeURIComponent(note.location.plusCode)}`;
    window.open(url, '_blank');
  }
}
