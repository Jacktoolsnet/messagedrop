import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DsaDashboardComponent } from './dsa-dashboard.component';

describe('DsaDashboardComponent', () => {
  let component: DsaDashboardComponent;
  let fixture: ComponentFixture<DsaDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DsaDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DsaDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
