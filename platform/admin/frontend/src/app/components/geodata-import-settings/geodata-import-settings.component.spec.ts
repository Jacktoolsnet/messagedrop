import { TestBed } from '@angular/core/testing';
import { EMPTY, of, Subject, throwError } from 'rxjs';
import { GeodataImportSettingsComponent } from './geodata-import-settings.component';
import { GeodataImportJob } from '../../interfaces/geodata-import.interface';
import { GeodataImportService } from '../../services/geodata-import.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { TranslationHelperService } from '../../services/translation-helper.service';

describe('Geodata import run display', () => {
  let component: GeodataImportSettingsComponent;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 23));
    TestBed.configureTestingModule({
      providers: [
        { provide: GeodataImportService, useValue: { getSettings: () => EMPTY, getCatalog: () => EMPTY, getJobs: () => EMPTY, startImport: () => EMPTY, getDatabaseInfo: () => EMPTY } },
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
    jasmine.clock().tick(30000);
    expect(component.importStatusUnavailable()).toBeFalse();
    expect(component.runningJobs().map(value => value.jobId)).toEqual(['resumed']);
  });

  it('polls once per minute when idle and switches back to five seconds for active jobs', () => {
    const job: GeodataImportJob = {
      jobId: 'a', datasetId: 'germany', status: 'queued', stage: 'queued',
      progress: 0, error: null, createdAt: '2026-09-23T10:00:00Z', startedAt: null, completedAt: null
    };
    const getJobs = spyOn(TestBed.inject(GeodataImportService), 'getJobs').and.returnValues(
      of({ status: 200, batchId: 'run', jobs: [] }),
      of({ status: 200, batchId: 'run', jobs: [job] }),
      of({ status: 200, batchId: 'run', jobs: [{ ...job, status: 'succeeded' }] }),
      of({ status: 200, batchId: 'run', jobs: [] })
    );
    jasmine.clock().tick(0);
    expect(getJobs).toHaveBeenCalledTimes(1);
    jasmine.clock().tick(59999);
    expect(getJobs).toHaveBeenCalledTimes(1);
    jasmine.clock().tick(1);
    expect(getJobs).toHaveBeenCalledTimes(2);
    jasmine.clock().tick(5000);
    expect(getJobs).toHaveBeenCalledTimes(3);
    jasmine.clock().tick(59999);
    expect(getJobs).toHaveBeenCalledTimes(3);
    jasmine.clock().tick(1);
    expect(getJobs).toHaveBeenCalledTimes(4);
  });

  it('refreshes immediately when an import is started during the idle interval', () => {
    const service = TestBed.inject(GeodataImportService);
    const started = new Subject<{ status: number; jobs: unknown[] }>();
    spyOn(service, 'startImport').and.returnValue(started);
    const getJobs = spyOn(service, 'getJobs').and.returnValue(of({ status: 200, batchId: null, jobs: [] }));
    jasmine.clock().tick(0);
    expect(getJobs).toHaveBeenCalledTimes(1);
    component.enabledCategories.set(new Set(['tourism']));
    component.selectedSubcategories.set({ tourism: ['museum'] });
    component.startImport();
    expect(getJobs).toHaveBeenCalledTimes(2);
    started.next({ status: 202, jobs: [] });
    started.complete();
    expect(getJobs).toHaveBeenCalledTimes(3);
  });

  it('does not overlap slow requests and stops polling on destruction', () => {
    const pending = new Subject<{ status: number; batchId: string | null; jobs: GeodataImportJob[] }>();
    const getJobs = spyOn(TestBed.inject(GeodataImportService), 'getJobs').and.returnValue(pending);
    jasmine.clock().tick(60000);
    expect(getJobs).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    expect(pending.observed).toBeFalse();
    jasmine.clock().tick(60000);
    expect(getJobs).toHaveBeenCalledTimes(1);
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
