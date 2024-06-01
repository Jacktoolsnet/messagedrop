import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockmessageComponent } from './blockmessage.component';

describe('BlockmessageComponent', () => {
  let component: BlockmessageComponent;
  let fixture: ComponentFixture<BlockmessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockmessageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BlockmessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
