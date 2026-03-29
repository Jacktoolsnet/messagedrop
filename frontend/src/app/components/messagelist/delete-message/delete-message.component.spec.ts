import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { DeleteMessageComponent } from './delete-message.component';

describe('DeleteMessageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteMessageComponent],
      providers: [
        {
          provide: MatDialogRef,
          useValue: {
            close: jasmine.createSpy('close')
          }
        }
      ]
    })
      .overrideComponent(DeleteMessageComponent, {
        set: {
          template: '<div></div>'
        }
      })
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(DeleteMessageComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
