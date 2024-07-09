import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletemessageComponent } from './delete-message.component';

describe('DeletemessageComponent', () => {
  let component: DeletemessageComponent;
  let fixture: ComponentFixture<DeletemessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletemessageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DeletemessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
