import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { fakeAsync, tick } from '@angular/core/testing';

import { CreatePinComponent } from './create-pin.component';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { PinInputFeedbackService } from '../../../services/pin-input-feedback.service';

describe('CreatepinComponent', () => {
  let component: CreatePinComponent;
  let fixture: ComponentFixture<CreatePinComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<CreatePinComponent>>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let translationSpy: jasmine.SpyObj<TranslationHelperService>;
  let feedbackSpy: jasmine.SpyObj<PinInputFeedbackService>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<CreatePinComponent>>('MatDialogRef', ['close']);
    dialogSpy = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    translationSpy = jasmine.createSpyObj<TranslationHelperService>('TranslationHelperService', ['t']);
    translationSpy.t.and.callFake((key: string) => key);
    feedbackSpy = jasmine.createSpyObj<PinInputFeedbackService>('PinInputFeedbackService', ['notifyAcceptedInput', 'notifyResetAction']);
    feedbackSpy.notifyAcceptedInput.and.resolveTo();
    feedbackSpy.notifyResetAction.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [CreatePinComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: TranslationHelperService, useValue: translationSpy },
        { provide: PinInputFeedbackService, useValue: feedbackSpy }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CreatePinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should keep digits visible longer and pulse the current slot', fakeAsync(() => {
    component.addDigit('7');

    expect(component.pinDisplay[0]).toBe('7');
    expect(component.pinPulseStates[0]).toBeTrue();
    expect(feedbackSpy.notifyAcceptedInput).toHaveBeenCalled();

    tick(component.slotPulseDurationMs);
    expect(component.pinPulseStates[0]).toBeFalse();

    tick(component.digitVisibilityDurationMs - component.slotPulseDurationMs - 1);
    expect(component.pinDisplay[0]).toBe('7');

    tick(1);
    expect(component.pinDisplay[0]).toBe('•');
  }));

  it('should trigger reset feedback only for user-initiated reset', () => {
    component.pin = '123';
    component.pinDisplay = ['•', '•', '•', '', '', ''];

    component.reset();

    expect(component.pin).toBe('');
    expect(component.confirmPin).toBe('');
    expect(feedbackSpy.notifyResetAction).toHaveBeenCalledTimes(1);

    component.pin = '456';
    component.reset(false);

    expect(feedbackSpy.notifyResetAction).toHaveBeenCalledTimes(1);
  });
});
