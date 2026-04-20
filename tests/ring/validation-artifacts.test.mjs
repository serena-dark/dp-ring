import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

function buildValidationResultDoc() {
  return {
    id: 'vres-1-test',
    type: 'validation-result',
    version: 1,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    created_by: 'validator-test',
    session_id: 's1-test',
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
  };
}

function buildValidationReportDoc() {
  return {
    id: 'vrpt-1-test',
    type: 'validation-report',
    version: 1,
    created_at: '2026-04-20T00:00:01Z',
    updated_at: '2026-04-20T00:00:01Z',
    created_by: 'validator-test',
    session_id: 's1-test',
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
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('validation artifact schemas', async () => {
  const validator = await createValidator(ringDir);

  it('autoloads validation-report and validation-result schemas', () => {
    assert.ok(validator.getSchema('validation-report'));
    assert.ok(validator.getSchema('validation-result'));
  });

  it('accepts a minimal validation report/result shell', () => {
    const resultDoc = buildValidationResultDoc();
    const reportDoc = buildValidationReportDoc();

    const resultValidation = validator.validate('validation-result', resultDoc);
    assert.equal(resultValidation.valid, true, JSON.stringify(resultValidation.errors));

    const reportValidation = validator.validate('validation-report', reportDoc);
    assert.equal(reportValidation.valid, true, JSON.stringify(reportValidation.errors));
  });

  it('rejects query-style selectors for singular locations', () => {
    const resultDoc = clone(buildValidationResultDoc());
    resultDoc.data.subject_location = '$.data.publication_statements[0]';
    resultDoc.data.rule_location = '$.properties.data.required[6]';

    const validation = validator.validate('validation-result', resultDoc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /subject_location|rule_location/);
  });

  it('rejects patch-style payloads and inconsistent conformant outcomes', () => {
    const resultDoc = clone(buildValidationResultDoc());
    resultDoc.data.patch = [{ op: 'remove', path: '/data/publication_statements/0' }];

    const resultValidation = validator.validate('validation-result', resultDoc);
    assert.equal(resultValidation.valid, false);
    assert.match(JSON.stringify(resultValidation.errors), /must NOT have additional properties/);

    const reportDoc = clone(buildValidationReportDoc());
    reportDoc.data.conforms = true;
    reportDoc.data.outcome = 'blocking';

    const reportValidation = validator.validate('validation-report', reportDoc);
    assert.equal(reportValidation.valid, false);
    assert.match(JSON.stringify(reportValidation.errors), /conformant/);
  });
});
