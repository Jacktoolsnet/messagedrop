import { Injectable } from '@angular/core';
import { Note } from '../interfaces/note';
import { User } from '../interfaces/user';

@Injectable({
  providedIn: 'root'
})
export class NoteService {

  private notes: Note[] = [];

  constructor() { }

  getNotes(): Note[] {
    return this.notes
  }

  addNote(note: Note) {
    this.notes.unshift(note);
  }

  filter(plusCode: string): Note[] {
    this.notes = JSON.parse(localStorage.getItem('notes') || '[]');
    this.notes = this.notes.filter((note) => note.plusCode.startsWith(plusCode));
    return this.notes;
  }

  loadNotes(): Note[] {
    this.notes = JSON.parse(localStorage.getItem('notes') || '[]');
    return this.notes;
  }

  saveNotes() {
    localStorage.setItem('notes', JSON.stringify(this.notes))
  }

  deleteNotesFromStorage() {
    localStorage.removeItem('notes');
  }

  navigateToNoteLocation(user: User, note: Note) {
    let url: string = `https://www.google.com/maps/dir/${encodeURIComponent(user.location.plusCode)}/${encodeURIComponent(note.plusCode)}`
    window.open(url, '_blank');
  }
}
