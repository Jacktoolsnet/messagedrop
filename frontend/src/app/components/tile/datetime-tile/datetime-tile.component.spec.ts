import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateTimeTileComponent } from './datetime-tile.component';

describe('DateTimeComponent', () => {
  let component: DateTimeTileComponent;
  let fixture: ComponentFixture<DateTimeTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateTimeTileComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DateTimeTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
