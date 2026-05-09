import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

function buildAcceptanceEvaluationDoc() {
  return {
    id: 'aeval-1-test',
    type: 'acceptance-evaluation',
    version: 1,
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
    created_by: 'acceptance-test',
    session_id: 's1-acceptance-test',
    status: 'open',
    data: {
      publication_root_id: 'pr-acceptance-cycle',
      acceptance_profile_id: 'acceptance-profile/baseline-response-duty-v1',
      profile_snapshot: {
        protocol_family: 'response_duty_v1',
        closure_policy: 'all_response_duties_resolved',
        phase_model: 'single_phase',
        semantics_family: null,
      },
      moves: [
        {
          id: 'amv-1-challenge',
          sequence: 1,
          occurred_at: '2026-05-08T00:01:00Z',
          actor: 'reviewer-agent',
          locution: 'challenge',
          target_refs: [
            {
              artifact_type: 'claim',
              id: 'claim-runtime-safety',
              location: '/member_descriptors/0',
            },
          ],
          basis_refs: [
            {
              rule_id: 'runtime-safety-invariant',
              rule_location: '#/properties/data/properties/node_execution',
            },
          ],
          antecedent_move_ids: [],
          note: 'Challenge opens a public support-or-withdraw burden for the claim.',
        },
      ],
      current_commitments: [
        {
          id: 'acmt-1-claim',
          holder: 'executor-agent',
          target_ref: {
            artifact_type: 'claim',
            id: 'claim-runtime-safety',
            location: '/member_descriptors/0',
          },
          state: 'challenged',
          source_move_id: 'amv-1-challenge',
        },
      ],
      open_response_duties: [
        {
          id: 'aduty-1-support-or-withdraw',
          opened_by_move_id: 'amv-1-challenge',
          assigned_to: 'executor-agent',
          duty_kind: 'justify_or_withdraw',
          target_ref: {
            artifact_type: 'claim',
            id: 'claim-runtime-safety',
            location: '/member_descriptors/0',
          },
          status: 'open',
        },
      ],
      settlement_projection: null,
    },
  };
}

function buildSatisfiedDutyAcceptanceEvaluationDoc() {
  const doc = clone(buildAcceptanceEvaluationDoc());
  doc.data.moves.push({
    id: 'amv-2-justify',
    sequence: 2,
    occurred_at: '2026-05-08T00:05:00Z',
    actor: 'executor-agent',
    locution: 'justify',
    target_refs: [
      {
        artifact_type: 'claim',
        id: 'claim-runtime-safety',
        location: '/member_descriptors/0',
      },
    ],
    basis_refs: [
      {
        rule_id: 'runtime-safety-invariant',
        rule_location: '#/properties/data/properties/node_execution',
      },
    ],
    antecedent_move_ids: ['amv-1-challenge'],
    note: 'Executor supplies public grounds that satisfy the support-or-withdraw response duty.',
  });
  doc.data.current_commitments[0].state = 'defended';
  doc.data.current_commitments[0].source_move_id = 'amv-2-justify';
  doc.data.open_response_duties[0].status = 'satisfied';
  doc.data.open_response_duties[0].satisfied_by_move_id = 'amv-2-justify';
  return doc;
}

function buildSettledAcceptanceEvaluationDoc() {
  const doc = buildSatisfiedDutyAcceptanceEvaluationDoc();
  doc.status = 'settled';
  doc.data.open_response_duties = [];
  doc.data.moves.push({
    id: 'amv-3-settle',
    sequence: 3,
    occurred_at: '2026-05-08T00:10:00Z',
    actor: 'reviewer-agent',
    locution: 'settle',
    target_refs: [
      {
        artifact_type: 'claim',
        id: 'claim-runtime-safety',
        location: '/member_descriptors/0',
      },
    ],
    basis_refs: [],
    antecedent_move_ids: ['amv-1-challenge', 'amv-2-justify'],
    note: 'All public response duties are resolved; settlement records its move basis.',
  });
  doc.data.settlement_projection = {
    outcome: 'accepted',
    settled_at: '2026-05-08T00:10:00Z',
    basis_move_ids: ['amv-1-challenge', 'amv-2-justify', 'amv-3-settle'],
    open_response_duties_resolved: true,
    note: 'Settlement is grounded in append-only move history.',
  };
  doc.data.current_commitments[0].state = 'settled';
  doc.data.current_commitments[0].source_move_id = 'amv-3-settle';
  return doc;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('acceptance evaluation schema', async () => {
  const validator = await createValidator(ringDir);

  it('autoloads a first-class acceptance-evaluation schema', () => {
    assert.ok(validator.getSchema('acceptance-evaluation'));
  });

  it('accepts the baseline response-duty evaluation envelope', () => {
    const validation = validator.validate('acceptance-evaluation', buildAcceptanceEvaluationDoc());
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  });

  it('accepts settled evaluations whose settlement basis references append-only moves', () => {
    const validation = validator.validate('acceptance-evaluation', buildSettledAcceptanceEvaluationDoc());
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  });

  it('accepts response duties satisfied by a later public move', () => {
    const validation = validator.validate('acceptance-evaluation', buildSatisfiedDutyAcceptanceEvaluationDoc());
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  });

  it('rejects open response duties that already carry a satisfaction move', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.data.open_response_duties[0].satisfied_by_move_id = 'amv-1-challenge';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /open response duties.*satisfied_by_move_id/);
  });

  it('rejects satisfied response duties without a satisfaction move', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.data.open_response_duties[0].status = 'satisfied';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /satisfied response duties.*satisfied_by_move_id/);
  });

  it('rejects response duty satisfaction that does not follow the opening move', () => {
    const doc = buildSatisfiedDutyAcceptanceEvaluationDoc();
    doc.data.open_response_duties[0].satisfied_by_move_id = 'amv-1-challenge';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /satisfied_by_move_id.*after opened_by_move_id/);
  });

  it('rejects justify_or_withdraw duties opened by non-challenge locutions', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.data.moves[0].locution = 'settle';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /justify_or_withdraw.*opened.*(?:challenge|ask_grounds)/);
  });

  it('rejects justify_or_withdraw duties satisfied by non-justification locutions', () => {
    const doc = buildSatisfiedDutyAcceptanceEvaluationDoc();
    doc.data.moves[1].locution = 'accept';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /justify_or_withdraw.*satisfied.*(?:justify|withdraw)/);
  });

  it('rejects response duties whose target is not carried by their opening move', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.data.open_response_duties[0].target_ref.id = 'claim-unrelated-target';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /response duty target_ref.*opened_by_move_id/);
  });

  it('rejects response duties satisfied by a move that does not carry the duty target', () => {
    const doc = buildSatisfiedDutyAcceptanceEvaluationDoc();
    doc.data.moves[1].target_refs[0].id = 'claim-unrelated-satisfaction';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /satisfied_by_move_id.*target_ref/);
  });

  it('rejects selector-style move targets and rule bases', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.data.moves[0].target_refs[0].location = '$.member_descriptors[0]';
    doc.data.moves[0].basis_refs[0].rule_location = '$.properties.data';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /location|rule_location/);
  });

  it('rejects vague profile selectors and blank response-duty linkage', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.data.profile_snapshot.protocol_family = 'custom_chat_policy';
    doc.data.open_response_duties[0].opened_by_move_id = '   ';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /protocol_family|opened_by_move_id/);
  });

  it('requires settled evaluations to carry terminal settlement projection inside the evaluation', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.status = 'settled';
    doc.data.open_response_duties = [];
    doc.data.settlement_projection = null;

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /settlement_projection/);
  });

  it('rejects settled evaluations that still expose unresolved response duties', () => {
    const doc = clone(buildAcceptanceEvaluationDoc());
    doc.status = 'settled';
    doc.data.settlement_projection = {
      outcome: 'accepted',
      settled_at: '2026-05-08T00:10:00Z',
      basis_move_ids: ['amv-1-challenge'],
      open_response_duties_resolved: false,
      note: 'This cannot settle while a response duty is still open.',
    };

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /open_response_duties|open_response_duties_resolved/);
  });

  it('rejects settlement basis ids that do not reference append-only moves', () => {
    const doc = buildSettledAcceptanceEvaluationDoc();
    doc.data.settlement_projection.basis_move_ids.push('amv-missing');

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /basis_move_ids.*amv-missing/);
  });

  it('rejects commitment source move ids that do not reference append-only moves', () => {
    const doc = buildSettledAcceptanceEvaluationDoc();
    doc.data.current_commitments[0].source_move_id = 'amv-missing-commitment-source';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /source_move_id.*amv-missing-commitment-source/);
  });

  it('rejects response duty move ids that do not reference append-only moves', () => {
    const doc = buildAcceptanceEvaluationDoc();
    doc.data.open_response_duties[0].opened_by_move_id = 'amv-missing-duty-open';
    doc.data.open_response_duties[0].status = 'satisfied';
    doc.data.open_response_duties[0].satisfied_by_move_id = 'amv-missing-duty-satisfied';

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /opened_by_move_id.*amv-missing-duty-open/);
    assert.match(JSON.stringify(validation.errors), /satisfied_by_move_id.*amv-missing-duty-satisfied/);
  });

  it('rejects antecedent move ids that do not reference append-only moves', () => {
    const doc = buildSettledAcceptanceEvaluationDoc();
    doc.data.moves[1].antecedent_move_ids.push('amv-missing-antecedent');

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /antecedent_move_ids.*amv-missing-antecedent/);
  });

  it('rejects duplicate move ids in the append-only acceptance history', () => {
    const doc = buildSettledAcceptanceEvaluationDoc();
    doc.data.moves[1].id = 'amv-1-challenge';
    doc.data.current_commitments[0].source_move_id = 'amv-1-challenge';
    doc.data.settlement_projection.basis_move_ids = ['amv-1-challenge'];

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /duplicate move id.*amv-1-challenge/);
  });

  it('rejects non-increasing move sequences in append-only order', () => {
    const doc = buildSettledAcceptanceEvaluationDoc();
    doc.data.moves[2].sequence = 2;

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /move sequence.*amv-3-settle/);
  });

  it('rejects antecedent references to later moves in the append-only history', () => {
    const doc = buildSettledAcceptanceEvaluationDoc();
    doc.data.moves[0].antecedent_move_ids = ['amv-3-settle'];

    const validation = validator.validate('acceptance-evaluation', doc);
    assert.equal(validation.valid, false);
    assert.match(JSON.stringify(validation.errors), /antecedent_move_ids.*amv-3-settle.*earlier/);
  });
});
