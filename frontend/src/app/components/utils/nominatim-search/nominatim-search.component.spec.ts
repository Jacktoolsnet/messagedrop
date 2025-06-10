import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NominatimSearchComponent } from './nominatim-search.component';

describe('NominatimSearchComponent', () => {
  let component: NominatimSearchComponent;
  let fixture: ComponentFixture<NominatimSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NominatimSearchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NominatimSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
