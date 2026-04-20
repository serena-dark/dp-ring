import { createHash } from 'node:crypto';
import { canonicalizeGovernanceValue, createSubjectDescriptor } from './governance-statement.mjs';

const PUBLICATION_ROOT_TYPE = 'https://dp-ring.dev/schemas/publication-root/v1';
const DEFAULT_CONFORMS_TO = 'https://dp-ring.dev/publication-root/v1';
const PUBLICATION_ROOT_STATUSES = new Set(['draft', 'published', 'withheld', 'superseded']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function normalizedAboutDescriptor(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Publication roots require an about descriptor.');
  }
  return createSubjectDescriptor(value);
}

function sortMemberDescriptors(values = []) {
  return [...values].sort((left, right) => {
    const leftKey = `${left.name}\u0000${left.artifact_type}\u0000${left.digest}`;
    const rightKey = `${right.name}\u0000${right.artifact_type}\u0000${right.digest}`;
    return leftKey.localeCompare(rightKey);
  });
}

function membershipDigest(memberDescriptors = []) {
  const canonicalMembers = sortMemberDescriptors(memberDescriptors).map((member) => ({
    name: member.name,
    mediaType: member.mediaType,
    ...(member.profile ? { profile: member.profile } : {}),
    digest: member.digest,
    size: member.size,
    locator: member.locator,
    artifact_type: member.artifact_type,
  }));
  return digestString(canonicalizeGovernanceValue(canonicalMembers));
}

export function createPublicationMemberDescriptor(fields = {}) {
  const artifactType = normalizedString(fields.artifact_type);
  if (!artifactType) {
    throw new Error('Publication member descriptors require artifact_type.');
  }
  const profile = normalizedString(fields.profile);

  const descriptor = createSubjectDescriptor(fields);
  return {
    ...descriptor,
    ...(profile ? { profile } : {}),
    artifact_type: artifactType,
  };
}

export function createPublicationRoot(fields = {}) {
  const id = normalizedString(fields.id);
  if (!id) {
    throw new Error('Publication roots require id.');
  }

  const status = normalizedString(fields.status, 'draft');
  if (!PUBLICATION_ROOT_STATUSES.has(status)) {
    throw new Error(`Unsupported publication root status: ${status}`);
  }

  const about = normalizedAboutDescriptor(fields.about ?? fields.about_subject);
  const rawMembers = Array.isArray(fields.member_descriptors)
    ? fields.member_descriptors
    : Array.isArray(fields.members)
      ? fields.members
      : [];
  const memberDescriptors = sortMemberDescriptors(rawMembers.map((member) => createPublicationMemberDescriptor(member)));

  const seenNames = new Set();
  for (const member of memberDescriptors) {
    if (seenNames.has(member.name)) {
      throw new Error(`Publication roots require unique member descriptor names: ${member.name}`);
    }
    seenNames.add(member.name);
  }

  return {
    _type: PUBLICATION_ROOT_TYPE,
    id,
    conforms_to: normalizedString(fields.conforms_to, DEFAULT_CONFORMS_TO),
    status,
    about,
    member_descriptors: memberDescriptors.map((member) => clone(member)),
    membership_digest: membershipDigest(memberDescriptors),
  };
}
