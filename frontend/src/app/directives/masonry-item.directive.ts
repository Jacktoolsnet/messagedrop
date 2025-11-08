import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, } from '@angular/core';

@Directive({
  selector: '[appMasonryItem]',
  standalone: true,
})

export class MasonryItemDirective implements AfterViewInit, OnDestroy {
  /** Optional override for row unit in pixels. If not set, we read computed grid-auto-rows. */
  @Input() rowUnitPx?: number;

  /** Reflow when <img> elements inside this tile finish loading. */
  @Input() reflowOnImagesLoaded = true;

  /** Throttle reflows on rapid changes (ms). */
  @Input() throttleMs = 16; // ~1 frame

  private ro?: ResizeObserver;
  private winResizeHandler?: () => void;
  private rafId?: number;
  private lastReflowAt = 0;
  private imgLoadListeners: (() => void)[] = [];

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) { }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      // Observe size changes of this tile (content growth/shrink)
      this.ro = new ResizeObserver(() => this.scheduleReflow());
      this.ro.observe(this.el.nativeElement);

      // Reflow on window resize (breakpoints/columns change)
      this.winResizeHandler = () => this.scheduleReflow();
      window.addEventListener('resize', this.winResizeHandler, { passive: true });

      // Reflow when images inside finish loading (optional)
      if (this.reflowOnImagesLoaded) {
        this.hookImageLoads();
      }

      // Initial passes
      queueMicrotask(() => this.scheduleReflow());
      setTimeout(() => this.scheduleReflow(), 50);
      setTimeout(() => this.scheduleReflow(), 300);
    });
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    if (this.winResizeHandler) {
      window.removeEventListener('resize', this.winResizeHandler);
    }
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.imgLoadListeners.forEach(off => off());
    this.imgLoadListeners = [];
  }

  /** Attach load listeners to images within the tile to trigger reflow once natural sizes are known. */
  private hookImageLoads(): void {
    const item = this.el.nativeElement;
    const imgs = Array.from(item.querySelectorAll('img'));
    imgs.forEach(img => {
      // If already complete (from cache), still schedule a reflow
      if ((img as HTMLImageElement).complete) {
        this.scheduleReflow();
        return;
      }
      const onLoad = () => this.scheduleReflow();
      img.addEventListener('load', onLoad, { passive: true });
      img.addEventListener('error', onLoad, { passive: true });
      this.imgLoadListeners.push(() => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onLoad);
      });
    });
  }

  /** Batch reflow calls using rAF and an optional throttle window. */
  private scheduleReflow(): void {
    const now = performance.now();
    if (now - this.lastReflowAt < this.throttleMs) return;

    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.reflow();
      this.lastReflowAt = performance.now();
      this.rafId = undefined;
    });
  }

  /** Core measurement and span calculation. */
  private reflow(): void {
    const item = this.el.nativeElement;
    const grid = this.closestGrid(item);
    if (!grid) return;

    const gridCS = getComputedStyle(grid);

    // Read row gap (vertical spacing) precisely
    const rowGap = this.parsePx(gridCS.rowGap) ?? 0;

    // Determine the row unit height (in px): prefer computed grid-auto-rows, fallback to input or CSS var
    let rowUnitPx =
      this.parsePx(gridCS.gridAutoRows) ??
      (typeof this.rowUnitPx === 'number' ? this.rowUnitPx : undefined);

    if (rowUnitPx == null) {
      // Fallback to CSS custom property --masonry-row-height (unitless number of px)
      const varVal = gridCS.getPropertyValue('--masonry-row-height').trim();
      const num = Number(varVal || '8');
      rowUnitPx = isFinite(num) && num > 0 ? num : 8;
    }

    // Measure the full tile height (includes padding/border; fine for spanning)
    const full = item.getBoundingClientRect().height;

    // Compute the number of grid rows to span:
    // span = ceil((height + rowGap) / (rowUnitPx + rowGap))
    const span = Math.max(1, Math.ceil((full + rowGap) / (rowUnitPx + rowGap)));

    // Apply as grid-row-end
    item.style.gridRowEnd = `span ${span}`;
  }

  /** Traverse up to find the nearest CSS grid container. */
  private closestGrid(node: HTMLElement): HTMLElement | null {
    let cur: HTMLElement | null = node.parentElement;
    while (cur) {
      const disp = getComputedStyle(cur).display;
      if (disp === 'grid' || disp === 'inline-grid') return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  /** Parse pixel values like "12px" to number; returns null if not parsable. */
  private parsePx(val: string): number | null {
    const m = /([\d.]+)px/.exec(val);
    return m ? parseFloat(m[1]) : null;
  }
}