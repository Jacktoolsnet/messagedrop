import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicMessageDetailComponent } from './public-message-detail.component';

describe('PublicMessageDetailComponent', () => {
  let component: PublicMessageDetailComponent;
  let fixture: ComponentFixture<PublicMessageDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicMessageDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PublicMessageDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
