import StreamingPlugin from '@/plugins/plugin.streaming';
import RealTimeScale from '@/scales/scale.realtime';
import { Chart } from 'chart.js';

const registerables = [StreamingPlugin, RealTimeScale];

Chart.register(registerables);

// Export for TypeScript users
export { RealTimeScale, StreamingPlugin };
export default registerables;
