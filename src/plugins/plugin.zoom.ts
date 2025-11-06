import { clamp, resolveOption } from '@/helpers/helpers.streaming';
import { Chart, Scale } from 'chart.js';
import { each } from 'chart.js/helpers';

interface ChartState {
  originalScaleOptions: { [key: string]: { duration: number; delay: number } };
}

const chartStates = new WeakMap<Chart, ChartState>();

function getState(chart: Chart): ChartState {
  let state = chartStates.get(chart);

  if (!state) {
    state = { originalScaleOptions: {} };
    chartStates.set(chart, state);
  }
  return state;
}

function removeState(chart: Chart): void {
  chartStates.delete(chart);
}

function storeOriginalScaleOptions(chart: Chart): {
  [key: string]: { duration: number; delay: number };
} {
  const { originalScaleOptions } = getState(chart);
  const scales = chart.scales;

  each(scales, (scale: Scale) => {
    const id = scale.id;

    if (!originalScaleOptions[id]) {
      originalScaleOptions[id] = {
        duration: resolveOption(scale, 'duration'),
        delay: resolveOption(scale, 'delay')
      };
    }
  });
  each(originalScaleOptions, (opt: any, key: string) => {
    if (!scales || !scales[key]) {
      delete originalScaleOptions[key];
    }
  });
  return originalScaleOptions;
}

interface ZoomLimits {
  [key: string]: {
    minDuration?: number;
    maxDuration?: number;
    minDelay?: number;
    maxDelay?: number;
  };
}

function zoomRealTimeScale(
  scale: Scale,
  zoom: number,
  center: { x: number; y: number },
  limits?: ZoomLimits
): boolean {
  const { chart } = scale;
  const axis = scale.id;
  const {
    minDuration = 0,
    maxDuration = Infinity,
    minDelay = -Infinity,
    maxDelay = Infinity
  } = limits?.[axis] || {};
  const realtimeOpts = (scale.options as any).realtime;
  const duration = resolveOption(scale, 'duration');
  const delay = resolveOption(scale, 'delay');
  const newDuration = clamp(duration * (2 - zoom), minDuration, maxDuration);
  let maxPercent: number, newDelay: number;

  storeOriginalScaleOptions(chart);

  if (scale.isHorizontal()) {
    maxPercent = (scale.right - center.x) / (scale.right - scale.left);
  } else {
    maxPercent = (scale.bottom - center.y) / (scale.bottom - scale.top);
  }
  newDelay = delay + maxPercent * (duration - newDuration);
  realtimeOpts.duration = newDuration;
  realtimeOpts.delay = clamp(newDelay, minDelay, maxDelay);
  return newDuration !== scale.max - scale.min;
}

function panRealTimeScale(
  scale: Scale,
  delta: number,
  limits?: ZoomLimits
): boolean {
  const { chart } = scale;
  const axis = scale.id;
  const { minDelay = -Infinity, maxDelay = Infinity } = limits?.[axis] || {};
  const delay = resolveOption(scale, 'delay');
  const newDelay =
    delay +
    ((scale.getValueForPixel(delta) || 0) - (scale.getValueForPixel(0) || 0));

  storeOriginalScaleOptions(chart);

  (scale.options as any).realtime.delay = clamp(newDelay, minDelay, maxDelay);
  return true;
}

function resetRealTimeScaleOptions(chart: Chart): void {
  const originalScaleOptions = storeOriginalScaleOptions(chart);

  each(chart.scales, (scale: Scale) => {
    const realtimeOptions = (scale.options as any).realtime;

    if (realtimeOptions) {
      const original = originalScaleOptions[scale.id];

      if (original) {
        realtimeOptions.duration = original.duration;
        realtimeOptions.delay = original.delay;
      } else {
        delete realtimeOptions.duration;
        delete realtimeOptions.delay;
      }
    }
  });
}

function initZoomPlugin(plugin: any): void {
  plugin.zoomFunctions.realtime = zoomRealTimeScale;
  plugin.panFunctions.realtime = panRealTimeScale;
}

export function attachChart(plugin: any, chart: Chart): void {
  const streaming = (chart as any).$streaming;

  if (streaming.zoomPlugin !== plugin) {
    const resetZoom = (streaming.resetZoom = (chart as any).resetZoom);

    initZoomPlugin(plugin);
    (chart as any).resetZoom = (transition?: any) => {
      resetRealTimeScaleOptions(chart);
      resetZoom(transition);
    };
    streaming.zoomPlugin = plugin;
  }
}

export function detachChart(chart: Chart): void {
  const streaming = (chart as any).$streaming;

  if (streaming.zoomPlugin) {
    (chart as any).resetZoom = streaming.resetZoom;
    removeState(chart);
    delete streaming.resetZoom;
    delete streaming.zoomPlugin;
  }
}
