import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaceProfileComponent } from './place-profile.component';

describe('DropmessageComponent', () => {
  let component: PlaceProfileComponent;
  let fixture: ComponentFixture<PlaceProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceProfileComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PlaceProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
