import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';
import {
  createBranchCommitStatement,
  createCheckpointPublicationStatement,
  createSubjectDescriptor,
} from '../../ring/lib/governance-statement.mjs';
import {
  createPublicationMemberDescriptor,
  createPublicationRoot,
} from '../../ring/lib/publication-root.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

describe('publication root shell', async () => {
  const validator = await createValidator(ringDir);

  it('creates a valid publication root with explicit about semantics and a member catalog', () => {
    const checkpointStatement = createCheckpointPublicationStatement({
      id: 'cp-root',
      status: 'mainline',
      data: {
        branch_id: 'main',
        node_id: 'n1-router',
        scope_ref: { kind: 'workflow-run', id: 'run-1', path: 'workspace/run-1' },
        execution_cursor: { phase: 'completed', step_id: 'finalize', ordinal: 2 },
        evidence_refs: [
          { kind: 'summary', ref: 'docs/tasks/reviews/t1.md', digest: null },
        ],
        adoption_status: 'mainline',
        replay_state: { status: 'idle', requested_at: null, completed_at: null },
      },
    });
    const branchStatement = createBranchCommitStatement({
      event_type: 'checkpoint_created',
      branch_id: 'main',
      checkpoint_id: 'cp-root',
      actor: 'session-runner',
      occurred_at: '2026-04-20T00:00:00Z',
      parent_checkpoint_id: null,
      synthesis_inputs: [],
      reason: null,
    });

    const root = createPublicationRoot({
      id: 'pr-checkpoint-cp-root',
      status: 'published',
      about: checkpointStatement.subject[0],
      member_descriptors: [
        createPublicationMemberDescriptor({
          name: 'member/checkpoint-publication',
          mediaType: 'application/vnd.dp-ring.governance-statement+json',
          body: checkpointStatement,
          locator: { kind: 'checkpoint', id: 'cp-root' },
          artifact_type: 'governance-statement',
        }),
        createPublicationMemberDescriptor({
          name: 'member/branch-event-commit',
          mediaType: 'application/vnd.dp-ring.governance-statement+json',
          body: branchStatement,
          locator: { kind: 'branch-event', id: 'be-checkpoint-created' },
          artifact_type: 'governance-statement',
        }),
      ],
    });

    const result = validator.validate('publication-root', root);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(root.about.name, 'checkpoint-publication/cp-root');
    assert.deepEqual(root.member_descriptors.map((member) => member.name), [
      'member/branch-event-commit',
      'member/checkpoint-publication',
    ]);
    assert.equal(root.member_descriptors[0].artifact_type, 'governance-statement');
    assert.match(root.membership_digest, /^sha256:/);
  });

  it('allows required-but-empty member catalogs while keeping about separate from membership', () => {
    const root = createPublicationRoot({
      id: 'pr-branch-decision-empty',
      status: 'draft',
      about_subject: createSubjectDescriptor({
        name: 'branch-decision/main/cp-root',
        mediaType: 'application/vnd.dp-ring.branch-decision+json',
        body: {
          branch_id: 'main',
          checkpoint_id: 'cp-root',
          publication_cycle: 'decision',
        },
        locator: {
          branch_id: 'main',
          checkpoint_id: 'cp-root',
        },
      }),
      member_descriptors: [],
    });

    const result = validator.validate('publication-root', root);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(root.about.name, 'branch-decision/main/cp-root');
    assert.deepEqual(root.member_descriptors, []);
    assert.match(root.membership_digest, /^sha256:/);
  });

  it('canonicalizes member ordering and rejects duplicate descriptor names', () => {
    const firstMember = {
      name: 'member/z-last',
      mediaType: 'application/json',
      body: { pointer: 'z' },
      locator: { path: 'members/z.json' },
      artifact_type: 'test-member',
    };
    const secondMember = {
      name: 'member/a-first',
      mediaType: 'application/json',
      body: { pointer: 'a' },
      locator: { path: 'members/a.json' },
      artifact_type: 'test-member',
    };

    const left = createPublicationRoot({
      id: 'pr-order-left',
      about: createSubjectDescriptor({
        name: 'publication-cycle/left',
        mediaType: 'application/json',
        body: { cycle: 'left' },
        locator: { id: 'left' },
      }),
      member_descriptors: [firstMember, secondMember],
    });
    const right = createPublicationRoot({
      id: 'pr-order-right',
      about: createSubjectDescriptor({
        name: 'publication-cycle/right',
        mediaType: 'application/json',
        body: { cycle: 'right' },
        locator: { id: 'right' },
      }),
      member_descriptors: [secondMember, firstMember],
    });

    assert.deepEqual(left.member_descriptors.map((member) => member.name), ['member/a-first', 'member/z-last']);
    assert.deepEqual(right.member_descriptors.map((member) => member.name), ['member/a-first', 'member/z-last']);
    assert.equal(left.membership_digest, right.membership_digest);
    assert.throws(
      () => createPublicationRoot({
        id: 'pr-duplicate-members',
        about: createSubjectDescriptor({
          name: 'publication-cycle/duplicate',
          mediaType: 'application/json',
          body: { cycle: 'duplicate' },
          locator: { id: 'duplicate' },
        }),
        member_descriptors: [
          firstMember,
          {
            ...firstMember,
            body: { pointer: 'duplicate' },
            locator: { path: 'members/duplicate.json' },
          },
        ],
      }),
      /unique member descriptor names: member\/z-last/,
    );
  });

  it('allows an optional member profile distinct from representation mediaType', () => {
    const about = createSubjectDescriptor({
      name: 'publication-cycle/profiled-member',
      mediaType: 'application/json',
      body: { cycle: 'profiled-member' },
      locator: { id: 'profiled-member' },
    });
    const baseMember = {
      name: 'member/validation-report',
      mediaType: 'application/json',
      body: { report: 'ok' },
      locator: { path: 'members/validation-report.json' },
      artifact_type: 'validation-report',
    };

    const unprofiled = createPublicationRoot({
      id: 'pr-unprofiled-member',
      about,
      member_descriptors: [baseMember],
    });
    const profiled = createPublicationRoot({
      id: 'pr-profiled-member',
      about,
      member_descriptors: [{
        ...baseMember,
        profile: ' https://dp-ring.dev/publication-profile/validation-report/v1 ',
      }],
    });

    const result = validator.validate('publication-root', profiled);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(profiled.member_descriptors[0].mediaType, 'application/json');
    assert.equal(
      profiled.member_descriptors[0].profile,
      'https://dp-ring.dev/publication-profile/validation-report/v1',
    );
    assert.equal(Object.hasOwn(unprofiled.member_descriptors[0], 'profile'), false);
    assert.notEqual(profiled.membership_digest, unprofiled.membership_digest);
  });
});
