import { createHash } from 'node:crypto';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizedString(value, fallback = null) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function digestString(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function canonicalizeGovernanceValue(value) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Governance canonicalization requires finite numbers.');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeGovernanceValue(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeGovernanceValue(value[key])}`)
      .join(',')}}`;
  }
  throw new Error(`Unsupported governance value for canonicalization: ${typeof value}`);
}

export function createSubjectDescriptor(fields = {}) {
  const mediaType = normalizedString(fields.mediaType);
  if (!mediaType) {
    throw new Error('Governance subject descriptors require mediaType.');
  }

  const name = normalizedString(fields.name, mediaType);
  const canonicalBody = fields.canonical_body ?? canonicalizeGovernanceValue(fields.body ?? null);
  const digest = normalizedString(fields.digest) ?? digestString(canonicalBody);
  const size = Number.isInteger(fields.size) && fields.size >= 0
    ? fields.size
    : Buffer.byteLength(canonicalBody, 'utf8');

  return {
    name,
    mediaType,
    digest,
    size,
    locator: fields.locator == null ? null : clone(fields.locator),
  };
}

export function createGovernanceStatement(fields = {}) {
  const predicateType = normalizedString(fields.predicateType);
  if (!predicateType) {
    throw new Error('Governance statements require predicateType.');
  }

  const subjects = Array.isArray(fields.subject)
    ? fields.subject
    : Array.isArray(fields.subjects)
      ? fields.subjects
      : [];
  if (subjects.length === 0) {
    throw new Error('Governance statements require at least one subject descriptor.');
  }

  const subject = subjects.map((item) => createSubjectDescriptor(item));
  const predicate = clone(fields.predicate ?? {});
  const canonicalSubject = canonicalizeGovernanceValue(subject);
  const canonicalPredicate = canonicalizeGovernanceValue(predicate);

  return {
    _type: 'https://dp-ring.dev/schemas/governance-statement/v1',
    subject,
    predicateType,
    predicate,
    canonicalization: {
      profile: normalizedString(fields.profile, 'json-sorted@v1'),
      subject_digest: digestString(canonicalSubject),
      predicate_digest: digestString(canonicalPredicate),
    },
  };
}

export function createBranchCommitStatement(fields = {}) {
  const eventType = normalizedString(fields.event_type);
  const branchId = normalizedString(fields.branch_id);
  const checkpointId = normalizedString(fields.checkpoint_id);
  if (!eventType || !branchId || !checkpointId) {
    throw new Error('Branch commit statements require event_type, branch_id, and checkpoint_id.');
  }

  const actor = normalizedString(fields.actor, 'session-runner');
  const occurredAt = normalizedString(fields.occurred_at);
  const synthesisInputs = Array.isArray(fields.synthesis_inputs)
    ? fields.synthesis_inputs.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return createGovernanceStatement({
    predicateType: 'https://dp-ring.dev/predicate/branch-event-commit/v1',
    subjects: [
      {
        name: `branch-event/${eventType}/${checkpointId}`,
        mediaType: 'application/vnd.dp-ring.branch-event-commit+json',
        body: {
          event_type: eventType,
          branch_id: branchId,
          checkpoint_id: checkpointId,
          actor,
          occurred_at: occurredAt,
        },
        locator: {
          event_type: eventType,
          branch_id: branchId,
          checkpoint_id: checkpointId,
        },
      },
    ],
    predicate: {
      decision: {
        message_class: 'commit',
        event_type: eventType,
        actor,
        occurred_at: occurredAt,
      },
      context: {
        branch_id: branchId,
        checkpoint_id: checkpointId,
        parent_checkpoint_id: normalizedString(fields.parent_checkpoint_id),
        synthesis_inputs: synthesisInputs,
        reason: normalizedString(fields.reason),
      },
    },
  });
}
