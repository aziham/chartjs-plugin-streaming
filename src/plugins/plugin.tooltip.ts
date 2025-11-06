import { getAxisMap } from '@/helpers/helpers.streaming';

const transitionKeys = { x: ['x', 'caretX'], y: ['y', 'caretY'] };

export function update(this: any, ...args: any[]): void {
  const me = this;
  const element = me.getActiveElements()[0];

  if (element) {
    // 2023.01.04
    // const meta = me._chart.getDatasetMeta(element.datasetIndex);
    const meta = me.chart.getDatasetMeta(element.datasetIndex);

    me.$streaming = getAxisMap(me, transitionKeys, meta);
  } else {
    me.$streaming = {};
  }

  me.constructor.prototype.update.call(me, ...args);
}
