import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, inject } from '@angular/core';

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
  @Input() throttleMs = 48;

  private ro?: ResizeObserver;
  private gridEl: HTMLElement | null = null;
  private gridMetrics?: { rowGap: number; rowUnitPx: number };
  private span = 0;
  private lastReflowAt = 0;
  private lastObservedHeight = -1;
  private destroyed = false;
  private imgLoadListeners: (() => void)[] = [];
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private static instances = new Set<MasonryItemDirective>();
  private static dirtyInstances = new Set<MasonryItemDirective>();
  private static windowResizeAttached = false;
  private static flushRafId?: number;

  private static readonly onWindowResize = () => {
    for (const instance of MasonryItemDirective.instances) {
      instance.invalidateGridMetrics();
      instance.scheduleReflow(true);
    }
  };

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      MasonryItemDirective.instances.add(this);
      MasonryItemDirective.attachWindowResizeListener();

      this.gridEl = this.closestGrid(this.el.nativeElement);

      // Observe size changes of this tile (content growth/shrink)
      this.ro = new ResizeObserver((entries) => {
        const nextHeight = entries[0]?.contentRect?.height ?? this.el.nativeElement.offsetHeight;
        if (Math.abs(nextHeight - this.lastObservedHeight) < 0.5) {
          return;
        }
        this.lastObservedHeight = nextHeight;
        this.scheduleReflow();
      });
      this.ro.observe(this.el.nativeElement);

      // Reflow when images inside finish loading (optional)
      if (this.reflowOnImagesLoaded) {
        this.hookImageLoads();
      }

      // Initial pass
      queueMicrotask(() => this.scheduleReflow(true));
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.ro?.disconnect();
    this.imgLoadListeners.forEach(off => off());
    this.imgLoadListeners = [];
    MasonryItemDirective.instances.delete(this);
    MasonryItemDirective.dirtyInstances.delete(this);
    MasonryItemDirective.detachWindowResizeListenerIfUnused();
  }

  /** Attach load listeners to images within the tile to trigger reflow once natural sizes are known. */
  private hookImageLoads(): void {
    const item = this.el.nativeElement;
    const imgs = Array.from(item.querySelectorAll('img'));
    imgs.forEach(img => {
      // If already complete (from cache), still schedule a reflow
      if ((img as HTMLImageElement).complete) {
        this.scheduleReflow(true);
        return;
      }
      const onLoad = () => this.scheduleReflow(true);
      img.addEventListener('load', onLoad, { passive: true });
      img.addEventListener('error', onLoad, { passive: true });
      this.imgLoadListeners.push(() => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onLoad);
      });
    });
  }

  /** Batch reflow calls using rAF and an optional throttle window. */
  private scheduleReflow(force = false): void {
    if (this.destroyed) return;
    const now = performance.now();
    if (!force && now - this.lastReflowAt < this.throttleMs) return;
    MasonryItemDirective.enqueue(this);
  }

  /** Core measurement and span calculation. */
  private reflow(): void {
    if (this.destroyed) return;
    const item = this.el.nativeElement;

    let grid = this.gridEl;
    if (!grid || !grid.isConnected) {
      grid = this.closestGrid(item);
      this.gridEl = grid;
      this.gridMetrics = undefined;
    }
    if (!grid) return;

    if (!this.gridMetrics) {
      const gridCS = getComputedStyle(grid);
      const rowGap = this.parsePx(gridCS.rowGap) ?? 0;
      let rowUnitPx =
        this.parsePx(gridCS.gridAutoRows) ??
        (typeof this.rowUnitPx === 'number' ? this.rowUnitPx : undefined);

      if (rowUnitPx == null) {
        const varVal = gridCS.getPropertyValue('--masonry-row-height').trim();
        const num = Number(varVal || '8');
        rowUnitPx = Number.isFinite(num) && num > 0 ? num : 8;
      }

      this.gridMetrics = { rowGap, rowUnitPx };
    }

    const { rowGap, rowUnitPx } = this.gridMetrics;
    const full = item.offsetHeight;
    if (full <= 0) return;

    // Compute the number of grid rows to span:
    // span = ceil((height + rowGap) / (rowUnitPx + rowGap))
    const nextSpan = Math.max(1, Math.ceil((full + rowGap) / (rowUnitPx + rowGap)));

    // Apply as grid-row-end
    if (nextSpan !== this.span) {
      this.span = nextSpan;
      item.style.gridRowEnd = `span ${nextSpan}`;
    }

    this.lastReflowAt = performance.now();
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

  private invalidateGridMetrics(): void {
    this.gridMetrics = undefined;
  }

  private static attachWindowResizeListener(): void {
    if (this.windowResizeAttached) return;
    window.addEventListener('resize', this.onWindowResize, { passive: true });
    this.windowResizeAttached = true;
  }

  private static detachWindowResizeListenerIfUnused(): void {
    if (!this.windowResizeAttached || this.instances.size > 0) return;
    window.removeEventListener('resize', this.onWindowResize);
    this.windowResizeAttached = false;
  }

  private static enqueue(instance: MasonryItemDirective): void {
    this.dirtyInstances.add(instance);
    if (this.flushRafId != null) return;
    this.flushRafId = requestAnimationFrame(() => {
      this.flushRafId = undefined;
      const queued = Array.from(this.dirtyInstances);
      this.dirtyInstances.clear();
      queued.forEach((entry) => entry.reflow());
    });
  }
}
