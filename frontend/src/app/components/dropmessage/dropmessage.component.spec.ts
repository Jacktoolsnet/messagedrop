import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DropmessageComponent } from './dropmessage.component';

describe('DropmessageComponent', () => {
  let component: DropmessageComponent;
  let fixture: ComponentFixture<DropmessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropmessageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DropmessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
