const VALIDATION_RESULT_TYPE = 'validation-result';
const VALIDATION_REPORT_TYPE = 'validation-report';
const VALIDATION_RESULT_ID_PATTERN = /^vres-/;
const VALIDATION_REPORT_ID_PATTERN = /^vrpt-/;
const RFC3339_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const JSON_POINTER_PATTERN = /^(?:\/(?:[^~/]|~0|~1)*)*$/;
const JSON_FRAGMENT_POINTER_PATTERN = /^(?:#)?(?:\/(?:[^~/]|~0|~1)*)*$/;
const RESULT_SEVERITIES = new Set(['info', 'warning', 'violation']);
const REPORT_LEVELS = new Set(['flag', 'basic', 'detailed', 'verbose']);
const REPORT_OUTCOMES = new Set(['conformant', 'advisory', 'blocking']);

const DEFAULT_VALIDATION_RESULT_ARTIFACT = {
  id: 'vres-1-test',
  type: VALIDATION_RESULT_TYPE,
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
};

const DEFAULT_VALIDATION_REPORT_ARTIFACT = {
  id: 'vrpt-1-test',
  type: VALIDATION_REPORT_TYPE,
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
};

function normalizedString(value, fallback = null) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizedPatternString(value, pattern, fallback) {
  const normalized = normalizedString(value, null);
  if (normalized == null) {
    return fallback;
  }
  return pattern.test(normalized) ? normalized : fallback;
}

function normalizedEnum(value, allowed, fallback) {
  const normalized = normalizedString(value, null);
  if (normalized == null) {
    return fallback;
  }
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizedPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

function normalizedNonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizedNullableString(value, fallback) {
  if (value === null) {
    return null;
  }
  return normalizedString(value, fallback);
}

function normalizedObject(value, fallback) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : fallback;
}

function isLeapYear(year) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function daysInMonth(year, month) {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function isRfc3339DateTime(value) {
  const match = RFC3339_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetSign,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  const second = Number.parseInt(secondText, 10);

  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return false;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  if (!offsetSign) {
    return true;
  }

  const offsetHour = Number.parseInt(offsetHourText, 10);
  const offsetMinute = Number.parseInt(offsetMinuteText, 10);
  return offsetHour <= 23 && offsetMinute <= 59;
}

function normalizedDateTimeString(value, fallback) {
  const normalized = normalizedString(value, null);
  if (normalized == null) {
    return fallback;
  }
  return isRfc3339DateTime(normalized) ? normalized : fallback;
}

function normalizedArtifactEnvelope(fields, fallback, idPattern, type) {
  const createdAt = normalizedDateTimeString(fields.created_at, fallback.created_at);

  return {
    id: normalizedPatternString(fields.id, idPattern, fallback.id),
    type,
    version: normalizedPositiveInteger(fields.version, fallback.version),
    created_at: createdAt,
    updated_at: normalizedDateTimeString(fields.updated_at, createdAt),
    created_by: normalizedString(fields.created_by, fallback.created_by),
    session_id: normalizedNullableString(fields.session_id, fallback.session_id),
    status: fallback.status,
  };
}

function normalizedSubjectRef(value, fallback) {
  const source = normalizedObject(value, fallback);

  return {
    type: normalizedString(source.type, fallback.type),
    id: normalizedString(source.id, fallback.id),
  };
}

function normalizedIdArray(values, pattern, fallback = []) {
  if (!Array.isArray(values)) {
    return [...fallback];
  }

  const normalized = [];
  const seen = new Set();
  for (const value of values) {
    const candidate = normalizedPatternString(value, pattern, null);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function normalizedSummary(value, fallback) {
  const source = normalizedObject(value, fallback);

  return {
    info: normalizedNonNegativeInteger(source.info, fallback.info),
    warning: normalizedNonNegativeInteger(source.warning, fallback.warning),
    violation: normalizedNonNegativeInteger(source.violation, fallback.violation),
  };
}

export function summarizeValidationResults(results = []) {
  const summary = {
    info: 0,
    warning: 0,
    violation: 0,
  };

  if (!Array.isArray(results)) {
    return summary;
  }

  for (const result of results) {
    const severity = normalizedEnum(result?.data?.severity, RESULT_SEVERITIES, null);
    if (severity) {
      summary[severity] += 1;
    }
  }

  return summary;
}

function normalizedReportOutcome(value, conforms, fallback) {
  const normalized = normalizedEnum(value, REPORT_OUTCOMES, null);
  if (conforms) {
    return 'conformant';
  }
  if (normalized === 'advisory' || normalized === 'blocking') {
    return normalized;
  }
  return fallback;
}

export function createValidationResultArtifact(fields = {}) {
  const data = normalizedObject(fields.data, {});

  return {
    ...normalizedArtifactEnvelope(
      fields,
      DEFAULT_VALIDATION_RESULT_ARTIFACT,
      VALIDATION_RESULT_ID_PATTERN,
      VALIDATION_RESULT_TYPE,
    ),
    data: {
      report_id: normalizedPatternString(data.report_id, VALIDATION_REPORT_ID_PATTERN, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.report_id),
      subject_ref: normalizedSubjectRef(data.subject_ref, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.subject_ref),
      subject_location: normalizedPatternString(data.subject_location, JSON_POINTER_PATTERN, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.subject_location),
      rule_id: normalizedString(data.rule_id, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.rule_id),
      rule_location: normalizedPatternString(data.rule_location, JSON_FRAGMENT_POINTER_PATTERN, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.rule_location),
      severity: normalizedEnum(data.severity, RESULT_SEVERITIES, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.severity),
      message: normalizedNullableString(data.message, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.message),
      detail_result_ids: normalizedIdArray(data.detail_result_ids, VALIDATION_RESULT_ID_PATTERN, DEFAULT_VALIDATION_RESULT_ARTIFACT.data.detail_result_ids),
    },
  };
}

export function createValidationReportArtifact(fields = {}) {
  const data = normalizedObject(fields.data, {});
  const conforms = typeof data.conforms === 'boolean'
    ? data.conforms
    : DEFAULT_VALIDATION_REPORT_ARTIFACT.data.conforms;

  return {
    ...normalizedArtifactEnvelope(
      fields,
      DEFAULT_VALIDATION_REPORT_ARTIFACT,
      VALIDATION_REPORT_ID_PATTERN,
      VALIDATION_REPORT_TYPE,
    ),
    data: {
      subject_ref: normalizedSubjectRef(data.subject_ref, DEFAULT_VALIDATION_REPORT_ARTIFACT.data.subject_ref),
      profile_id: normalizedString(data.profile_id, DEFAULT_VALIDATION_REPORT_ARTIFACT.data.profile_id),
      report_level: normalizedEnum(data.report_level, REPORT_LEVELS, DEFAULT_VALIDATION_REPORT_ARTIFACT.data.report_level),
      conforms,
      outcome: normalizedReportOutcome(data.outcome, conforms, DEFAULT_VALIDATION_REPORT_ARTIFACT.data.outcome),
      result_ids: normalizedIdArray(data.result_ids, VALIDATION_RESULT_ID_PATTERN, DEFAULT_VALIDATION_REPORT_ARTIFACT.data.result_ids),
      summary: normalizedSummary(data.summary, DEFAULT_VALIDATION_REPORT_ARTIFACT.data.summary),
    },
  };
}
