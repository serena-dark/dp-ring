import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegressionSteps } from '../../scripts/regression.mjs';

describe('regression script step planning', () => {
  it('inserts operator-web dependency bootstrap before v2 checks when app deps are missing', () => {
    const labels = buildRegressionSteps({
      operatorWebDepsInstalled: false,
      cargoCommand: '/mock/cargo',
    }).map(([label]) => label);

    assert.deepEqual(labels, [
      'Lint frontend/backend sources',
      'Typecheck frontend TypeScript',
      'Install v2 operator console dependencies',
      'Typecheck the v2 operator console',
      'Build the v2 operator console',
      'Compile the v2 control-api service',
      'Run backend and CLI tests',
      'Run frontend state regression tests',
    ]);
  });

  it('skips operator-web dependency bootstrap and rust checks when toolchains are unavailable', () => {
    const labels = buildRegressionSteps({
      operatorWebDepsInstalled: true,
      cargoCommand: null,
    }).map(([label]) => label);

    assert.deepEqual(labels, [
      'Lint frontend/backend sources',
      'Typecheck frontend TypeScript',
      'Typecheck the v2 operator console',
      'Build the v2 operator console',
      'Run backend and CLI tests',
      'Run frontend state regression tests',
    ]);
  });

  it('runs a dedicated control-api cargo check when rust is available', () => {
    const steps = buildRegressionSteps({
      operatorWebDepsInstalled: true,
      cargoCommand: '/mock/cargo',
    });

    assert.deepEqual(steps[4], [
      'Compile the v2 control-api service',
      '/mock/cargo',
      ['check', '-p', 'control-api'],
    ]);
  });
});
