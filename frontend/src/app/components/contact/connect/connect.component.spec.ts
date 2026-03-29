import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Mode } from '../../../interfaces/mode';
import { DisplayMessageService } from '../../../services/display-message.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { ConnectComponent } from './connect.component';

describe('ConnectComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: Mode.EDIT_CONTACT,
            contact: {},
            connectId: ''
          }
        },
        {
          provide: MatDialogRef,
          useValue: {
            close: jasmine.createSpy('close')
          }
        },
        { provide: DisplayMessageService, useValue: { open: jasmine.createSpy('open') } },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } }
      ]
    })
      .overrideComponent(ConnectComponent, {
        set: {
          template: '<div></div>'
        }
      })
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
