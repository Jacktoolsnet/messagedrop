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
        { provide: GeodataImportService, useValue: { getSettings: () => EMPTY, getCatalog: () => EMPTY, watchJobs: () => updates, getJobs: () => EMPTY, startImport: () => EMPTY, retryImport: () => EMPTY, getDatabaseInfo: () => EMPTY } },
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
  function failedJob(): GeodataImportJob {
    return { jobId: 'failed', datasetId: 'canada', status: 'failed', stage: 'failed',
      progress: 0, error: 'interrupted', createdAt: '2026-09-23T10:00:00Z', startedAt: null, completedAt: null };
  }

  it('retries only the failed country, blocks double clicks and keeps the other countries', () => {
    const job = failedJob();
    const other = { ...job, jobId: 'other', datasetId: 'germany', status: 'succeeded' as const };
    component.databaseInfo.set({ status: 200, health: { status: 200 }, batchId: 'run', jobs: [job, other] });
    const response = new Subject<{ status: number; job: GeodataImportJob; created: boolean }>();
    const retry = spyOn(TestBed.inject(GeodataImportService), 'retryImport').and.returnValue(response);
    component.retryImport(job);
    component.retryImport(job);
    expect(retry).toHaveBeenCalledOnceWith('failed');
    expect(component.canRetry(job)).toBeFalse();
    response.next({ status: 202, job: { ...job, jobId: 'new', status: 'queued' }, created: true });
    response.complete();
    expect(component.databaseInfo()?.batchId).toBe('run');
    expect(component.importJobs().map(value => value.jobId)).toEqual(['new', 'other']);
    expect(component.retryingDatasets().size).toBe(0);
    expect(component.canRetry(job)).toBeFalse();
  });

  it('keeps failures retryable after an HTTP error and refuses successful jobs', () => {
    const job = failedJob();
    const response = new Subject<{ status: number; job: GeodataImportJob; created: boolean }>();
    const retry = spyOn(TestBed.inject(GeodataImportService), 'retryImport').and.returnValue(response);
    const message = spyOn(TestBed.inject(DisplayMessageService), 'open');
    component.retryImport({ ...job, status: 'succeeded' });
    expect(retry).not.toHaveBeenCalled();
    component.retryImport(job);
    response.error(new Error('offline'));
    expect(component.canRetry(job)).toBeTrue();
    expect(message).toHaveBeenCalled();
  });

  it('does not overwrite a newer live update with the retry response or duplicate the job', () => {
    const job = failedJob();
    const response = new Subject<{ status: number; job: GeodataImportJob; created: boolean }>();
    spyOn(TestBed.inject(GeodataImportService), 'retryImport').and.returnValue(response);
    component.retryImport(job);
    updates.next({ status: 200, batchId: 'run', jobs: [{ ...job, jobId: 'new', status: 'running' }] });
    response.next({ status: 202, job: { ...job, jobId: 'new', status: 'queued' }, created: true });
    response.complete();
    expect(component.importJobs().length).toBe(1);
    expect(component.runningJobs()[0].jobId).toBe('new');
  });

  it('formats download GB, exact short durations and unknown historic metrics honestly', () => {
    expect(component.downloadGb('1500000000')).toBe('1,5 GB');
    expect(component.downloadGb(0)).toBe('0 GB');
    expect(component.downloadGb(null)).toBe('—');
    expect(component.downloadGb(undefined)).toBe('—');
    expect(component.statisticsDuration(5000)).toBe('5 s');
    expect(component.statisticsDuration(3661000)).toBe('1 h 1 min 1 s');
    expect(component.statisticsDuration(0)).toBe('0 s');
    expect(component.statisticsDuration(null)).toBe('—');
  });

  it('updates run statistics over Socket.IO and does not overwrite them with an older health response', () => {
    const stats = { jobCount: 1, downloadedBytes: 1000000000, importedRecords: 100, durationMs: 5000, incomplete: false };
    const response = new Subject<import('../../interfaces/geodata-import.interface').GeodataDatabaseInfo>();
    spyOn(TestBed.inject(GeodataImportService), 'getDatabaseInfo').and.returnValue(response);
    component.loadDatabaseInfo();
    updates.next({ status: 200, batchId: 'run', jobs: [], runStatistics: stats });
    response.next({ status: 200, health: { status: 200 }, jobs: [], runStatistics: { ...stats, importedRecords: 0 } });
    response.complete();
    expect(component.databaseInfo()?.runStatistics).toEqual(stats);
    updates.next({ status: 200, batchId: 'run', jobs: [], runStatistics: { ...stats, importedRecords: 200 } });
    expect(component.databaseInfo()?.runStatistics?.importedRecords).toBe(200);
  });

});
