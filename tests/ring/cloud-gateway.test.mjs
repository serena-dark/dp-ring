import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCloudGateway,
  resolveGatewayPreference,
} from '../../ring/lib/cloud-gateway.mjs';

describe('cloud gateway', async () => {
  it('falls back to the secondary provider when the preferred provider is unavailable', async () => {
    const calls = [];
    const gateway = createCloudGateway({
      preference: 'auto',
      primary: {
        async getStatus() {
          return {
            provider: 'openai',
            responses: {
              available: false,
            },
          };
        },
      },
      fallback: {
        async getStatus() {
          return {
            provider: 'kimi',
            responses: {
              available: true,
            },
          };
        },
        async completeText(args) {
          calls.push(args);
          return {
            provider: 'kimi',
            output_text: 'hello from kimi',
          };
        },
      },
    });

    const result = await gateway.completeText({
      instructions: 'Say hello.',
      input: 'demo',
    });
    const status = await gateway.getStatus();

    assert.equal(result.provider, 'kimi');
    assert.equal(result.output_text, 'hello from kimi');
    assert.equal(status.selected_provider, 'kimi');
    assert.equal(calls.length, 1);
  });

  it('honors an explicit kimi preference without probing openai status', async () => {
    let primaryStatusCalls = 0;
    const gateway = createCloudGateway({
      preference: 'kimi',
      primary: {
        async getStatus() {
          primaryStatusCalls += 1;
          throw new Error('primary status should not be probed');
        },
        async completeJson() {
          return {
            provider: 'openai',
            parsed: { source: 'openai' },
          };
        },
      },
      fallback: {
        async getStatus() {
          return {
            provider: 'kimi',
            responses: {
              available: true,
            },
          };
        },
        async completeJson() {
          return {
            provider: 'kimi',
            parsed: { source: 'kimi' },
          };
        },
      },
    });

    const result = await gateway.completeJson({
      instructions: 'Return JSON.',
      input: '{}',
      schemaName: 'demo',
      schema: {
        type: 'object',
        properties: {
          source: { type: 'string' },
        },
      },
    });
    const status = await gateway.getStatus();

    assert.deepEqual(result.parsed, {
      source: 'kimi',
    });
    assert.equal(status.selected_provider, 'kimi');
    assert.equal(status.primary, null);
    assert.equal(primaryStatusCalls, 0);
  });

  it('does not fall back to kimi when openai is explicitly requested and unavailable', async () => {
    const gateway = createCloudGateway({
      preference: 'openai',
      primary: {
        async getStatus() {
          return {
            provider: 'openai',
            responses: {
              available: false,
            },
          };
        },
      },
      fallback: {
        async getStatus() {
          return {
            provider: 'kimi',
            responses: {
              available: true,
            },
          };
        },
      },
    });

    await assert.rejects(
      gateway.completeText({ instructions: 'Say hello.', input: 'demo' }),
      /No cloud gateway is available/,
    );
  });

  it('does not probe kimi status when openai is explicitly requested and unavailable', async () => {
    let fallbackStatusCalls = 0;
    const gateway = createCloudGateway({
      preference: 'openai',
      primary: {
        async getStatus() {
          return {
            provider: 'openai',
            responses: {
              available: false,
            },
          };
        },
      },
      fallback: {
        async getStatus() {
          fallbackStatusCalls += 1;
          throw new Error('fallback status should not be probed');
        },
      },
    });

    await assert.rejects(
      gateway.completeText({ instructions: 'Say hello.', input: 'demo' }),
      (error) => {
        assert.equal(error.message, 'No cloud gateway is available.');
        assert.equal(error.details?.preference, 'openai');
        assert.equal(error.details?.status?.selected_provider, null);
        assert.equal(error.details?.status?.primary?.provider, 'openai');
        assert.equal(error.details?.status?.fallback, null);
        assert.equal(error.details?.probe_errors, undefined);
        assert.equal(fallbackStatusCalls, 0);
        return true;
      },
    );
  });

  it('normalizes supported environment preferences and skips invalid overrides', () => {
    assert.equal(
      resolveGatewayPreference({
        DP_RING_REMOTE_AGENT_PROVIDER: 'unsupported',
        DP_RING_CLOUD_PROVIDER: '  AUTO  ',
      }),
      'auto',
    );

    assert.equal(
      resolveGatewayPreference({
        DP_RING_REMOTE_AGENT_PROVIDER: '  KIMI  ',
        DP_RING_CLOUD_PROVIDER: 'openai',
      }),
      'kimi',
    );

    assert.equal(resolveGatewayPreference({}), 'openai');
  });

  it('treats status probe failures as unavailable and still uses a healthy fallback in auto mode', async () => {
    const gateway = createCloudGateway({
      preference: '  AUTO ',
      primary: {
        async getStatus() {
          throw new Error('primary probe failed');
        },
        async completeText() {
          throw new Error('primary should not be selected');
        },
      },
      fallback: {
        async getStatus() {
          return {
            provider: 'kimi',
            responses: {
              available: true,
            },
          };
        },
        async completeText() {
          return {
            provider: 'kimi',
            output_text: 'hello from kimi',
          };
        },
      },
    });

    const result = await gateway.completeText({
      instructions: 'Say hello.',
      input: 'demo',
    });
    const status = await gateway.getStatus();

    assert.equal(result.provider, 'kimi');
    assert.equal(status.preference, 'auto');
    assert.equal(status.selected_provider, 'kimi');
    assert.equal(status.primary, null);
  });

  it('reports the selected provider from the current status snapshot without rechecking it', async () => {
    let primaryStatusCalls = 0;
    const gateway = createCloudGateway({
      preference: 'auto',
      primary: {
        async getStatus() {
          primaryStatusCalls += 1;
          if (primaryStatusCalls > 1) {
            throw new Error('primary status was fetched more than once');
          }
          return {
            provider: 'openai',
            responses: {
              available: true,
            },
          };
        },
      },
      fallback: {
        async getStatus() {
          return {
            provider: 'kimi',
            responses: {
              available: false,
            },
          };
        },
      },
    });

    const status = await gateway.getStatus();

    assert.equal(status.selected_provider, 'openai');
    assert.equal(primaryStatusCalls, 1);
  });
});
