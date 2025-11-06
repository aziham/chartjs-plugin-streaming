import {
  resolveOption,
  startDataRefreshTimer,
  startFrameRefreshTimer,
  stopDataRefreshTimer,
  stopFrameRefreshTimer
} from '@/helpers/helpers.streaming';
import { getElements } from '@/plugins/plugin.annotation';
import { defaults, TimeScale } from 'chart.js';
import {
  _lookup,
  callback as call,
  clipArea,
  each,
  isArray,
  isFinite,
  isNumber,
  noop,
  unclipArea
} from 'chart.js/helpers';

interface TimerContext {
  frameRequestID?: number;
  nextRefresh?: number;
  refreshTimerID?: number;
  refreshInterval?: number;
}

interface Interval {
  common: boolean;
  size: number;
  steps?: number[];
}

interface Intervals {
  [key: string]: Interval;
}

// Ported from Chart.js 2.8.0 35273ee.
const INTERVALS: Intervals = {
  millisecond: {
    common: true,
    size: 1,
    steps: [1, 2, 5, 10, 20, 50, 100, 250, 500]
  },
  second: {
    common: true,
    size: 1000,
    steps: [1, 2, 5, 10, 15, 30]
  },
  minute: {
    common: true,
    size: 60000,
    steps: [1, 2, 5, 10, 15, 30]
  },
  hour: {
    common: true,
    size: 3600000,
    steps: [1, 2, 3, 6, 12]
  },
  day: {
    common: true,
    size: 86400000,
    steps: [1, 2, 5]
  },
  week: {
    common: false,
    size: 604800000,
    steps: [1, 2, 3, 4]
  },
  month: {
    common: true,
    size: 2.628e9,
    steps: [1, 2, 3]
  },
  quarter: {
    common: false,
    size: 7.884e9,
    steps: [1, 2, 3, 4]
  },
  year: {
    common: true,
    size: 3.154e10
  }
};

// Ported from Chart.js 2.8.0 35273ee.
const UNITS = Object.keys(INTERVALS);

// Ported from Chart.js 2.8.0 35273ee.
function determineStepSize(
  min: number,
  max: number,
  unit: string,
  capacity: number
): number {
  const range = max - min;
  const interval = INTERVALS[unit];
  if (!interval) return 1;
  const { size: milliseconds, steps } = interval;
  let factor: number = 1;

  if (!steps) {
    return Math.ceil(range / (capacity * milliseconds));
  }

  for (let i = 0, ilen = steps.length; i < ilen; ++i) {
    factor = steps[i];
    if (Math.ceil(range / (milliseconds * factor)) <= capacity) {
      break;
    }
  }

  return factor || 1;
}

// Ported from Chart.js 2.8.0 35273ee.
function determineUnitForAutoTicks(
  minUnit: string,
  min: number,
  max: number,
  capacity: number
): string {
  const range = max - min;
  const ilen = UNITS.length;

  for (let i = UNITS.indexOf(minUnit); i < ilen - 1; ++i) {
    const unit = UNITS[i];
    const interval = INTERVALS[unit];
    if (!interval) continue;
    const { common, size, steps } = interval;
    const factor = steps ? steps[steps.length - 1] : Number.MAX_SAFE_INTEGER;

    if (common && Math.ceil(range / (factor * size)) <= capacity) {
      return unit;
    }
  }

  return UNITS[ilen - 1];
}

// Ported from Chart.js 2.8.0 35273ee.
function determineMajorUnit(unit: string): string | undefined {
  for (let i = UNITS.indexOf(unit) + 1, ilen = UNITS.length; i < ilen; ++i) {
    const unitName = UNITS[i];
    if (INTERVALS[unitName]?.common) {
      return unitName;
    }
  }
  return undefined;
}

// Ported from Chart.js 3.2.0 e1404ac.
function addTick(
  ticks: { [key: string]: boolean },
  time: number,
  timestamps?: number[]
): void {
  if (!timestamps) {
    ticks[time] = true;
  } else if (timestamps.length) {
    const { lo, hi } = _lookup(timestamps, time);
    const timestamp = timestamps[lo] >= time ? timestamps[lo] : timestamps[hi];
    ticks[timestamp] = true;
  }
}

const datasetPropertyKeys = [
  'pointBackgroundColor',
  'pointBorderColor',
  'pointBorderWidth',
  'pointRadius',
  'pointRotation',
  'pointStyle',
  'pointHitRadius',
  'pointHoverBackgroundColor',
  'pointHoverBorderColor',
  'pointHoverBorderWidth',
  'pointHoverRadius',
  'backgroundColor',
  'borderColor',
  'borderSkipped',
  'borderWidth',
  'hoverBackgroundColor',
  'hoverBorderColor',
  'hoverBorderWidth',
  'hoverRadius',
  'hitRadius',
  'radius',
  'rotation'
];

interface RemovalRange {
  start: number;
  count: number;
}

function clean(scale: any): void {
  const { chart, id, max } = scale;
  const duration = resolveOption(scale, 'duration');
  const delay = resolveOption(scale, 'delay');
  const ttl = resolveOption(scale, 'ttl');
  const pause = resolveOption(scale, 'pause');
  const min = Date.now() - (isNaN(ttl) ? duration + delay : ttl);
  let i: number,
    start: number,
    count: number,
    removalRange: RemovalRange | undefined;

  // Remove old data
  each(chart.data.datasets, (dataset: any, datasetIndex: number) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    const axis = (id === meta.xAxisID && 'x') || (id === meta.yAxisID && 'y');

    if (axis) {
      const controller = meta.controller;
      const data = dataset.data;
      const length = data.length;

      if (pause) {
        // If the scale is paused, preserve the visible data points
        for (i = 0; i < length; ++i) {
          const point = controller.getParsed(i);
          if (point && !(point[axis] < max)) {
            break;
          }
        }
        start = i + 2;
      } else {
        start = 0;
      }

      for (i = start; i < length; ++i) {
        const point = controller.getParsed(i);
        if (!point || !(point[axis] <= min)) {
          break;
        }
      }
      count = i - start;
      if (isNaN(ttl)) {
        // Keep the last two data points outside the range not to affect the existing bezier curve
        count = Math.max(count - 2, 0);
      }

      data.splice(start, count);
      each(datasetPropertyKeys, (key: string) => {
        if (isArray(dataset[key])) {
          (dataset[key] as any[]).splice(start, count);
        }
      });
      each((dataset as any).datalabels, (value: any) => {
        if (isArray(value)) {
          value.splice(start, count);
        }
      });
      if (typeof data[0] !== 'object') {
        removalRange = {
          start: start,
          count: count
        };
      }

      each(
        (chart as any)._active,
        (item: any, index: number) => {
          if (item.datasetIndex === datasetIndex && item.index >= start) {
            if (item.index >= start + count) {
              item.index -= count;
            } else {
              (chart as any)._active.splice(index, 1);
            }
          }
        },
        null,
        true
      );
    }
  });
  if (removalRange) {
    chart.data.labels.splice(removalRange.start, removalRange.count);
  }
}

function transition(element: any, id: string, translate: number): void {
  const animations = element.$animations || {};

  each((element as any).$streaming, (item: any, key: string) => {
    if (item.axisId === id) {
      const delta = item.reverse ? -translate : translate;
      const animation = animations[key];

      if (isFinite(element[key])) {
        element[key] -= delta;
      }
      if (animation) {
        animation._from -= delta;
        animation._to -= delta;
      }
    }
  });
}

function scroll(scale: any): void {
  const { chart, id, $realtime: realtime } = scale;
  const duration = resolveOption(scale, 'duration');
  const delay = resolveOption(scale, 'delay');
  const isHorizontal = scale.isHorizontal();
  const length = isHorizontal ? scale.width : scale.height;
  const now = Date.now();
  const tooltip = chart.tooltip;
  const annotations = getElements(chart);
  let offset = (length * (now - realtime.head)) / duration;

  if (isHorizontal === !!scale.options.reverse) {
    offset = -offset;
  }

  // Shift all the elements leftward or downward
  each(chart.data.datasets, (dataset: any, datasetIndex: number) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    const { data: elements = [], dataset: element } = meta;

    for (let i = 0, ilen = elements.length; i < ilen; ++i) {
      transition(elements[i], id, offset);
    }
    if (element) {
      transition(element, id, offset);
      delete element._path;
    }
  });

  // Shift all the annotation elements leftward or downward
  for (let i = 0, ilen = annotations.length; i < ilen; ++i) {
    transition(annotations[i], id, offset);
  }

  // Shift tooltip leftward or downward
  if (tooltip) {
    transition(tooltip, id, offset);
  }

  scale.max = now - delay;
  scale.min = scale.max - duration;

  realtime.head = now;
}

interface RealTimeContext extends TimerContext {
  head?: number;
}

export default class RealTimeScale extends TimeScale {
  $realtime: RealTimeContext;

  constructor(props: any) {
    super(props);
    this.$realtime = {};
  }

  init(scaleOpts: any, opts?: any): void {
    const me = this;

    (super.init as any).call(me, scaleOpts);
    startDataRefreshTimer(me.$realtime, () => {
      const chart = me.chart;
      const onRefresh = resolveOption(me, 'onRefresh');

      call(onRefresh, [chart], me as any);
      clean(me as any);
      chart.update('quiet');
      return resolveOption(me as any, 'refresh');
    });
  }

  update(maxWidth: any, maxHeight: any, margins: any): void {
    const me = this;
    const { $realtime: realtime, options } = me;
    const { bounds, offset, ticks: ticksOpts } = options;
    const { autoSkip, source, major: majorTicksOpts } = ticksOpts;
    const majorEnabled = majorTicksOpts.enabled;

    if (resolveOption(me as any, 'pause')) {
      stopFrameRefreshTimer(realtime);
    } else {
      if (!realtime.frameRequestID) {
        realtime.head = Date.now();
      }
      startFrameRefreshTimer(realtime, () => {
        const chart = me.chart;
        const streaming = (chart as any).$streaming;

        scroll(me as any);
        if (streaming) {
          call(streaming.render, [chart]);
        }
        return resolveOption(me as any, 'frameRate');
      });
    }

    (options as any).bounds = undefined;
    (options as any).offset = false;
    (ticksOpts as any).autoSkip = false;
    (ticksOpts as any).source = source === 'auto' ? '' : source;
    (majorTicksOpts as any).enabled = true;

    (super.update as any).call(me, maxWidth, maxHeight, margins);

    (options as any).bounds = bounds;
    (options as any).offset = offset;
    (ticksOpts as any).autoSkip = autoSkip;
    (ticksOpts as any).source = source;
    (majorTicksOpts as any).enabled = majorEnabled;
  }

  buildTicks(): any[] {
    const me = this;
    const duration = resolveOption(me as any, 'duration');
    const delay = resolveOption(me as any, 'delay');
    const max = me.$realtime.head! - delay;
    const min = max - duration;
    const maxArray = [1e15, max];
    const minArray = [-1e15, min];

    Object.defineProperty(me, 'min', {
      get: () => minArray.shift(),
      set: noop,
      configurable: true
    });
    Object.defineProperty(me, 'max', {
      get: () => maxArray.shift(),
      set: noop,
      configurable: true
    });

    const ticks = (super.buildTicks as any).call(me);

    delete (me as any).min;
    delete (me as any).max;
    me.min = min;
    me.max = max;

    return ticks;
  }

  calculateLabelRotation(): void {
    const ticksOpts = this.options.ticks;
    const maxRotation = ticksOpts.maxRotation;

    (ticksOpts as any).maxRotation = ticksOpts.minRotation || 0;
    (super.calculateLabelRotation as any).call(this);
    (ticksOpts as any).maxRotation = maxRotation;
  }

  fit(): void {
    const me = this;
    const options = me.options;

    (super.fit as any).call(me);

    if (options.ticks.display && options.display && me.isHorizontal()) {
      me.paddingLeft = 3;
      me.paddingRight = 3;
      (me as any)._handleMargins();
    }
  }

  draw(chartArea: any): void {
    const me = this;
    const { chart, ctx } = me;
    const area = me.isHorizontal()
      ? {
          left: chartArea.left,
          top: 0,
          right: chartArea.right,
          bottom: chart.height
        }
      : {
          left: 0,
          top: chartArea.top,
          right: chart.width,
          bottom: chartArea.bottom
        };

    (me as any)._gridLineItems = null;
    (me as any)._labelItems = null;

    // Clip and draw the scale
    clipArea(ctx, area);
    (super.draw as any).call(me, chartArea);
    unclipArea(ctx);
  }

  destroy(): void {
    const realtime = this.$realtime;

    stopFrameRefreshTimer(realtime);
    stopDataRefreshTimer(realtime);
  }

  _generate(): number[] {
    const me = this;
    const adapter = (me as any)._adapter;
    const duration = resolveOption(me, 'duration');
    const delay = resolveOption(me, 'delay');
    const refresh = resolveOption(me, 'refresh');
    const max = me.$realtime.head! - delay;
    const min = max - duration;
    const capacity = (me as any)._getLabelCapacity(min);
    const { time: timeOpts, ticks: ticksOpts } = me.options;
    const minor =
      timeOpts.unit ||
      determineUnitForAutoTicks(timeOpts.minUnit, min, max, capacity);
    const major = determineMajorUnit(minor);
    const stepSize =
      (timeOpts as any).stepSize ||
      determineStepSize(min, max, minor, capacity);
    const weekday = minor === 'week' ? timeOpts.isoWeekday : false;
    const majorTicksEnabled = ticksOpts.major.enabled;
    const hasWeekday = isNumber(weekday) || weekday === true;
    const interval = INTERVALS[minor];
    const ticks: { [key: string]: boolean } = {};
    let first = min;
    let time: number, count: number;

    // For 'week' unit, handle the first day of week option
    if (hasWeekday) {
      first = +adapter.startOf(first, 'isoWeek', weekday);
    }

    // Align first ticks on unit
    first = +adapter.startOf(first, hasWeekday ? 'day' : minor);

    // Prevent browser from freezing in case user options request millions of milliseconds
    if (adapter.diff(max, min, minor) > 100000 * stepSize) {
      throw new Error(
        min +
          ' and ' +
          max +
          ' are too far apart with stepSize of ' +
          stepSize +
          ' ' +
          minor
      );
    }

    time = first;

    if (majorTicksEnabled && major && !hasWeekday && !timeOpts.round) {
      // Align the first tick on the previous `minor` unit aligned on the `major` unit:
      // we first aligned time on the previous `major` unit then add the number of full
      // stepSize there is between first and the previous major time.
      time = +adapter.startOf(time, major);
      time = +adapter.add(
        time,
        ~~((first - time) / (interval.size * stepSize)) * stepSize,
        minor
      );
    }

    const timestamps =
      ticksOpts.source === 'data' && (me as any).getDataTimestamps();
    for (
      count = 0;
      time < max + refresh;
      time = +adapter.add(time, stepSize, minor), count++
    ) {
      addTick(ticks, time, timestamps);
    }

    if (time === max + refresh || count === 1) {
      addTick(ticks, time, timestamps);
    }

    return Object.keys(ticks)
      .sort((a, b) => +a - +b)
      .map((x) => +x) as any[];
  }
}

RealTimeScale.id = 'realtime';

RealTimeScale.defaults = {
  bounds: 'data',
  adapters: {},
  time: {
    parser: false, // false == a pattern string from or a custom callback that converts its argument to a timestamp
    unit: false, // false == automatic or override with week, month, year, etc.
    round: false, // none, or override with week, month, year, etc.
    isoWeekday: false, // override week start day - see http://momentjs.com/docs/#/get-set/iso-weekday/
    minUnit: 'millisecond',
    displayFormats: {}
  },
  realtime: {},
  ticks: {
    autoSkip: false,
    source: 'auto',
    major: {
      enabled: true
    }
  }
};

defaults.describe('scale.realtime', {
  _scriptable: (name: string) => name !== 'onRefresh'
});
