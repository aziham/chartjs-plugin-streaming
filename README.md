# @aziham/chartjs-plugin-streaming

[![npm](https://img.shields.io/npm/v/@aziham/chartjs-plugin-streaming.svg?style=flat-square)](https://www.npmjs.com/package/@aziham/chartjs-plugin-streaming) [![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT) [![Awesome](https://awesome.re/badge-flat2.svg)](https://github.com/chartjs/awesome)

[Chart.js](https://www.chartjs.org) plugin for live streaming data with real-time data visualization.

![Demo Screenshot](assets/demo.gif)

## About This Fork

This is a modernized fork of the original [chartjs-plugin-streaming](https://github.com/nagix/chartjs-plugin-streaming) by nagix, which appears to be unmaintained. This version includes:

- **TypeScript migration** for better type safety and developer experience
- **Modern build system** with Vite for faster builds
- **Simplified project structure** with 96% fewer dependencies
- **Multiple build formats** (UMD and ES modules) with source maps

## Requirements

- **Chart.js 4.5.1** or later
- **Node.js 24.11.0** (tested version, may work with earlier versions)
- **Modern browser** with ES2020 support

## Installation

```bash
# npm
npm install @aziham/chartjs-plugin-streaming

# yarn
yarn add @aziham/chartjs-plugin-streaming

# pnpm
pnpm add @aziham/chartjs-plugin-streaming
```

## Usage

For comprehensive documentation and examples, see the [original documentation](https://nagix.github.io/chartjs-plugin-streaming/master/guide/).

## Development

### Quick Start

```bash
# Clone and setup
git clone https://github.com/aziham/chartjs-plugin-streaming.git
cd chartjs-plugin-streaming
npm install

# Start development server with demo
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start development server with demo
npm run build        # Build distribution files (UMD, ES)
```

### Demo

The project includes a real-time streaming demo that runs at `http://localhost:5173/` when you run `npm run dev`.

### Testing Locally

```bash
# Build and create package
npm run build
npm pack

# Install in your test project / replace {version-number}
npm install ./aziham-chartjs-plugin-streaming-{version-number}.tgz
```
