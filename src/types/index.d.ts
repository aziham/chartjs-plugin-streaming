import {
  Chart,
  ChartComponent,
  ChartType,
  Plugin,
  TimeScale,
  TimeScaleOptions
} from 'chart.js';

export interface MouseEventObject {
  type: string;
  chart: Chart;
  native: MouseEvent;
  x: number;
  y: number;
}

interface StreamingOptions {
  /**
   * How long data is displayed in milliseconds (default: 10000)
   */
  duration?: number;
  /**
   * Delay before data appears in milliseconds (default: 0)
   */
  delay?: number;
  /**
   * Animation frame rate (default: 30)
   */
  frameRate?: number;
  /**
   * Data refresh interval in milliseconds (default: 1000)
   */
  refresh?: number;
  /**
   * Callback function for data updates
   */
  onRefresh?: (this: RealTimeScale, chart: Chart) => void | null;
  /**
   * Pause streaming (default: false)
   */
  pause?: boolean;
  /**
   * Time-to-live for data points in milliseconds (default: undefined)
   */
  ttl?: number;
}

export type RealTimeScaleOptions = TimeScaleOptions & {
  realtime: StreamingOptions;
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RealTimeScale<
  O extends RealTimeScaleOptions = RealTimeScaleOptions
> extends TimeScale<O> {}

export const RealTimeScale: ChartComponent & {
  prototype: RealTimeScale;
  new <O extends RealTimeScaleOptions = RealTimeScaleOptions>(
    cfg: Record<string, unknown>
  ): RealTimeScale<O>;
};

declare module 'chart.js' {
  interface CartesianScaleTypeRegistry {
    realtime: {
      options: RealTimeScaleOptions;
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    /**
     * Per chart streaming plugin options.
     */
    streaming?: StreamingOptions;
  }

  enum UpdateModeEnum {
    quiet = 'quiet'
  }
}

declare const registerables: ChartComponent[];

export const StreamingPlugin: Plugin;
export default registerables;
