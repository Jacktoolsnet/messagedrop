import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteImageComponent } from './delete-image.component';

describe('DeletemessageComponent', () => {
  let component: DeleteImageComponent;
  let fixture: ComponentFixture<DeleteImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteImageComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DeleteImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
