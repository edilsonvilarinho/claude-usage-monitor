const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Ensure output directories exist
const outDir = path.join(__dirname, 'dist', 'renderer');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// ── HTML Include Resolution ────────────────────────────────────────────────────

function resolveIncludes(html, baseDir, seen = new Set()) {
  const re = /([ \t]*)<!--\s*@include\s+(.+?)\s*-->/g;
  return html.replace(re, (_, indent, relPath) => {
    const abs = path.resolve(baseDir, relPath.trim());
    if (seen.has(abs)) throw new Error(`Circular include: ${abs}`);
    seen.add(abs);
    const raw = fs.readFileSync(abs, 'utf8');
    const includedBaseDir = path.dirname(abs);
    const indented = raw.split('\n').map((l, i) => i === 0 ? l : indent + l).join('\n');
    return resolveIncludes(indented, includedBaseDir, seen);
  });
}

// Copy HTML with include resolution
const srcIndex = path.join(__dirname, 'src', 'renderer', 'index.html');
const rawHtml = fs.readFileSync(srcIndex, 'utf8');
const resolved = resolveIncludes(rawHtml, path.dirname(srcIndex));
fs.writeFileSync(path.join(outDir, 'index.html'), resolved);

// Copy CSS
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

// Bundle test preload (somente para testes E2E — não incluído no installer)
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'preload-test.ts')],
  bundle: true,
  outfile: path.join(distDir, 'preload-test.js'),
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['electron'],
});

console.log('Renderer built successfully.');
