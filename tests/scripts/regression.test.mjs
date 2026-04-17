import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegressionSteps } from '../../scripts/regression.mjs';

describe('regression script step planning', () => {
  it('inserts operator-web dependency bootstrap before v2 checks when app deps are missing', () => {
    const labels = buildRegressionSteps({ operatorWebDepsInstalled: false }).map(([label]) => label);

    assert.deepEqual(labels, [
      'Lint frontend/backend sources',
      'Typecheck frontend TypeScript',
      'Install v2 operator console dependencies',
      'Typecheck the v2 operator console',
      'Build the v2 operator console',
      'Run backend and CLI tests',
      'Run frontend state regression tests',
    ]);
  });

  it('skips operator-web dependency bootstrap when app deps are already installed', () => {
    const labels = buildRegressionSteps({ operatorWebDepsInstalled: true }).map(([label]) => label);

    assert.deepEqual(labels, [
      'Lint frontend/backend sources',
      'Typecheck frontend TypeScript',
      'Typecheck the v2 operator console',
      'Build the v2 operator console',
      'Run backend and CLI tests',
      'Run frontend state regression tests',
    ]);
  });
});
