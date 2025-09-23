import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnableExternalContentComponent } from './enable-external-content.component';

describe('EnableExternalContentComponent', () => {
  let component: EnableExternalContentComponent;
  let fixture: ComponentFixture<EnableExternalContentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnableExternalContentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EnableExternalContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
