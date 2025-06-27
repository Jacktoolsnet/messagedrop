import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoteTileComponent } from './note-tile.component';

describe('NoteTileComponent', () => {
  let component: NoteTileComponent;
  let fixture: ComponentFixture<NoteTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteTileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoteTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
