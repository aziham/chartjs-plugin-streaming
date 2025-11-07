import packageJson from '@/../package.json';
import { getAxisMap } from '@/helpers/helpers.streaming';
import {
  attachChart as annotationAttachChart,
  detachChart as annotationDetachChart
} from '@/plugins/plugin.annotation';
import { update as tooltipUpdate } from '@/plugins/plugin.tooltip';
import {
  attachChart as zoomAttachChart,
  detachChart as zoomDetachChart
} from '@/plugins/plugin.zoom';
import RealTimeScale from '@/scales/scale.realtime';
import type { MouseEventObject } from '@/types';
import { Chart, DatasetController, defaults, registry } from 'chart.js';
import {
  clipArea,
  each,
  getRelativePosition,
  noop,
  unclipArea
} from 'chart.js/helpers';

const version = packageJson.version;

interface StreamingContext {
  render: (chart: Chart) => void;
  canvas: HTMLCanvasElement;
  mouseEventListener: (event: MouseEvent) => void;
  visibilityChangeListener?: () => void;
  lastMouseEvent?: MouseEventObject;
  annotationPlugin?: any;
  zoomPlugin?: any;
  resetZoom?: any;
}

defaults.set('transitions', {
  quiet: {
    animation: {
      duration: 0
    }
  }
});

const transitionKeys = { x: ['x', 'cp1x', 'cp2x'], y: ['y', 'cp1y', 'cp2y'] };

function update(this: Chart, mode: string): void {
  const me = this;

  if (mode === 'quiet') {
    each(me.data.datasets, (dataset: any, datasetIndex: number) => {
      const controller = me.getDatasetMeta(datasetIndex).controller;

      // check if valid
      if (!controller) {
        return;
      }

      // Set transition mode to 'quiet'
      (controller as any)._setStyle = function (
        element: any,
        index: number,
        _mode: string,
        active: boolean
      ) {
        (DatasetController.prototype as any)._setStyle.call(
          this,
          element,
          index,
          'quiet' as any,
          active
        );
      };
    });
  }

  Chart.prototype.update.call(me, mode as any);

  if (mode === 'quiet') {
    each(me.data.datasets, (dataset: any, datasetIndex: number) => {
      const controller = me.getDatasetMeta(datasetIndex).controller;
      if (controller) {
        delete (controller as any)._setStyle;
      }
    });
  }
}

function render(chart: Chart): void {
  const streaming = (chart as any).$streaming as StreamingContext;

  chart.render();

  if (streaming.lastMouseEvent) {
    setTimeout(() => {
      const lastMouseEvent = streaming.lastMouseEvent;
      if (lastMouseEvent) {
        (chart as any)._eventHandler(lastMouseEvent);
      }
    }, 0);
  }
}

export default {
  id: 'streaming',

  version,

  beforeInit(chart: Chart) {
    const streaming = ((chart as any).$streaming = (chart as any)
      .$streaming || { render });
    const canvas = (streaming.canvas = chart.canvas);
    const mouseEventListener = (streaming.mouseEventListener = (
      event: MouseEvent
    ) => {
      const pos = getRelativePosition(event, chart);
      streaming.lastMouseEvent = {
        type: 'mousemove',
        chart: chart,
        native: event,
        x: pos.x,
        y: pos.y
      };
    });

    canvas.addEventListener('mousedown', mouseEventListener);
    canvas.addEventListener('mouseup', mouseEventListener);

    // Add visibility change listener to handle tab switching
    if (typeof document !== 'undefined' && document.addEventListener) {
      const visibilityChangeListener = () => {
        if (!document.hidden) {
          // When tab becomes visible again, update all real-time scales to avoid delay
          const scales = chart.scales;
          if (scales) {
            Object.keys(scales).forEach((key) => {
              const scale = scales[key];
              if (scale && scale instanceof RealTimeScale) {
                // Update the scale's head time to current time to avoid delay
                if (scale.$realtime) {
                  scale.$realtime.head = Date.now();
                }
              }
            });
          }
        }
      };

      document.addEventListener('visibilitychange', visibilityChangeListener);
      // Store the listener for cleanup
      streaming.visibilityChangeListener = visibilityChangeListener;
    }
  },

  afterInit(chart: Chart) {
    (chart as any).update = update;
  },

  beforeUpdate(chart: Chart) {
    const { scales, elements } = chart.options;
    const tooltip = chart.tooltip;

    if (scales) {
      each(scales, (scaleOptions: any) => {
        // scaleOptions can be any since it's part of chart config
        if (scaleOptions?.type === 'realtime') {
          // Allow Bézier control to be outside the chart
          if (elements) {
            (elements as any).line.capBezierPoints = false;
          }
        }
      });
    }

    if (tooltip) {
      (tooltip as any).update = tooltipUpdate;
    }

    try {
      const plugin = registry.getPlugin('annotation');
      if (plugin) {
        annotationAttachChart(plugin, chart);
      }
    } catch (e) {
      annotationDetachChart(chart);
    }

    try {
      const plugin = registry.getPlugin('zoom');
      if (plugin) {
        zoomAttachChart(plugin, chart);
      }
    } catch (e) {
      zoomDetachChart(chart);
    }
  },

  beforeDatasetUpdate(chart: Chart, args: { meta: any; mode: string }) {
    const { meta, mode } = args;

    if (mode === 'quiet') {
      const { controller, $animations } = meta;

      // Skip updating element options if show/hide transition is active
      if ($animations && $animations.visible && $animations.visible._active) {
        (controller as any).updateElement = noop;
        (controller as any).updateSharedOptions = noop;
      }
    }
  },

  afterDatasetUpdate(chart: Chart, args: { meta: any; mode: string }) {
    const { meta, mode } = args;
    const { data: elements = [], dataset: element, controller } = meta;

    for (let i = 0, ilen = elements.length; i < ilen; ++i) {
      elements[i].$streaming = getAxisMap(elements[i], transitionKeys, meta);
    }
    if (element) {
      element.$streaming = getAxisMap(element, transitionKeys, meta);
    }

    if (mode === 'quiet') {
      delete (controller as any).updateElement;
      delete (controller as any).updateSharedOptions;
    }
  },

  beforeDatasetDraw(
    chart: Chart,
    args: { meta: { xAxisID: string; yAxisID: string; controller: any } }
  ) {
    const { ctx, chartArea, width, height } = chart;
    const { xAxisID, yAxisID, controller } = args.meta;
    const area = {
      left: 0,
      top: 0,
      right: width,
      bottom: height
    };

    if (xAxisID && controller.getScaleForId(xAxisID) instanceof RealTimeScale) {
      area.left = chartArea.left;
      area.right = chartArea.right;
    }
    if (yAxisID && controller.getScaleForId(yAxisID) instanceof RealTimeScale) {
      area.top = chartArea.top;
      area.bottom = chartArea.bottom;
    }
    clipArea(ctx, area);
  },

  afterDatasetDraw(chart: Chart) {
    unclipArea(chart.ctx);
  },

  beforeEvent(chart: Chart, args: { event: MouseEventObject }) {
    const streaming = (chart as any).$streaming as StreamingContext;
    const event = args.event;

    if (event?.type === 'mousemove') {
      // Save mousemove event for reuse
      streaming.lastMouseEvent = event;
    } else if (event?.type === 'mouseout') {
      // Remove mousemove event
      delete streaming.lastMouseEvent;
    }
  },

  afterDestroy(chart: Chart) {
    const { scales, tooltip } = chart;
    const streaming = (chart as any).$streaming as StreamingContext;
    const { canvas, mouseEventListener, visibilityChangeListener } = streaming;

    delete (chart as any).update;
    if (tooltip) {
      delete (tooltip as any).update;
    }

    canvas.removeEventListener('mousedown', mouseEventListener);
    canvas.removeEventListener('mouseup', mouseEventListener);

    // Remove visibility change listener
    if (
      visibilityChangeListener &&
      typeof document !== 'undefined' &&
      document.removeEventListener
    ) {
      document.removeEventListener(
        'visibilitychange',
        visibilityChangeListener
      );
    }

    each(scales, (scale: any) => {
      if (scale instanceof RealTimeScale) {
        scale.destroy();
      }
    });
  },

  defaults: {
    duration: 10000,
    delay: 0,
    frameRate: 30,
    refresh: 1000,
    onRefresh: null,
    pause: false,
    ttl: undefined
  },

  descriptors: {
    _scriptable: (name: string) => name !== 'onRefresh'
  }
};
