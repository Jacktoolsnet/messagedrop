import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlacelistComponent } from './placelist.component';

describe('MessagelistComponent', () => {
  let component: PlacelistComponent;
  let fixture: ComponentFixture<PlacelistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlacelistComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlacelistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
