import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverrideExifDataComponent } from './delete-note.component';

describe('DeletemessageComponent', () => {
  let component: OverrideExifDataComponent;
  let fixture: ComponentFixture<OverrideExifDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverrideExifDataComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(OverrideExifDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
