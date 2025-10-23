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
  private ref = inject(MatDialogRef<DecisionDialogComponent>);
  data = inject<{ noticeId: string }>(MAT_DIALOG_DATA);

  private destroy$ = new Subject<void>();
  submitting = signal(false);

  outcomes: { value: DecisionOutcome; label: string; icon: string }[] = [
    { value: 'NO_ACTION', label: 'No action', icon: 'check_circle' },
    { value: 'RESTRICT', label: 'Restrict / mask', icon: 'visibility_off' },
    { value: 'REMOVE_CONTENT', label: 'Remove content', icon: 'delete_forever' },
    { value: 'FORWARD_TO_AUTHORITY', label: 'Forward to authority', icon: 'gavel' }
  ];

  // Suggestions (combo with free text)
  legalBases = [
    { label: 'Terms of Service violation', desc: 'Violates platform rules (e.g., hate, harassment, spam).' },
    { label: 'Illegal content (local law)', desc: 'Contravenes applicable law (e.g., incitement to violence).' },
    { label: 'Copyright / IP infringement', desc: 'Infringes copyrights or trademarks.' },
    { label: 'Court order / compliance', desc: 'Enforcement due to legal/administrative order.' },
    { label: 'Risk to safety', desc: 'Material risk to safety (e.g., doxing, credible threats).' }
  ];
  tosClauses = [
    { label: '§3.2 Abuse / Harassment', desc: 'Insults, harassment, targeted disruption.' },
    { label: '§4.1 Hate Speech', desc: 'Dehumanising/derogatory targeting of protected classes.' },
    { label: '§4.5 Misinformation', desc: 'Harmful misinformation (e.g., health/election).' },
    { label: '§5.3 Violent / Graphic', desc: 'Glorification of violence or graphic content.' },
    { label: '§6.2 Spam / Scams', desc: 'Spam, phishing, or fraudulent behaviour.' }
  ];
  reasoningTemplates = [
    {
      label: 'No action – compliant content',
      desc: 'No violation found',
      text: `Following a detailed review, the content does not appear to violate applicable law or our Terms of Service.
It remains visible to the public, as it falls within the boundaries of acceptable expression.
No enforcement measures were taken. The case is documented and closed.`
    },
    {
      label: 'Context-sensitive restriction',
      desc: 'Sensitive context → restrict access',
      text: `This content presents a sensitive or potentially harmful context that may not be suitable for all audiences.
To minimize potential impact while preserving informational value, access has been restricted (e.g., age-gated or masked).
The user has been informed of this restriction and may appeal if they believe it was applied in error.`
    },
    {
      label: 'Clear Terms of Service violation',
      desc: 'Obvious ToS violation → remove content',
      text: `After careful assessment, this content was found to clearly and seriously violate our Terms of Service.
It includes material or behavior that is explicitly prohibited under our platform rules.
To protect users and maintain a safe environment, the content has been permanently removed.
The decision was reviewed manually and logged for transparency purposes.`
    },
    {
      label: 'Forwarded to competent authority',
      desc: 'Potential legal relevance',
      text: `During review, indicators suggested that this content may fall under the scope of national or EU law enforcement.
To ensure due process and prevent misuse of platform enforcement, the case has been forwarded to the competent public authority.
The content may remain temporarily restricted pending further evaluation.`
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
    const tpl = this.reasoningTemplates.find(t => t.label === label);
    if (!tpl) return;
    this.form.get('statement')?.setValue(tpl.text); // visible immediately
    this.snack.open('Reasoning template applied.', 'OK', { duration: 1800 });
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
        this.ref.close(true);
      },
      error: () => {
        this.snack.open('Failed to save decision.', 'OK', { duration: 3500 });
        this.submitting.set(false);
      }
    });
  }
}