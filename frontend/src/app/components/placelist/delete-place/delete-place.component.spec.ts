import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletePlaceComponent } from './delete-place.component';

describe('DeletemessageComponent', () => {
  let component: DeletePlaceComponent;
  let fixture: ComponentFixture<DeletePlaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletePlaceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DeletePlaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
