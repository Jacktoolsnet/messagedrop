import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SharedContentComponent } from './shared-content.component';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

describe('SharedContentComponent', () => {
  let component: SharedContentComponent;
  let fixture: ComponentFixture<SharedContentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedContentComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MapService, useValue: { moveToWithZoom: jasmine.createSpy('moveToWithZoom') } },
        { provide: SharedContentService, useValue: { deleteSharedContent: jasmine.createSpy('deleteSharedContent').and.returnValue(Promise.resolve()) } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
