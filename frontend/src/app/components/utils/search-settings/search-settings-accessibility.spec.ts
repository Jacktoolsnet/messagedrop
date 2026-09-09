import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  standalone: true,
  imports: [FormsModule, MatSliderModule, MatSlideToggleModule],
  template: `
    <h3 id="category-title">Accommodation</h3>
    <mat-slide-toggle aria-labelledby="category-title toggle-label">
      <span id="toggle-label">Enable search</span>
    </mat-slide-toggle>
    <span id="zoom-label">Search from zoom level</span>
    <mat-slider min="3" max="19">
      <input matSliderThumb [ngModel]="16" aria-labelledby="category-title zoom-label" aria-valuetext="Zoom level 16" />
    </mat-slider>
  `
})
class AccessibilityHostComponent {}

describe('Search settings accessibility bindings', () => {
  let fixture: ComponentFixture<AccessibilityHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccessibilityHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(AccessibilityHostComponent);
    fixture.detectChanges();
  });

  it('forwards the category labels to the interactive Material elements', () => {
    const toggle = fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement;
    const slider = fixture.nativeElement.querySelector('input[matSliderThumb]') as HTMLInputElement;

    expect(toggle.getAttribute('aria-labelledby')).toBe('category-title toggle-label');
    expect(slider.getAttribute('aria-labelledby')).toBe('category-title zoom-label');
    expect(slider.getAttribute('aria-valuetext')).toBe('Zoom level 16');
  });
});
