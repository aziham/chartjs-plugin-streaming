import { Scale } from 'chart.js';
import {
  callback as call,
  noop,
  requestAnimFrame,
  valueOrDefault
} from 'chart.js/helpers';

export function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), upper);
}

export function resolveOption<T = any>(scale: Scale, key: string): T {
  const realtimeOpts = (scale.options as any).realtime;
  const streamingOpts = scale.chart.options.plugins?.streaming;
  return valueOrDefault<T>(realtimeOpts?.[key], (streamingOpts as any)?.[key]);
}

/**
 * Validates streaming configuration options and provides warnings for invalid values
 */
export function validateOptions(scale: Scale): void {
  if (typeof console !== 'undefined' && console.warn) {
    const duration = resolveOption<number>(scale, 'duration');
    const delay = resolveOption<number>(scale, 'delay');
    const frameRate = resolveOption<number>(scale, 'frameRate');
    const refresh = resolveOption<number>(scale, 'refresh');

    if (typeof duration !== 'number' || duration <= 0) {
      console.warn('Chart streaming: duration should be a positive number');
    }

    if (typeof delay !== 'number') {
      console.warn('Chart streaming: delay should be a number');
    }

    if (typeof frameRate !== 'number' || frameRate <= 0) {
      console.warn('Chart streaming: frameRate should be a positive number');
    }

    if (typeof refresh !== 'number' || refresh <= 0) {
      console.warn('Chart streaming: refresh should be a positive number');
    }
  }
}

interface AxisMap {
  [key: string]: { axisId: string };
}

export function getAxisMap(
  element: any,
  { x, y }: { x: string[]; y: string[] },
  { xAxisID, yAxisID }: { xAxisID: string; yAxisID: string }
): AxisMap {
  const axisMap: AxisMap = {};

  // Optimize by directly iterating arrays instead of using each function
  for (let i = 0, ilen = x.length; i < ilen; ++i) {
    axisMap[x[i]] = { axisId: xAxisID };
  }
  for (let i = 0, ilen = y.length; i < ilen; ++i) {
    axisMap[y[i]] = { axisId: yAxisID };
  }
  return axisMap;
}

/**
 * Cancel animation polyfill
 */
const cancelAnimFrame = (function () {
  if (typeof window === 'undefined') {
    return noop;
  }
  return window.cancelAnimationFrame;
})();

interface TimerContext {
  frameRequestID?: number;
  nextRefresh?: number;
  refreshTimerID?: number | NodeJS.Timeout;
  refreshInterval?: number;
}

export function startFrameRefreshTimer(
  context: TimerContext,
  func: () => number
): void {
  if (!context.frameRequestID) {
    const refresh = () => {
      // Skip processing when document is not visible (tab is not active),
      // but still call requestAnimationFrame to keep the loop running
      if (typeof document !== 'undefined' && document.hidden) {
        context.frameRequestID = requestAnimFrame.call(window, refresh);
        return;
      }

      const nextRefresh = context.nextRefresh || 0;
      const now = Date.now();

      if (nextRefresh <= now) {
        const newFrameRate = call(func, [], context) as number;
        const frameDuration = 1000 / (Math.max(newFrameRate, 0) || 30);
        const newNextRefresh = (context.nextRefresh || 0) + frameDuration || 0;

        context.nextRefresh =
          newNextRefresh > now ? newNextRefresh : now + frameDuration;
      }
      context.frameRequestID = requestAnimFrame.call(window, refresh);
    };
    context.frameRequestID = requestAnimFrame.call(window, refresh);
  }
}

export function stopFrameRefreshTimer(context: TimerContext): void {
  const frameRequestID = context.frameRequestID;

  if (frameRequestID) {
    cancelAnimFrame.call(window, frameRequestID);
    delete context.frameRequestID;
  }
}

export function stopDataRefreshTimer(context: TimerContext): void {
  const refreshTimerID = context.refreshTimerID;

  if (refreshTimerID) {
    clearInterval(refreshTimerID as number);
    delete context.refreshTimerID;
    delete context.refreshInterval;
  }
}

export function startDataRefreshTimer(
  context: TimerContext,
  func: () => number,
  interval?: number
): void {
  if (!context.refreshTimerID) {
    context.refreshTimerID = setInterval(() => {
      // Skip processing if document is not visible (tab is not active)
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      const newInterval = call(func, [], context) as number;

      if (context.refreshInterval !== newInterval && !isNaN(newInterval)) {
        stopDataRefreshTimer(context);
        startDataRefreshTimer(context, func, newInterval);
      }
    }, interval || 0);
    context.refreshInterval = interval || 0;
  }
}
