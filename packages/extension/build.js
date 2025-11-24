import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const distDir = join(__dirname, 'dist');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Build configuration
const buildConfig = {
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production',
  target: 'es2022',
  format: 'esm',
  platform: 'browser',
  external: [],
};

// Build background script (includes oauth.ts as a module)
await build({
  ...buildConfig,
  entryPoints: [join(__dirname, 'src', 'background.ts')],
  outfile: join(distDir, 'background.js'),
  bundle: true,
});

// Build content script
await build({
  ...buildConfig,
  entryPoints: [join(__dirname, 'src', 'content.ts')],
  outfile: join(distDir, 'content.js'),
});

// Build popup script
await build({
  ...buildConfig,
  entryPoints: [join(__dirname, 'src', 'popup.ts')],
  outfile: join(distDir, 'popup.js'),
});

// Build sidepanel script
await build({
  ...buildConfig,
  entryPoints: [join(__dirname, 'src', 'sidepanel.ts')],
  outfile: join(distDir, 'sidepanel.js'),
});

// Copy static files
copyFileSync(join(__dirname, 'manifest.json'), join(distDir, 'manifest.json'));
copyFileSync(join(__dirname, 'src', 'popup.html'), join(distDir, 'popup.html'));
copyFileSync(
  join(__dirname, 'src', 'sidepanel.html'),
  join(distDir, 'sidepanel.html')
);

// Create icons directory and placeholder icons
const iconsDir = join(distDir, 'icons');
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

console.log('✓ Extension built successfully');
