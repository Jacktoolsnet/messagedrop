import { Injectable } from '@angular/core';
import { SharedContent } from '../interfaces/shared-content';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private sharedContent?: SharedContent;

  constructor() { }

  public set(formData: FormData): void {
    this.sharedContent = {
      title: formData.get('title') as string,
      text: formData.get('text') as string,
      url: formData.get('url') as string
    };
    console.log('Shared content received:', this.sharedContent);
  }

  public getSharedContent(): SharedContent | undefined {
    return this.sharedContent;
  }

  public clearSharedContent(): void {
    this.sharedContent = undefined;
  }
}
