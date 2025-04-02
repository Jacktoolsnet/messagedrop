import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowmultimediaComponent } from './showmultimedia.component';

describe('ShowmultimediaComponent', () => {
  let component: ShowmultimediaComponent;
  let fixture: ComponentFixture<ShowmultimediaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowmultimediaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowmultimediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
