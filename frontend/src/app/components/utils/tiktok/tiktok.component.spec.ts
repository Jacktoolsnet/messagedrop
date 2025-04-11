import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TiktokComponent } from './tiktok.component';

describe('InstagramComponent', () => {
  let component: TiktokComponent;
  let fixture: ComponentFixture<TiktokComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TiktokComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TiktokComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
