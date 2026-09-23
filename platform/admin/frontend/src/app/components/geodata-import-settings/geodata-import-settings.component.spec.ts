import { TestBed } from '@angular/core/testing';
import { EMPTY, of, throwError } from 'rxjs';
import { GeodataImportSettingsComponent } from './geodata-import-settings.component';
import { GeodataImportJob } from '../../interfaces/geodata-import.interface';
import { GeodataImportService } from '../../services/geodata-import.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { TranslationHelperService } from '../../services/translation-helper.service';

describe('Geodata import run display', () => {
  let component: GeodataImportSettingsComponent;

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({
      providers: [
        { provide: GeodataImportService, useValue: { getSettings: () => EMPTY, getCatalog: () => EMPTY, getJobs: () => EMPTY } },
        { provide: DisplayMessageService, useValue: { open: () => undefined } },
        { provide: TranslationHelperService, useValue: { lang: () => 'de', t: (value: string) => value } }
      ]
    });
    component = TestBed.runInInjectionContext(() => new GeodataImportSettingsComponent());
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jasmine.clock().uninstall();
  });

  it('keeps all 135 jobs and puts the running country first', () => {
    const jobs: GeodataImportJob[] = Array.from({ length: 135 }, (_, i) => ({
      jobId: String(i), datasetId: 'country-' + i,
      status: i === 134 ? 'running' : i < 20 ? 'succeeded' : 'queued',
      stage: 'importing', progress: 25, error: null,
      createdAt: '2026-09-23T10:00:00Z', startedAt: null, completedAt: null
    }));
    component.databaseInfo.set({ status: 200, health: { status: 200 }, batchId: 'run', jobs });
    expect(component.importJobs().length).toBe(135);
    expect(component.importJobs()[0].jobId).toBe('134');
    expect(component.runningJobs().map(job => job.jobId)).toEqual(['134']);
    expect(component.completedJobCount()).toBe(20);
    expect(jobs[0].jobId).toBe('0');
  });

  it('updates the active area as processing moves to the next country', () => {
    const job: GeodataImportJob = {
      jobId: 'a', datasetId: 'germany', status: 'running', stage: 'importing',
      progress: 30, error: null, createdAt: '2026-09-23T10:00:00Z', startedAt: null, completedAt: null
    };
    component.databaseInfo.set({ status: 200, health: { status: 200 }, jobs: [job] });
    expect(component.runningJobs().length).toBe(1);
    component.databaseInfo.set({ status: 200, health: { status: 200 }, jobs: [{ ...job, status: 'succeeded' }] });
    expect(component.runningJobs()).toEqual([]);
    expect(component.importJobs().length).toBe(1);
  });

  it('warns on failed polling and restores the live queue on the next successful poll', () => {
    const job: GeodataImportJob = {
      jobId: 'resumed', datasetId: 'germany', status: 'running', stage: 'importing',
      progress: 30, error: null, createdAt: '2026-09-23T10:00:00Z', startedAt: null, completedAt: null
    };
    spyOn(TestBed.inject(GeodataImportService), 'getJobs').and.returnValues(
      throwError(() => new Error('429')),
      of({ status: 200, batchId: 'run', jobs: [job] })
    );
    jasmine.clock().tick(0);
    expect(component.importStatusUnavailable()).toBeTrue();
    jasmine.clock().tick(5000);
    expect(component.importStatusUnavailable()).toBeFalse();
    expect(component.runningJobs().map(value => value.jobId)).toEqual(['resumed']);
  });

  it('uses localized country names and retains a dataset fallback', () => {
    component.catalog.set({ status: 200, categories: {}, datasets: [{
      id: 'germany', label: 'Germany', continentCode: 'EU', continentLabel: 'Europe',
      countryCode: 'DE', countryLabel: 'Germany', regionCode: null, level: 'country'
    }] });
    expect(component.datasetLabel('germany')).toBe('Deutschland');
    expect(component.datasetLabel('unknown')).toBe('unknown');
  });
});
