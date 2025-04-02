import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectMultimediaComponent } from './select-multimedia.component';

describe('SelectMultimediaComponent', () => {
  let component: SelectMultimediaComponent;
  let fixture: ComponentFixture<SelectMultimediaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectMultimediaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectMultimediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
