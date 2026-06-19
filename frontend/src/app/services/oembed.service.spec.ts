import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OembedService } from './oembed.service';
import { TranslationHelperService } from './translation-helper.service';
import { MultimediaType } from '../interfaces/multimedia-type';

describe('OembedService', () => {
  let service: OembedService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: TranslationHelperService, useValue: { t: (_key: string, params?: { platform?: string }) => `Powered by ${params?.platform ?? ''}` } }
      ]
    });
    service = TestBed.inject(OembedService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('keeps TikTok oEmbed content for short URLs when no cite URL is present', async () => {
    const resultPromise = service.getObjectFromUrl('https://vm.tiktok.com/ZGdHgC5cb/');

    const request = httpMock.expectOne((req) =>
      req.urlWithParams.includes('/utils/oembed')
      && req.urlWithParams.includes(`provider=${encodeURIComponent('https://www.tiktok.com/oembed')}`)
      && req.urlWithParams.includes(`url=${encodeURIComponent('https://vm.tiktok.com/ZGdHgC5cb/')}`)
    );
    request.flush({
      status: 200,
      result: {
        html: '<blockquote class="tiktok-embed">TikTok content</blockquote>',
        provider_name: 'TikTok',
        provider_url: 'https://www.tiktok.com/',
        type: 'rich',
        version: '1.0'
      }
    });

    const result = await resultPromise;
    expect(service.isMultimedia(result)).toBeTrue();
    if (!service.isMultimedia(result)) {
      fail('Expected TikTok multimedia');
      return;
    }
    expect(result.type).toBe(MultimediaType.TIKTOK);
    expect(result.sourceUrl).toBe('https://vm.tiktok.com/ZGdHgC5cb/');
    expect(result.oembed?.html).toContain('tiktok-embed');
  });

  it('resolves TikTok short URLs via redirect fallback when oEmbed fails', async () => {
    const resultPromise = service.getObjectFromUrl('https://vm.tiktok.com/ZGdHgC5cb/');

    const oembedRequest = httpMock.expectOne((req) => req.urlWithParams.includes('/utils/oembed'));
    oembedRequest.flush('not found', { status: 404, statusText: 'Not Found' });

    const resolveRequest = httpMock.expectOne((req) =>
      req.url.includes('/utils/resolve/')
      && decodeURIComponent(req.url).includes('https://vm.tiktok.com/ZGdHgC5cb/')
    );
    resolveRequest.flush({
      status: 200,
      result: 'https://www.tiktok.com/@messagedrop/video/7521234567890123456'
    });

    const result = await resultPromise;
    expect(service.isMultimedia(result)).toBeTrue();
    if (!service.isMultimedia(result)) {
      fail('Expected TikTok multimedia');
      return;
    }
    expect(result.type).toBe(MultimediaType.TIKTOK);
    expect(result.contentId).toBe('7521234567890123456');
    expect(result.sourceUrl).toBe('https://www.tiktok.com/@messagedrop/video/7521234567890123456');
    expect(result.oembed?.html).toContain('https://www.tiktok.com/player/v1/7521234567890123456');
  });

  it('creates TikTok player embeds for photo post URLs without resolving the page', async () => {
    const result = await service.getObjectFromUrl('https://www.tiktok.com/@renyu.ix/photo/7567330544715926806?is_from_webapp=1&sender_device=pc');

    expect(service.isMultimedia(result)).toBeTrue();
    if (!service.isMultimedia(result)) {
      fail('Expected TikTok multimedia');
      return;
    }
    expect(result.type).toBe(MultimediaType.TIKTOK);
    expect(result.contentId).toBe('7567330544715926806');
    expect(result.oembed?.html).toContain('https://www.tiktok.com/player/v1/7567330544715926806');
  });
});
