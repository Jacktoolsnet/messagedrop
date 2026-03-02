import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map, startWith, Subject, takeUntil } from 'rxjs';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';

export type DecisionOutcome = 'REMOVE_CONTENT' | 'RESTRICT' | 'NO_ACTION' | 'FORWARD_TO_AUTHORITY';
export interface DecisionDialogResult {
  saved: boolean;
  outcome: DecisionOutcome;
}

@Component({
  selector: 'app-add-decision-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatButtonModule, MatIconModule, MatAutocompleteModule, MatTooltipModule
  ],
  templateUrl: './decision-dialog.component.html',
  styleUrls: ['./decision-dialog.component.css']
})
export class DecisionDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);
  private ref = inject(MatDialogRef<DecisionDialogComponent, DecisionDialogResult | false>);
  data = inject<{ noticeId: string }>(MAT_DIALOG_DATA);

  private destroy$ = new Subject<void>();
  submitting = signal(false);

  outcomes: { value: DecisionOutcome; label: string; icon: string }[] = [
    { value: 'NO_ACTION', label: 'No action', icon: 'check_circle' },
    { value: 'RESTRICT', label: 'Restrict visibility', icon: 'visibility_off' },
    { value: 'FORWARD_TO_AUTHORITY', label: 'Forward to authority', icon: 'gavel' }
  ];

  // Suggestions (combo with free text)
  legalBases = [
    { label: 'Terms of Use violation (Section 9)', desc: 'Violates the prohibited use rules in the Terms of Use.' },
    { label: 'Unlawful content (Section 9)', desc: 'Violates applicable law or encourages illegal acts.' },
    { label: 'Third-party rights infringement (Section 9)', desc: 'Violates copyright, trademark, personality, or data protection rights.' },
    { label: 'Privacy or personal data disclosure (Section 9)', desc: 'Shares personal data without consent.' },
    { label: 'Statutory notice or DSA procedure (Section 8)', desc: 'Action required under legal obligations or a DSA notice.' }
  ];
  tosClauses = [
    { label: 'Section 9 - Hate speech, harassment, or threats', desc: 'Hate speech, targeted harassment, or threats against individuals or groups.' },
    { label: 'Section 9 - Violence or glorification of violence', desc: 'Threats, glorification of violence, or incitement.' },
    { label: 'Section 9 - Sexual or harmful-to-minors content', desc: 'Sexually explicit or harmful-to-minors content.' },
    { label: 'Section 9 - Privacy or personal data disclosure', desc: 'Doxxing or sharing personal data without consent.' },
    { label: 'Section 9 - Fraud, scams, or spam', desc: 'Fraudulent, manipulative, or spam content.' },
    { label: 'Section 9 - Intellectual property or third-party rights', desc: 'Copyright, trademark, or other third-party rights violations.' }
  ];
  reasoningTemplates = [
    {
      label: 'No action',
      desc: 'No violation found',
      text: `Following a detailed review, the content does not appear to violate applicable law or the Terms of Use.
It remains visible to the public, as it falls within the boundaries of acceptable expression.
No enforcement measures were applied. The case is documented and closed.`
    },
    {
      label: 'Sensitive contex',
      desc: 'Sensitive context → restrict access',
      text: `This content presents a sensitive or potentially harmful context that may not be suitable for all audiences.
To minimize potential impact while preserving informational value, visibility has been restricted (e.g., age-gated or warning gate).
The user has been informed of this restriction and may appeal if they believe it was applied in error.`
    },
    {
      label: 'Terms of Use violation',
      desc: 'Clear violation → restrict visibility',
      text: `After careful assessment, this content was found to violate the Terms of Use, in particular Section 9 (Prohibited Use).
To protect users and comply with our rules, the content is no longer publicly visible and its visibility has been restricted.
The content remains stored for documentation and appeal review.
The decision was reviewed manually and logged for transparency purposes.`
    },
    {
      label: 'Forwarded to competent authority',
      desc: 'Potential legal relevance',
      text: `During review, indicators suggested that this content may be relevant under applicable law.
To ensure due process and comply with legal obligations, the case has been forwarded to the competent public authority.
The content may remain restricted pending further evaluation.`
    }
  ];

  // Reactive form (parent group!)
  form = this.fb.nonNullable.group({
    outcome: this.fb.nonNullable.control<DecisionOutcome>('NO_ACTION', { validators: [Validators.required] }),
    legalBasis: this.fb.control<string>(''),
    tosBasis: this.fb.control<string>(''),
    automatedUsed: this.fb.nonNullable.control<boolean>(false),
    statement: this.fb.control<string>('', { validators: [Validators.maxLength(2000)] })
  });

  // Standalone controls for combobox inputs (bind to form fields programmatically)
  legalCtrl = new FormControl<string>('');
  tosCtrl = new FormControl<string>('');

  filteredLegal$ = this.legalCtrl.valueChanges.pipe(
    startWith(this.legalCtrl.value ?? ''),
    map(v => this.filterCombo(this.legalBases, v))
  );
  filteredTos$ = this.tosCtrl.valueChanges.pipe(
    startWith(this.tosCtrl.value ?? ''),
    map(v => this.filterCombo(this.tosClauses, v))
  );

  selectedLegalDesc: string | null = null;
  selectedTosDesc: string | null = null;
  selectedTemplate = '';

  ngOnInit(): void {
    // Seed comboboxes from form (if there were prefilled values)
    this.legalCtrl.setValue(this.form.get('legalBasis')?.value || '');
    this.tosCtrl.setValue(this.form.get('tosBasis')?.value || '');

    // Keep form fields in sync with combobox text
    this.legalCtrl.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        const v = val || '';
        this.form.get('legalBasis')?.setValue(v, { emitEvent: false });
        this.selectedLegalDesc = this.lookupDesc(this.legalBases, v);
      });

    this.tosCtrl.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        const v = val || '';
        this.form.get('tosBasis')?.setValue(v, { emitEvent: false });
        this.selectedTosDesc = this.lookupDesc(this.tosClauses, v);
      });

    // Initialize descriptions on open
    this.selectedLegalDesc = this.lookupDesc(this.legalBases, this.legalCtrl.value || '');
    this.selectedTosDesc = this.lookupDesc(this.tosClauses, this.tosCtrl.value || '');

    if (!this.form.get('statement')?.value && this.form.get('outcome')?.value === 'NO_ACTION') {
      const defaultTemplate = this.reasoningTemplates[0]?.label;
      if (defaultTemplate) {
        this.selectedTemplate = defaultTemplate;
        this.applyTemplate(defaultTemplate, true);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private filterCombo(list: { label: string; desc: string }[], q?: string | null) {
    const s = (q || '').toLowerCase().trim();
    if (!s) return list;
    return list.filter(x =>
      x.label.toLowerCase().includes(s) || x.desc.toLowerCase().includes(s)
    );
  }

  private lookupDesc(list: { label: string; desc: string }[], label: string): string | null {
    const hit = list.find(x => x.label === label);
    return hit ? hit.desc : null;
  }

  onSelectLegal(ev: MatAutocompleteSelectedEvent) {
    const label = ev.option.value as string;
    this.form.get('legalBasis')?.setValue(label);
    this.selectedLegalDesc = this.lookupDesc(this.legalBases, label);
  }

  onSelectTos(ev: MatAutocompleteSelectedEvent) {
    const label = ev.option.value as string;
    this.form.get('tosBasis')?.setValue(label);
    this.selectedTosDesc = this.lookupDesc(this.tosClauses, label);
  }

  onTemplateChange(label: string) {
    this.applyTemplate(label);
  }

  private applyTemplate(label: string, silent = false) {
    const tpl = this.reasoningTemplates.find(t => t.label === label);
    if (!tpl) return;
    this.form.get('statement')?.setValue(tpl.text); // visible immediately
    if (!silent) {
      this.snack.open('Reasoning template applied.', 'OK', { duration: 1800 });
    }
  }

  close(): void { this.ref.close(false); }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { outcome, legalBasis, tosBasis, automatedUsed, statement } = this.form.getRawValue();
    this.dsa.createDecision(this.data.noticeId, {
      outcome,
      legalBasis: (legalBasis || '').trim() || null,
      tosBasis: (tosBasis || '').trim() || null,
      automatedUsed,
      statement: (statement || '').trim() || null
    }).subscribe({
      next: () => {
        this.snack.open('Decision saved.', 'OK', { duration: 2500 });
        this.ref.close({ saved: true, outcome });
      },
      error: () => {
        this.snack.open('Failed to save decision.', 'OK', { duration: 3500 });
        this.submitting.set(false);
      }
    });
  }
}
