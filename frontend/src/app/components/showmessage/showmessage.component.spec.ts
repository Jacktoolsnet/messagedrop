import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowmessageComponent } from './showmessage.component';

describe('ShowmessageComponent', () => {
  let component: ShowmessageComponent;
  let fixture: ComponentFixture<ShowmessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowmessageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowmessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
