import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvidenceListComponent } from './evidence-list.component';

describe('EvidenceListComponent', () => {
  let component: EvidenceListComponent;
  let fixture: ComponentFixture<EvidenceListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvidenceListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EvidenceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
