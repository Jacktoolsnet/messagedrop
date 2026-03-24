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
import { DsaDecisionOutcome, DsaTextBlock } from '../../../../interfaces/dsa-text-block.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';

export type DecisionOutcome = DsaDecisionOutcome;
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
  readonly i18n = inject(TranslationHelperService);
  data = inject<{ noticeId: string }>(MAT_DIALOG_DATA);

  private destroy$ = new Subject<void>();
  submitting = signal(false);

  outcomes: { value: DecisionOutcome; label: string; icon: string }[] = [
    { value: 'NO_ACTION', label: 'No action', icon: 'check_circle' },
    { value: 'RESTRICT', label: 'Restrict visibility', icon: 'visibility_off' },
    { value: 'FORWARD_TO_AUTHORITY', label: 'Forward to authority', icon: 'gavel' }
  ];

  legalBases: DsaTextBlock[] = [];
  tosClauses: DsaTextBlock[] = [];
  reasoningTemplates: DsaTextBlock[] = [];

  form = this.fb.nonNullable.group({
    outcome: this.fb.nonNullable.control<DecisionOutcome>('NO_ACTION', { validators: [Validators.required] }),
    legalBasis: this.fb.control<string>(''),
    legalBasisEn: this.fb.control<string>(''),
    tosBasis: this.fb.control<string>(''),
    tosBasisEn: this.fb.control<string>(''),
    automatedUsed: this.fb.nonNullable.control<boolean>(false),
    statement: this.fb.control<string>('', { validators: [Validators.maxLength(2000)] }),
    statementEn: this.fb.control<string>('')
  });

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
    this.legalCtrl.setValue(this.form.get('legalBasis')?.value || '');
    this.tosCtrl.setValue(this.form.get('tosBasis')?.value || '');

    this.form.controls.outcome.valueChanges
      .pipe(startWith(this.form.controls.outcome.value), takeUntil(this.destroy$))
      .subscribe((outcome) => {
        this.syncReferenceControls(outcome);
        this.syncReasoningTemplateSelection(outcome);
      });

    this.legalCtrl.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        const v = (val || '').trim();
        this.form.get('legalBasis')?.setValue(v, { emitEvent: false });
        const selected = this.findByGermanLabel(this.legalBases, v);
        this.form.get('legalBasisEn')?.setValue(selected?.labelEn?.trim() || '', { emitEvent: false });
        this.selectedLegalDesc = selected?.descriptionDe || selected?.descriptionEn || null;
      });

    this.tosCtrl.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        const v = (val || '').trim();
        this.form.get('tosBasis')?.setValue(v, { emitEvent: false });
        const selected = this.findByGermanLabel(this.tosClauses, v);
        this.form.get('tosBasisEn')?.setValue(selected?.labelEn?.trim() || '', { emitEvent: false });
        this.selectedTosDesc = selected?.descriptionDe || selected?.descriptionEn || null;
      });

    this.loadTextBlocks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  localizedLabel(row: DsaTextBlock): string {
    return this.i18n.lang() === 'de'
      ? (row.labelDe || row.labelEn || '')
      : (row.labelEn || row.labelDe || '');
  }

  localizedDescription(row: DsaTextBlock): string {
    return this.i18n.lang() === 'de'
      ? (row.descriptionDe || row.descriptionEn || '')
      : (row.descriptionEn || row.descriptionDe || '');
  }

  onSelectLegal(ev: MatAutocompleteSelectedEvent) {
    const block = this.legalBases.find((entry) => entry.id === ev.option.value);
    if (!block) {
      return;
    }
    this.legalCtrl.setValue(block.labelDe);
    this.form.get('legalBasis')?.setValue(block.labelDe);
    this.form.get('legalBasisEn')?.setValue(block.labelEn || '');
    this.selectedLegalDesc = block.descriptionDe || block.descriptionEn || null;
  }

  onSelectTos(ev: MatAutocompleteSelectedEvent) {
    const block = this.tosClauses.find((entry) => entry.id === ev.option.value);
    if (!block) {
      return;
    }
    this.tosCtrl.setValue(block.labelDe);
    this.form.get('tosBasis')?.setValue(block.labelDe);
    this.form.get('tosBasisEn')?.setValue(block.labelEn || '');
    this.selectedTosDesc = block.descriptionDe || block.descriptionEn || null;
  }

  onTemplateChange(id: string) {
    if (!id) {
      this.selectedTemplate = '';
      return;
    }
    this.applyTemplate(id);
  }

  isNoActionOutcome(): boolean {
    return this.form.controls.outcome.value === 'NO_ACTION';
  }

  filteredReasoningTemplates(): DsaTextBlock[] {
    return this.filterTemplatesForOutcome(this.form.controls.outcome.value);
  }

  close(): void { this.ref.close(false); }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { outcome, legalBasis, legalBasisEn, tosBasis, tosBasisEn, automatedUsed, statement, statementEn } = this.form.getRawValue();
    const noAction = outcome === 'NO_ACTION';
    this.dsa.createDecision(this.data.noticeId, {
      outcome,
      legalBasis: noAction ? null : (legalBasis || '').trim() || null,
      legalBasisEn: noAction ? null : (legalBasisEn || '').trim() || null,
      tosBasis: noAction ? null : (tosBasis || '').trim() || null,
      tosBasisEn: noAction ? null : (tosBasisEn || '').trim() || null,
      automatedUsed,
      statement: (statement || '').trim() || null,
      statementEn: (statementEn || '').trim() || null
    }).subscribe({
      next: () => {
        this.snack.open(this.i18n.t('Decision saved.'), this.i18n.t('OK'), { duration: 2500 });
        this.ref.close({ saved: true, outcome });
      },
      error: () => {
        this.snack.open(this.i18n.t('Failed to save decision.'), this.i18n.t('OK'), { duration: 3500 });
        this.submitting.set(false);
      }
    });
  }

  private loadTextBlocks(): void {
    this.dsa.listDecisionTextBlocks({ activeOnly: true }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (rows) => {
        const blocks = rows || [];
        this.legalBases = blocks.filter((row) => row.type === 'legal_basis');
        this.tosClauses = blocks.filter((row) => row.type === 'tos_clause');
        this.reasoningTemplates = blocks.filter((row) => row.type === 'reasoning_template');
        this.selectedLegalDesc = this.findByGermanLabel(this.legalBases, this.legalCtrl.value || '')?.descriptionDe || null;
        this.selectedTosDesc = this.findByGermanLabel(this.tosClauses, this.tosCtrl.value || '')?.descriptionDe || null;
        this.legalCtrl.setValue(this.legalCtrl.value || '', { emitEvent: true });
        this.tosCtrl.setValue(this.tosCtrl.value || '', { emitEvent: true });
        this.syncReasoningTemplateSelection(this.form.controls.outcome.value);
      },
      error: () => {
        this.snack.open(this.i18n.t('Could not load DSA text blocks.'), this.i18n.t('OK'), { duration: 3000 });
      }
    });
  }

  private filterCombo(list: DsaTextBlock[], q?: string | null) {
    const s = (q || '').toLowerCase().trim();
    if (!s) return list;
    return list.filter((x) => {
      const haystack = [x.labelDe, x.labelEn, x.descriptionDe, x.descriptionEn]
        .map((value) => (value || '').toLowerCase())
        .join(' ');
      return haystack.includes(s);
    });
  }

  private findByGermanLabel(list: DsaTextBlock[], label: string): DsaTextBlock | undefined {
    const normalized = (label || '').trim();
    return list.find((row) => row.labelDe === normalized);
  }

  private filterTemplatesForOutcome(outcome: DecisionOutcome): DsaTextBlock[] {
    return this.reasoningTemplates.filter((template) => {
      const targets = template.decisionOutcomes || [];
      return targets.length === 0 || targets.includes(outcome);
    });
  }

  private syncReferenceControls(outcome: DecisionOutcome): void {
    const disableReferences = outcome === 'NO_ACTION';

    if (disableReferences) {
      this.legalCtrl.disable({ emitEvent: false });
      this.tosCtrl.disable({ emitEvent: false });
      this.legalCtrl.setValue('', { emitEvent: false });
      this.tosCtrl.setValue('', { emitEvent: false });
      this.form.patchValue({
        legalBasis: '',
        legalBasisEn: '',
        tosBasis: '',
        tosBasisEn: ''
      }, { emitEvent: false });
      this.selectedLegalDesc = null;
      this.selectedTosDesc = null;
      return;
    }

    this.legalCtrl.enable({ emitEvent: false });
    this.tosCtrl.enable({ emitEvent: false });
  }

  private syncReasoningTemplateSelection(outcome: DecisionOutcome): void {
    const availableTemplates = this.filterTemplatesForOutcome(outcome);
    const hasSelectedTemplate = !!this.selectedTemplate;
    const selectedStillAllowed = availableTemplates.some((template) => template.id === this.selectedTemplate);

    if (hasSelectedTemplate && !selectedStillAllowed) {
      const previousTemplate = this.reasoningTemplates.find((template) => template.id === this.selectedTemplate);
      const shouldClearStatement = this.matchesTemplateContent(previousTemplate);
      this.selectedTemplate = '';
      if (shouldClearStatement) {
        this.form.patchValue({ statement: '', statementEn: '' }, { emitEvent: false });
      }
    }

    if (outcome === 'NO_ACTION' && !this.selectedTemplate && !(this.form.get('statement')?.value || '').trim()) {
      const defaultTemplate = availableTemplates.find((template) => template.key === 'no_action') || availableTemplates[0];
      if (defaultTemplate) {
        this.applyTemplate(defaultTemplate.id, true);
      }
    }
  }

  private matchesTemplateContent(template?: DsaTextBlock): boolean {
    if (!template) {
      return false;
    }

    const statement = (this.form.get('statement')?.value || '').trim();
    const statementEn = (this.form.get('statementEn')?.value || '').trim();
    return statement === (template.contentDe || '').trim()
      && statementEn === (template.contentEn || '').trim();
  }

  private applyTemplate(id: string, silent = false) {
    const tpl = this.reasoningTemplates.find(t => t.id === id);
    if (!tpl) return;
    this.selectedTemplate = tpl.id;
    this.form.get('statement')?.setValue(tpl.contentDe || '');
    this.form.get('statementEn')?.setValue(tpl.contentEn || '');
    if (!silent) {
      this.snack.open(this.i18n.t('Reasoning template applied.'), this.i18n.t('OK'), { duration: 1800 });
    }
  }
}
