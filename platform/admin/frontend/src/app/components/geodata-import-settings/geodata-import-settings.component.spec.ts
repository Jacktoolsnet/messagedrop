import { TestBed } from '@angular/core/testing';
import { EMPTY, Subject } from 'rxjs';
import { GeodataImportSettingsComponent } from './geodata-import-settings.component';
import { GeodataImportJob, GeodataImportJobsResponse } from '../../interfaces/geodata-import.interface';
import { GeodataImportService } from '../../services/geodata-import.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { TranslationHelperService } from '../../services/translation-helper.service';

describe('Geodata import run display', () => {
  let component: GeodataImportSettingsComponent;
  let updates: Subject<GeodataImportJobsResponse | null>;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 23));
    updates = new Subject<GeodataImportJobsResponse | null>();
    TestBed.configureTestingModule({
      providers: [
        { provide: GeodataImportService, useValue: { getSettings: () => EMPTY, getCatalog: () => EMPTY, watchJobs: () => updates, getJobs: () => EMPTY, startImport: () => EMPTY, getDatabaseInfo: () => EMPTY } },
        { provide: DisplayMessageService, useValue: { open: () => undefined } },
        { provide: TranslationHelperService, useValue: { lang: () => 'de', t: (value: string) => value } }
      ]
    });
    component = TestBed.runInInjectionContext(() => new GeodataImportSettingsComponent());
    component.onTabChanged(3);
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

  it('shows disconnected state and replaces stale data after reconnection', () => {
    updates.next(null);
    expect(component.importStatusUnavailable()).toBeTrue();
    updates.next({ status: 200, batchId: 'run', jobs: [{
      jobId: 'resumed', datasetId: 'germany', status: 'running', stage: 'importing',
      progress: 30, error: null, createdAt: '2026-09-23T10:00:00Z', startedAt: null, completedAt: null
    }] });
    expect(component.importStatusUnavailable()).toBeFalse();
    expect(component.runningJobs().map(value => value.jobId)).toEqual(['resumed']);
  });

  it('does not poll while idle or active and releases its subscription on leaving', () => {
    const getJobs = spyOn(TestBed.inject(GeodataImportService), 'getJobs');
    jasmine.clock().tick(600000);
    expect(getJobs).not.toHaveBeenCalled();
    expect(updates.observed).toBeTrue();
    TestBed.resetTestingModule();
    expect(updates.observed).toBeFalse();
  });

  it('subscribes only while the database tab is visible', () => {
    expect(updates.observed).toBeTrue();
    component.onTabChanged(0);
    expect(updates.observed).toBeFalse();
    component.onTabChanged(3);
    expect(updates.observed).toBeTrue();
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
