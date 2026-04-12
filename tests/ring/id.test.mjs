import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateId, slugify, nextIndex } from '../../ring/lib/id.mjs';

describe('id', () => {

  describe('slugify()', () => {
    it('lowercases and replaces spaces', () => {
      assert.equal(slugify('My Feature Name'), 'my-feature-name');
    });

    it('limits to 5 words', () => {
      assert.equal(slugify('one two three four five six seven'), 'one-two-three-four-five');
    });

    it('strips special characters', () => {
      assert.equal(slugify('hello_world! test@123'), 'hello-world-test-123');
    });
  });

  describe('nextIndex()', () => {
    it('returns 1 for empty list', () => {
      assert.equal(nextIndex([], 's'), 1);
    });

    it('returns max + 1', () => {
      assert.equal(nextIndex(['s1-foo', 's3-bar', 's2-baz'], 's'), 4);
    });

    it('ignores non-matching prefixes', () => {
      assert.equal(nextIndex(['t1-foo', 'r2-bar'], 's'), 1);
    });
  });

  describe('generateId()', () => {
    it('generates session id with s-prefix and 3-part format', () => {
      const id = generateId('session', { name: 'Test Session', existingIds: [] });
      assert.ok(id.startsWith('s1-'), `Expected s1- prefix but got: ${id}`);
      assert.ok(id.includes('test-session'), `Expected slug but got: ${id}`);
      // Should have random+date suffix
      assert.ok(id.length > 20);
    });

    it('generates requirement id without random suffix', () => {
      const id = generateId('requirement', { name: 'Dashboard Feature', existingIds: ['r1-old'] });
      assert.equal(id, 'r2-dashboard-feature');
    });

    it('generates milestone id with parent prefix', () => {
      const id = generateId('milestone', { name: 'basic layout', parentId: 'r2-dashboard', existingIds: [] });
      assert.ok(id.startsWith('r2m1-'), `Expected r2m1- prefix but got: ${id}`);
    });

    it('generates task id', () => {
      const id = generateId('task', { name: 'implement sidebar', existingIds: ['t1-old', 't2-older'] });
      assert.equal(id, 't3-implement-sidebar');
    });

    it('generates workflow id with wf- prefix', () => {
      const id = generateId('workflow', { name: 'TDD First' });
      assert.equal(id, 'wf-tdd-first');
    });

    it('generates feedback id with fb- prefix and index', () => {
      const id = generateId('feedback', { name: 'missing criterion', existingIds: ['fb-1-old'] });
      assert.ok(id.startsWith('fb-2-'), `Expected fb-2- prefix but got: ${id}`);
    });

    it('auto-increments based on existing ids', () => {
      const id1 = generateId('session', { name: 'First', existingIds: ['s1-xxx', 's2-yyy'] });
      assert.ok(id1.startsWith('s3-'));
    });
  });
});
