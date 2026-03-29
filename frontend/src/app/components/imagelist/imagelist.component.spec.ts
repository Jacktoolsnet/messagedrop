import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { DisplayMessageService } from '../../services/display-message.service';
import { GeolocationService } from '../../services/geolocation.service';
import { IndexedDbService } from '../../services/indexed-db.service';
import { LocalImageService } from '../../services/local-image.service';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { ImagelistComponent } from './imagelist.component';

describe('ImagelistComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImagelistComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            location: { latitude: 0, longitude: 0, plusCode: '' },
            imagesSignal: signal([])
          }
        },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        {
          provide: MatDialog,
          useValue: {
            open: jasmine.createSpy('open').and.returnValue({
              afterClosed: () => of(undefined)
            })
          }
        },
        { provide: DisplayMessageService, useValue: { open: jasmine.createSpy('open') } },
        { provide: IndexedDbService, useValue: { saveImage: jasmine.createSpy('saveImage').and.resolveTo() } },
        {
          provide: UserService,
          useValue: {
            getUser: () => ({ id: 'user-1' })
          }
        },
        {
          provide: LocalImageService,
          useValue: {
            getImagesInBoundingBox: jasmine.createSpy('getImagesInBoundingBox').and.resolveTo([]),
            getImageUrl: jasmine.createSpy('getImageUrl').and.resolveTo('blob:test'),
            revokeImageUrl: jasmine.createSpy('revokeImageUrl'),
            deleteImage: jasmine.createSpy('deleteImage').and.resolveTo(),
            navigateToNoteLocation: jasmine.createSpy('navigateToNoteLocation'),
            isSupported: () => true,
            createImageEntries: jasmine.createSpy('createImageEntries').and.resolveTo([])
          }
        },
        {
          provide: MapService,
          useValue: {
            getMapLocation: () => ({ latitude: 0, longitude: 0, plusCode: '' }),
            flyToWithZoom: jasmine.createSpy('flyToWithZoom'),
            fitMapToBounds: jasmine.createSpy('fitMapToBounds')
          }
        },
        { provide: GeolocationService, useValue: { getPlusCode: () => 'PLUSCODE' } },
        { provide: SharedContentService, useValue: {} },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } }
      ]
    })
      .overrideComponent(ImagelistComponent, {
        set: {
          template: '<div></div>'
        }
      })
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ImagelistComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
