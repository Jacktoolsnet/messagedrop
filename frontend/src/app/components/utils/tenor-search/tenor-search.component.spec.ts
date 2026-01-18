import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenorSearchComponent } from './tenor-search.component';

describe('MultimediaComponent', () => {
  let component: TenorSearchComponent;
  let fixture: ComponentFixture<TenorSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenorSearchComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TenorSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
