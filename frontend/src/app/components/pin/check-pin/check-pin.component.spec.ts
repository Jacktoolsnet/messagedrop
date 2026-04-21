import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { fakeAsync, tick } from '@angular/core/testing';

import { CheckPinComponent } from './check-pin.component';
import { PinInputFeedbackService } from '../../../services/pin-input-feedback.service';

describe('CheckPinComponent', () => {
  let component: CheckPinComponent;
  let fixture: ComponentFixture<CheckPinComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<CheckPinComponent>>;
  let feedbackSpy: jasmine.SpyObj<PinInputFeedbackService>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<CheckPinComponent>>('MatDialogRef', ['close']);
    feedbackSpy = jasmine.createSpyObj<PinInputFeedbackService>('PinInputFeedbackService', ['notifyAcceptedInput', 'notifyResetAction']);
    feedbackSpy.notifyAcceptedInput.and.resolveTo();
    feedbackSpy.notifyResetAction.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [CheckPinComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: PinInputFeedbackService, useValue: feedbackSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckPinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should keep the last digit visible a bit longer and pulse the slot', fakeAsync(() => {
    component.addDigit('4');

    expect(component.pinDisplay[0]).toBe('4');
    expect(component.pinPulseStates[0]).toBeTrue();
    expect(feedbackSpy.notifyAcceptedInput).toHaveBeenCalled();

    tick(component.slotPulseDurationMs);
    expect(component.pinPulseStates[0]).toBeFalse();

    tick(component.digitVisibilityDurationMs - component.slotPulseDurationMs - 1);
    expect(component.pinDisplay[0]).toBe('4');

    tick(1);
    expect(component.pinDisplay[0]).toBe('•');
  }));

  it('should trigger stronger feedback when resetting entered digits', () => {
    component.pin = '12';
    component.pinDisplay = ['•', '•', '', '', '', ''];

    component.reset();

    expect(component.pin).toBe('');
    expect(component.pinDisplay).toEqual(['', '', '', '', '', '']);
    expect(feedbackSpy.notifyResetAction).toHaveBeenCalled();
  });
});
