import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocationlistComponent } from './locationlist.component';

describe('MessagelistComponent', () => {
  let component: LocationlistComponent;
  let fixture: ComponentFixture<LocationlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationlistComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LocationlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
