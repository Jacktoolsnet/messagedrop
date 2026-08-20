import { TestBed } from '@angular/core/testing';

import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('decrypts the PIN envelope with the non-extractable derived key', async () => {
    const encrypted = await service.encryptWithPin('123456', 'remember me');

    expect(encrypted.key.extractable).toBeFalse();
    const decrypted = await service.decryptWithKey(encrypted.key, encrypted.envelope);

    expect(decrypted?.plaintext).toBe('remember me');
    expect(decrypted?.iterations).toBe(encrypted.iterations);
  });
});
