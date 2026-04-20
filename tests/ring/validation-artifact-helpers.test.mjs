import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';
import {
  createValidationReportArtifact,
  createValidationResultArtifact,
  summarizeValidationResults,
} from '../../ring/lib/validation-artifacts.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

describe('validation artifact helpers', async () => {
  const validator = await createValidator(ringDir);

  it('creates a deterministic validation-result artifact shell', () => {
    const artifact = createValidationResultArtifact();

    assert.deepEqual(artifact, {
      id: 'vres-1-test',
      type: 'validation-result',
      version: 1,
      created_at: '2026-04-20T00:00:00Z',
      updated_at: '2026-04-20T00:00:00Z',
      created_by: 'validation-helper',
      session_id: 's1-validation-helper',
      status: 'recorded',
      data: {
        report_id: 'vrpt-1-test',
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
    });

    const validation = validator.validate('validation-result', artifact);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  });

  it('creates a deterministic validation-report artifact shell', () => {
    const artifact = createValidationReportArtifact();

    assert.deepEqual(artifact, {
      id: 'vrpt-1-test',
      type: 'validation-report',
      version: 1,
      created_at: '2026-04-20T00:00:01Z',
      updated_at: '2026-04-20T00:00:01Z',
      created_by: 'validation-helper',
      session_id: 's1-validation-helper',
      status: 'recorded',
      data: {
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-root',
        },
        profile_id: 'checkpoint-publication-profile-v1',
        report_level: 'basic',
        conforms: false,
        outcome: 'blocking',
        result_ids: ['vres-1-test'],
        summary: {
          info: 0,
          warning: 0,
          violation: 1,
        },
      },
    });

    const validation = validator.validate('validation-report', artifact);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  });

  it('summarizes validation result severities for report assembly', () => {
    const warning = createValidationResultArtifact({
      id: 'vres-summary-warning',
      data: {
        report_id: 'vrpt-summary',
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-summary',
        },
        subject_location: '/data/execution_cursor',
        rule_id: 'workflow-run-callback-status',
        rule_location: '#/status',
        severity: 'warning',
        message: 'Callback is advisory.',
        detail_result_ids: [],
      },
    });
    const violation = createValidationResultArtifact({
      id: 'vres-summary-violation',
      data: {
        report_id: 'vrpt-summary',
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-summary',
        },
        subject_location: '/data/execution_cursor',
        rule_id: 'workflow-run-callback-status',
        rule_location: '#/status',
        severity: 'violation',
        message: 'Callback is blocking.',
        detail_result_ids: [],
      },
    });

    assert.deepEqual(
      summarizeValidationResults([warning, violation, { data: { severity: 'not-recognized' } }]),
      {
        info: 0,
        warning: 1,
        violation: 1,
      },
    );
  });

  it('creates schema-valid empty conformant reports when no findings are present', () => {
    const artifact = createValidationReportArtifact({
      id: 'vrpt-empty',
      created_at: '2026-05-02T00:00:00Z',
      updated_at: '2026-05-02T00:00:00Z',
      created_by: 'session-runner',
      session_id: 's1-empty',
      data: {
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-empty',
        },
        profile_id: 'workflow-run-callback-profile-v1',
        report_level: 'basic',
        conforms: true,
        outcome: 'blocking',
        result_ids: [],
        summary: summarizeValidationResults([]),
      },
    });

    assert.deepEqual(artifact.data.result_ids, []);
    assert.deepEqual(artifact.data.summary, {
      info: 0,
      warning: 0,
      violation: 0,
    });
    assert.equal(artifact.data.conforms, true);
    assert.equal(artifact.data.outcome, 'conformant');

    const validation = validator.validate('validation-report', artifact);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  });

  it('normalizes overrides into schema-safe shapes without sharing caller references', () => {
    const resultFields = {
      id: 'vres-custom',
      created_at: '2026-05-01T12:00:00Z',
      created_by: 'custom-validator',
      session_id: null,
      data: {
        report_id: 'vrpt-custom',
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-custom',
        },
        subject_location: '/data/publication_statements/1',
        rule_id: 'checkpoint-publication-shape',
        rule_location: '#/allOf/0',
        severity: 'warning',
        message: null,
        detail_result_ids: ['vres-child-1', 'vres-child-1', 'not-a-result'],
      },
    };
    const reportFields = {
      id: 'vrpt-custom',
      updated_at: '2026-05-01T12:00:02Z',
      data: {
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-custom',
        },
        profile_id: 'checkpoint-publication-profile-v2',
        report_level: 'verbose',
        conforms: true,
        outcome: 'blocking',
        result_ids: ['vres-custom', 'vres-custom', 'bad-id'],
        summary: {
          info: 1,
          warning: 2,
          violation: 0,
        },
      },
    };

    const result = createValidationResultArtifact(resultFields);
    const report = createValidationReportArtifact(reportFields);

    resultFields.data.subject_ref.id = 'cp-mutated';
    resultFields.data.detail_result_ids.push('vres-late');
    reportFields.data.result_ids.push('vres-late');
    reportFields.data.summary.warning = 99;

    assert.deepEqual(result, {
      id: 'vres-custom',
      type: 'validation-result',
      version: 1,
      created_at: '2026-05-01T12:00:00Z',
      updated_at: '2026-05-01T12:00:00Z',
      created_by: 'custom-validator',
      session_id: null,
      status: 'recorded',
      data: {
        report_id: 'vrpt-custom',
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-custom',
        },
        subject_location: '/data/publication_statements/1',
        rule_id: 'checkpoint-publication-shape',
        rule_location: '#/allOf/0',
        severity: 'warning',
        message: null,
        detail_result_ids: ['vres-child-1'],
      },
    });
    assert.deepEqual(report, {
      id: 'vrpt-custom',
      type: 'validation-report',
      version: 1,
      created_at: '2026-04-20T00:00:01Z',
      updated_at: '2026-05-01T12:00:02Z',
      created_by: 'validation-helper',
      session_id: 's1-validation-helper',
      status: 'recorded',
      data: {
        subject_ref: {
          type: 'checkpoint',
          id: 'cp-custom',
        },
        profile_id: 'checkpoint-publication-profile-v2',
        report_level: 'verbose',
        conforms: true,
        outcome: 'conformant',
        result_ids: ['vres-custom'],
        summary: {
          info: 1,
          warning: 2,
          violation: 0,
        },
      },
    });

    const resultValidation = validator.validate('validation-result', result);
    assert.equal(resultValidation.valid, true, JSON.stringify(resultValidation.errors));

    const reportValidation = validator.validate('validation-report', report);
    assert.equal(reportValidation.valid, true, JSON.stringify(reportValidation.errors));
  });
});
