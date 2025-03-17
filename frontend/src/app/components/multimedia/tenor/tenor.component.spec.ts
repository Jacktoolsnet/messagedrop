import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenorComponent } from './tenor.component';

describe('MultimediaComponent', () => {
  let component: TenorComponent;
  let fixture: ComponentFixture<TenorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenorComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TenorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
