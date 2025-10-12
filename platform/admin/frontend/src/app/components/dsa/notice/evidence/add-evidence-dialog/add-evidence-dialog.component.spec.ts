import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEvidenceDialogComponent } from './add-evidence-dialog.component';

describe('AddEvidenceDialogComponent', () => {
  let component: AddEvidenceDialogComponent;
  let fixture: ComponentFixture<AddEvidenceDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddEvidenceDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddEvidenceDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
