import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyMessagelistComponent } from './my-messagelist.component';

describe('MyMessagelistComponent', () => {
  let component: MyMessagelistComponent;
  let fixture: ComponentFixture<MyMessagelistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyMessagelistComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MyMessagelistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
