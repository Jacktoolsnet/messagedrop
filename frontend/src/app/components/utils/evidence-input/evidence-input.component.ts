import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface EvidenceUrlItem {
  id: string;
  label: string;
  tooltip?: string;
}

export interface EvidenceFileItem {
  id: string;
  label: string;
  tooltip?: string;
}

@Component({
  selector: 'app-evidence-input',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './evidence-input.component.html',
  styleUrl: './evidence-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EvidenceInputComponent {
  // Inputs
  showUrl = input<boolean>(true);
  showFiles = input<boolean>(true);
  disabled = input<boolean>(false);
  urlItems = input<readonly EvidenceUrlItem[]>([]);
  fileItems = input<readonly EvidenceFileItem[]>([]);
  fileHint = input<string>('');

  // Outputs
  readonly urlAdd = output<string>();
  readonly filesSelect = output<File[]>();
  readonly urlRemove = output<string>();
  readonly fileRemove = output<string>();

  constructor(private readonly fb: FormBuilder) {}

  readonly form = this.fb.nonNullable.group({
    url: ['', [Validators.maxLength(2048)]]
  });

  // Emits a normalized URL if valid
  onAddUrl(): void {
    const raw = (this.form.controls.url.value || '').trim();
    const normalized = this.normalizeUrl(raw);
    if (!normalized || this.disabled()) return;
    this.urlAdd.emit(normalized);
    this.form.controls.url.setValue('');
  }

  // Handle native file selection and emit files
  onFilesSelected(event: Event): void {
    if (this.disabled()) return;
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length) {
      this.filesSelect.emit(files);
    }
    input.value = '';
  }

  onUrlRemove(id: string): void {
    if (this.disabled()) return;
    this.urlRemove.emit(id);
  }

  onFileRemove(id: string): void {
    if (this.disabled()) return;
    this.fileRemove.emit(id);
  }

  private normalizeUrl(u: string): string | null {
    if (!u) return null;
    const trimmed = u.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^www\./i.test(trimmed) || /\.[a-z]{2,}(?:\/.+)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }
}
