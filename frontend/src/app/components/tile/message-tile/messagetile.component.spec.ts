import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageTileComponent } from './messagetile.component';

describe('Messagetile', () => {
  let component: MessageTileComponent;
  let fixture: ComponentFixture<MessageTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageTileComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MessageTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
