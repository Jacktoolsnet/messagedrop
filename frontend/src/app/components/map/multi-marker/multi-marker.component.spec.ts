import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiMarkerComponent } from './multi-marker.component';

describe('EditUserComponent', () => {
  let component: MultiMarkerComponent;
  let fixture: ComponentFixture<MultiMarkerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiMarkerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MultiMarkerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
