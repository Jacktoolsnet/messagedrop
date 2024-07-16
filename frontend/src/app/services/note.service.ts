import { Injectable } from '@angular/core';
import { Note } from '../interfaces/note';
import { User } from '../interfaces/user';

@Injectable({
  providedIn: 'root'
})
export class NoteService {

  constructor() { }

  loadNotesFromStorage(): Note[] {
    let notesFromLocalStorage: Note[] = JSON.parse(localStorage.getItem('notes') || '[]');
    return notesFromLocalStorage;
  }

  saveNotesToStorage(notes: Note[]) {    
    localStorage.setItem('notes', JSON.stringify(notes))
  }

  deleteNotesFromStorage() {
    localStorage.removeItem('notes');
  }

  navigateToNoteLocation(user: User, note: Note) {
    let url: string = `https://www.google.com/maps/dir/${encodeURIComponent(user.location.plusCode)}/${encodeURIComponent(note.plusCode)}`
    window.open(url, '_blank');
  }
}
