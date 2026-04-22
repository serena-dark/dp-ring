import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  callbackSignaturePayload,
  computeCallbackSignature,
  signedWorkflowRunHeaders,
} from '../../ring/lib/workflow-run-callback.mjs';

describe('workflow-run callback signing', () => {
  const workflowRun = {
    data: {
      callback: {
        token: 'token-123',
        signing_secret: 'secret-456',
        key_version: 7,
      },
    },
  };

  it('normalizes empty payloads through the shared signature payload helper', () => {
    const timestamp = '2026-04-22T05:02:00.000Z';
    assert.equal(callbackSignaturePayload(timestamp), `${timestamp}.{}`);
    assert.equal(callbackSignaturePayload(timestamp, null), `${timestamp}.{}`);

    const headers = signedWorkflowRunHeaders(workflowRun, undefined, { timestamp });
    assert.equal(headers.headers.authorization, 'Bearer token-123');
    assert.equal(headers.headers['x-ring-timestamp'], timestamp);
    assert.equal(
      headers.headers['x-ring-signature'],
      `sha256=${computeCallbackSignature('secret-456', timestamp, undefined)}`,
    );
    assert.equal(headers.headers['x-ring-key-version'], undefined);
    assert.equal(headers.headers['x-ring-worker-id'], undefined);
  });

  it('can include worker identity and key version in the shared signed headers', () => {
    const payload = { status: 'completed' };
    const timestamp = '2026-04-22T05:03:00.000Z';
    const headers = signedWorkflowRunHeaders(workflowRun, payload, {
      timestamp,
      workerId: 'worker-agent',
      includeKeyVersion: true,
    });

    assert.equal(headers.headers['x-ring-worker-id'], 'worker-agent');
    assert.equal(headers.headers['x-ring-key-version'], '7');
    assert.equal(
      headers.headers['x-ring-signature'],
      `sha256=${computeCallbackSignature('secret-456', timestamp, payload)}`,
    );
  });
});
