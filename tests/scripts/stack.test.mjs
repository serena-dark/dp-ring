import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePidList, parseSsPidOutput } from '../../scripts/stack.mjs';

describe('stack script parsing helpers', () => {
  it('parsePidList reads numeric lsof output and ignores blanks', () => {
    assert.deepEqual(parsePidList('123\n456\n\n'), [123, 456]);
  });

  it('parsePidList ignores non-decimal tokens instead of coercing them into pids', () => {
    assert.deepEqual(parsePidList('123\n1e3\n0x10\n12.0\n+7\nabc\n'), [123]);
  });

  it('parseSsPidOutput extracts unique listener pids from ss output', () => {
    const sample = [
      'State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess',
      'LISTEN 0      511 127.0.0.1:3100 0.0.0.0:* users:(("node",pid=111,fd=23),("node",pid=111,fd=24),("helper",pid=222,fd=8))',
    ].join('\n');

    assert.deepEqual(parseSsPidOutput(sample), [111, 222]);
  });

  it('parseSsPidOutput returns an empty list when no pid markers exist', () => {
    assert.deepEqual(parseSsPidOutput('State Recv-Q Send-Q\n'), []);
  });
});
