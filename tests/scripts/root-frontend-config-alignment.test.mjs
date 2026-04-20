import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const viteConfig = readFileSync(resolve(repoRoot, 'vite.config.ts'), 'utf-8');
const tsconfig = JSON.parse(readFileSync(resolve(repoRoot, 'tsconfig.json'), 'utf-8'));
const indexHtml = readFileSync(resolve(repoRoot, 'index.html'), 'utf-8');

describe('root frontend config alignment', () => {
  it('points the root vite config at apps/operator-web instead of ring-gui', () => {
    assert.match(viteConfig, /root:\s*[\s\S]*apps\/operator-web/);
    assert.doesNotMatch(viteConfig, /ring-gui/);
  });

  it('points the root tsconfig at operator-web sources instead of ring-gui', () => {
    assert.equal(tsconfig.extends, './apps/operator-web/tsconfig.json');
    assert.deepEqual(tsconfig.include, [
      'apps/operator-web/src',
      'apps/operator-web/vite.config.ts',
      'vite.config.ts',
    ]);
  });

  it('removes the legacy ring-gui entrypoint from the root html shell', () => {
    assert.doesNotMatch(indexHtml, /ring-gui/);
    assert.match(indexHtml, /dp-ring v2 Operator Console/);
    assert.match(indexHtml, /src="\/src\/main\.tsx"/);
  });
});
