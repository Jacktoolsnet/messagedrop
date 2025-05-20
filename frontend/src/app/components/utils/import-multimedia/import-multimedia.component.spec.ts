import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportMultimediaComponent } from './import-multimedia.component';

describe('PinterestComponent', () => {
  let component: ImportMultimediaComponent;
  let fixture: ComponentFixture<ImportMultimediaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportMultimediaComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ImportMultimediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
