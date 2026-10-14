export interface RenderSchedulerOptions {
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  isHidden?: () => boolean;
  subscribeVisibility?: (listener: () => void) => () => void;
}

export interface RenderScheduler { invalidate(): void; setAnimating(active: boolean): void; dispose(): void }

/** Coalesces static invalidations to one paint and runs a loop only while animation is active. */
export function createRenderScheduler(render: (timestampMs: number) => void, options: RenderSchedulerOptions = {}): RenderScheduler {
  const request = options.requestFrame ?? ((callback: FrameRequestCallback) => requestAnimationFrame(callback));
  const cancel = options.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle));
  const hidden = options.isHidden ?? (() => typeof document !== 'undefined' && document.hidden);
  const subscribe = options.subscribeVisibility ?? ((listener: () => void) => {
    if (typeof document === 'undefined') return () => undefined;
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  });
  let frameHandle: number | null = null;
  let dirty = false;
  let animating = false;
  let disposed = false;

  const schedule = (): void => {
    if (disposed || frameHandle !== null || hidden() || (!dirty && !animating)) return;
    frameHandle = request(timestampMs => {
      frameHandle = null;
      if (disposed || hidden()) return;
      if (dirty || animating) render(timestampMs);
      dirty = false;
      if (animating) dirty = true;
      schedule();
    });
  };
  const onVisibility = (): void => {
    if (hidden()) {
      if (frameHandle !== null) cancel(frameHandle);
      frameHandle = null;
    } else schedule();
  };
  const unsubscribeVisibility = subscribe(onVisibility);

  return {
    invalidate() { dirty = true; schedule(); },
    setAnimating(active) { animating = active; if (active) dirty = true; schedule(); },
    dispose() { disposed = true; unsubscribeVisibility(); if (frameHandle !== null) cancel(frameHandle); frameHandle = null; },
  };
}
