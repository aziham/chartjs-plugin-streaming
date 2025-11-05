# chartjs-plugin-streaming

[![npm](https://img.shields.io/npm/v/chartjs-plugin-streaming.svg?style=flat-square)](https://www.npmjs.com/package/@aziham/chartjs-plugin-streaming) [![GitHub Workflow Status](https://img.shields.io/github/workflow/status/aziham/chartjs-plugin-streaming/CI?style=flat-square)](https://github.com/aziham/chartjs-plugin-streaming/actions?query=workflow%3ACI+branch%3Amaster) [![Awesome](https://awesome.re/badge-flat2.svg)](https://github.com/chartjs/awesome)

*[Chart.js](https://www.chartjs.org) plugin for live streaming data - Built with TypeScript*

Forked from https://github.com/nagix/chartjs-plugin-streaming because it appears to be unmaintained.

chartjs-plugin-streaming 3.x requires Chart.js 4.5.1 or later and is now written in TypeScript for better type safety and developer experience. If you need Chart.js 2.x support, use the following versions.

- For Chart.js 2.9.x, 2.8.x or 2.7.x, use [version 1.9.0](https://github.com/nagix/chartjs-plugin-streaming/releases/tag/v1.9.0)
- For Chart.js 2.6.x, use [version 1.2.0](https://github.com/nagix/chartjs-plugin-streaming/releases/tag/v1.2.0)
- For Chart.js 4.x, use [version 3.2.0](https://github.com/aziham/chartjs-plugin-streaming) or later

## Development

You first need to install node dependencies (requires [Node.js](https://nodejs.org/)):

```bash
npm install
```

Start the development server to see a live Windows Task Manager demo:

```bash
npm run dev
```

This launches a comprehensive Windows 10-style Task Manager interface demonstrating:
- Real-time CPU, Memory, Disk, Network, GPU, and Temperature monitoring
- Live streaming charts with smooth animations
- Dynamic process list with resource usage
- Responsive design with modern UI
- Multiple tabs (Performance, Processes, App History, Startup)

The following commands are available from the repository root:

```bash
npm run dev        # start development server with live demo
npm run build      # build TypeScript source to dist files
npm run build:dev  # build and watch for changes
```

## License

chartjs-plugin-streaming is available under the [MIT license](https://opensource.org/licenses/MIT).
