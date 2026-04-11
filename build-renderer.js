const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Ensure output directories exist
const outDir = path.join(__dirname, 'dist', 'renderer');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Copy HTML and CSS
fs.copyFileSync(
  path.join(__dirname, 'src', 'renderer', 'index.html'),
  path.join(outDir, 'index.html')
);
fs.copyFileSync(
  path.join(__dirname, 'src', 'renderer', 'styles.css'),
  path.join(outDir, 'styles.css')
);

// Bundle renderer TypeScript
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'renderer', 'app.ts')],
  bundle: true,
  outfile: path.join(outDir, 'app.js'),
  platform: 'browser',
  target: 'chrome108',
  sourcemap: true,
  external: ['electron'],
});

// Bundle main process (inlines @claude-usage/shared e zod)
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'main.ts')],
  bundle: true,
  outfile: path.join(distDir, 'main.js'),
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['electron', 'electron-store'],
});

// Bundle preload
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'preload.ts')],
  bundle: true,
  outfile: path.join(distDir, 'preload.js'),
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['electron'],
});

console.log('Renderer built successfully.');
