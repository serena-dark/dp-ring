import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRing } from '../../ring/index.mjs';
import {
  createPublicationMemberDescriptor,
  createPublicationRoot,
} from '../../ring/lib/publication-root.mjs';
import {
  createValidationReportArtifact,
  createValidationResultArtifact,
} from '../../ring/lib/validation-artifacts.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');

describe('ring public API', async () => {
  const ring = await createRing(repoRoot);

  it('exposes publication root helpers', () => {
    assert.deepEqual(Object.keys(ring.publicationRoot).sort(), [
      'createPublicationMemberDescriptor',
      'createPublicationRoot',
    ]);
    assert.equal(ring.publicationRoot.createPublicationMemberDescriptor, createPublicationMemberDescriptor);
    assert.equal(ring.publicationRoot.createPublicationRoot, createPublicationRoot);
  });

  it('exposes validation artifact helpers', () => {
    assert.deepEqual(Object.keys(ring.validationArtifacts).sort(), [
      'createValidationReportArtifact',
      'createValidationResultArtifact',
    ]);
    assert.equal(ring.validationArtifacts.createValidationReportArtifact, createValidationReportArtifact);
    assert.equal(ring.validationArtifacts.createValidationResultArtifact, createValidationResultArtifact);
  });
});
