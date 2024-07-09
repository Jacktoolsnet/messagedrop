import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockMessageComponent } from './block-message.component';

describe('BlockmessageComponent', () => {
  let component: BlockMessageComponent;
  let fixture: ComponentFixture<BlockMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockMessageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BlockMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
