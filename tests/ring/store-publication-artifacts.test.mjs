import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { cpSync } from 'node:fs';
import { createValidator } from '../../ring/lib/validator.mjs';
import { createStore } from '../../ring/lib/store.mjs';
import { createSubjectDescriptor } from '../../ring/lib/governance-statement.mjs';
import {
  createPublicationMemberDescriptor,
  createPublicationRoot,
} from '../../ring/lib/publication-root.mjs';
import {
  createValidationReportArtifact,
  createValidationResultArtifact,
} from '../../ring/lib/validation-artifacts.mjs';

function buildValidationResultFields() {
  return {
    id: 'vres-store-test',
    status: 'recorded',
    created_by: 'test',
    session_id: 's1-store-test',
    data: {
      report_id: 'vrpt-store-test',
      subject_ref: {
        type: 'checkpoint',
        id: 'cp-root',
      },
      subject_location: '/data/publication_statements/0',
      rule_id: 'checkpoint-publication-shape',
      rule_location: '#/properties/data/required/6',
      severity: 'violation',
      message: 'publication_statements entry is missing a required field.',
      detail_result_ids: [],
    },
  };
}

describe('store publication/validation artifact mappings', async () => {
  let tempDir;
  let ringDir;
  let config;
  let store;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-store-publication-test-'));
    ringDir = join(tempDir, '.ring');
    cpSync(resolve(import.meta.dirname, '../../.ring/schemas'), join(ringDir, 'schemas'), { recursive: true });
    cpSync(resolve(import.meta.dirname, '../../.ring/config.json'), join(ringDir, 'config.json'));

    config = JSON.parse(await readFile(join(ringDir, 'config.json'), 'utf-8'));
    for (const subdirectory of Object.values(config.artifact_directories)) {
      await mkdir(join(ringDir, subdirectory), { recursive: true });
    }

    const validator = await createValidator(ringDir);
    store = createStore(ringDir, validator, config);
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('registers publication/validation artifact types and directory mappings in config', () => {
    assert.ok(config.artifact_types.includes('publication-root'));
    assert.ok(config.artifact_types.includes('validation-report'));
    assert.ok(config.artifact_types.includes('validation-result'));

    assert.equal(config.artifact_directories['publication-root'], 'publication-roots');
    assert.equal(config.artifact_directories['validation-report'], 'validation-reports');
    assert.equal(config.artifact_directories['validation-result'], 'validation-results');

    assert.equal(store.dirFor('publication-root'), join(ringDir, 'publication-roots'));
    assert.equal(store.dirFor('validation-report'), join(ringDir, 'validation-reports'));
    assert.equal(store.dirFor('validation-result'), join(ringDir, 'validation-results'));
  });

  it('creates and reads a validation-result artifact through the configured directory mapping', async () => {
    const result = await store.create('validation-result', buildValidationResultFields());
    assert.equal(result.ok, true, JSON.stringify(result.errors));

    const raw = await readFile(join(ringDir, 'validation-results', 'vres-store-test.json'), 'utf-8');
    const onDisk = JSON.parse(raw);
    assert.equal(onDisk.id, 'vres-store-test');

    const artifact = await store.read('validation-result', 'vres-store-test');
    assert.equal(artifact.type, 'validation-result');
    assert.equal(artifact.data.rule_id, 'checkpoint-publication-shape');
  });

  it('writes helper-built publication and validation artifacts through the configured mappings', async () => {
    const validationResult = createValidationResultArtifact({
      id: 'vres-helper-store-test',
      created_by: 'store-helper-test',
      session_id: 's1-store-helper-test',
      data: {
        report_id: 'vrpt-helper-store-test',
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-root',
        },
        subject_location: '/data/publication_statements/1',
        rule_id: 'checkpoint-publication-shape',
        rule_location: '#/allOf/0',
        severity: 'warning',
        message: 'publication_statements entry should include a supporting digest.',
        detail_result_ids: [],
      },
    });
    const validationReport = createValidationReportArtifact({
      id: 'vrpt-helper-store-test',
      created_by: 'store-helper-test',
      session_id: 's1-store-helper-test',
      data: {
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-root',
        },
        profile_id: 'checkpoint-publication-profile-v1',
        report_level: 'detailed',
        conforms: false,
        outcome: 'advisory',
        result_ids: ['vres-helper-store-test'],
        summary: {
          info: 0,
          warning: 1,
          violation: 0,
        },
      },
    });
    const publicationRoot = createPublicationRoot({
      id: 'pr-helper-store-test',
      status: 'published',
      about: createSubjectDescriptor({
        name: 'checkpoint-publication/cp-root',
        mediaType: 'application/json',
        body: {
          checkpoint_id: 'cp-root',
          publication_cycle: 'validation',
        },
        locator: {
          checkpoint_id: 'cp-root',
        },
      }),
      member_descriptors: [
        createPublicationMemberDescriptor({
          name: 'member/validation-report',
          mediaType: 'application/json',
          body: validationReport,
          locator: { path: 'validation-reports/vrpt-helper-store-test.json' },
          artifact_type: 'validation-report',
        }),
        createPublicationMemberDescriptor({
          name: 'member/validation-result',
          mediaType: 'application/json',
          body: validationResult,
          locator: { path: 'validation-results/vres-helper-store-test.json' },
          artifact_type: 'validation-result',
        }),
      ],
    });

    const resultWrite = await store.write('validation-result', validationResult);
    assert.equal(resultWrite.ok, true, JSON.stringify(resultWrite.errors));

    const reportWrite = await store.write('validation-report', validationReport);
    assert.equal(reportWrite.ok, true, JSON.stringify(reportWrite.errors));

    const publicationWrite = await store.write('publication-root', publicationRoot);
    assert.equal(publicationWrite.ok, true, JSON.stringify(publicationWrite.errors));

    const storedResult = await store.read('validation-result', 'vres-helper-store-test');
    assert.equal(storedResult.data.report_id, 'vrpt-helper-store-test');

    const storedReport = await store.read('validation-report', 'vrpt-helper-store-test');
    assert.deepEqual(storedReport.data.result_ids, ['vres-helper-store-test']);

    const storedPublication = await store.read('publication-root', 'pr-helper-store-test');
    assert.equal(storedPublication.status, 'published');
    assert.deepEqual(
      storedPublication.member_descriptors.map((member) => member.artifact_type),
      ['validation-report', 'validation-result'],
    );
  });
});
