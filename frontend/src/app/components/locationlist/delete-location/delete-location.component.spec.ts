import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteLocationComponent } from './delete-location.component';

describe('DeletemessageComponent', () => {
  let component: DeleteLocationComponent;
  let fixture: ComponentFixture<DeleteLocationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteLocationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DeleteLocationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
