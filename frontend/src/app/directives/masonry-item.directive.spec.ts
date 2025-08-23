import { MasonryItemDirective } from './masonry-item.directive';

describe('MasonryItem', () => {
  it('should create an instance', () => {
    const mockElementRef = { nativeElement: document.createElement('div') } as any;
    const mockNgZone = { run: (fn: Function) => fn() } as any;
    const directive = new MasonryItemDirective(mockElementRef, mockNgZone);
    expect(directive).toBeTruthy();
  });
});
