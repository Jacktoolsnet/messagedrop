import { Injectable } from '@angular/core';
import { Note } from '../interfaces/note';
import { Location } from '../interfaces/location';

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
}
