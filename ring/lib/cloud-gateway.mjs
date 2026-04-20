const DEFAULT_RESOLVED_PREFERENCE = 'openai';
const DEFAULT_GATEWAY_PREFERENCE = 'auto';

const GATEWAY_PREFERENCE_ORDER = Object.freeze({
  auto: Object.freeze(['primary', 'fallback']),
  openai: Object.freeze(['primary']),
  kimi: Object.freeze(['fallback']),
});

const GATEWAY_PREFERENCE_ENV_KEYS = Object.freeze([
  'DP_RING_REMOTE_AGENT_PROVIDER',
  'DP_RING_CLOUD_PROVIDER',
  'RING_REMOTE_AGENT_PROVIDER',
  'RING_CLOUD_PROVIDER',
]);

function trimString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeGatewayPreference(value, fallback = null) {
  const normalized = trimString(value)?.toLowerCase();
  return Object.prototype.hasOwnProperty.call(GATEWAY_PREFERENCE_ORDER, normalized)
    ? normalized
    : fallback;
}

function gatewayAvailable(status) {
  return Boolean(status?.responses?.available);
}

async function readGatewaySnapshot(gateway) {
  if (!gateway?.getStatus) {
    return {
      gateway,
      status: null,
      error: null,
    };
  }

  try {
    return {
      gateway,
      status: await gateway.getStatus(),
      error: null,
    };
  } catch (error) {
    return {
      gateway,
      status: null,
      error,
    };
  }
}

function selectionOrderForPreference(preference) {
  return (
    GATEWAY_PREFERENCE_ORDER[preference] ??
    GATEWAY_PREFERENCE_ORDER[DEFAULT_GATEWAY_PREFERENCE]
  );
}

function createSnapshotEntry(gateway) {
  return {
    gateway,
    status: null,
    error: null,
  };
}

function selectGatewaySnapshot(snapshots, preference) {
  const selectionOrder = selectionOrderForPreference(preference);

  for (const key of selectionOrder) {
    const snapshot = snapshots[key];
    if (gatewayAvailable(snapshot?.status)) {
      return snapshot;
    }
  }

  return null;
}

function buildGatewayStatus(snapshots, preference) {
  const selected = selectGatewaySnapshot(snapshots, preference);
  return {
    preference,
    selected_provider: selected?.status?.provider ?? null,
    primary: snapshots.primary.status,
    fallback: snapshots.fallback.status,
  };
}

function createUnavailableGatewayError(snapshots, preference) {
  const error = new Error('No cloud gateway is available.');
  const probeErrors = Object.fromEntries(
    Object.entries(snapshots).flatMap(([key, snapshot]) => (
      snapshot?.error
        ? [[key, snapshot.error.message]]
        : []
    )),
  );

  error.details = {
    preference,
    status: buildGatewayStatus(snapshots, preference),
    ...(Object.keys(probeErrors).length > 0
      ? {
          probe_errors: probeErrors,
        }
      : {}),
  };

  return error;
}

export function resolveGatewayPreference(env = process.env) {
  for (const key of GATEWAY_PREFERENCE_ENV_KEYS) {
    const normalizedPreference = normalizeGatewayPreference(env?.[key]);
    if (normalizedPreference) {
      return normalizedPreference;
    }
  }

  return DEFAULT_RESOLVED_PREFERENCE;
}

export function createCloudGateway({
  primary = null,
  fallback = null,
  preference = DEFAULT_GATEWAY_PREFERENCE,
} = {}) {
  const normalizedPreference = normalizeGatewayPreference(preference, DEFAULT_GATEWAY_PREFERENCE);

  async function getSnapshots() {
    const snapshots = {
      primary: createSnapshotEntry(primary),
      fallback: createSnapshotEntry(fallback),
    };

    await Promise.all(
      selectionOrderForPreference(normalizedPreference).map(async (key) => {
        snapshots[key] = await readGatewaySnapshot(snapshots[key].gateway);
      }),
    );

    return snapshots;
  }

  async function selectGatewayOperation(methodName) {
    const snapshots = await getSnapshots();
    const selected = selectGatewaySnapshot(snapshots, normalizedPreference);
    if (!selected) {
      throw createUnavailableGatewayError(snapshots, normalizedPreference);
    }

    const operation = selected.gateway?.[methodName];
    if (typeof operation !== 'function') {
      throw new Error(`Selected cloud gateway does not implement ${methodName}.`);
    }

    return {
      gateway: selected.gateway,
      operation,
    };
  }

  function createCompletionMethod(methodName) {
    return async function complete(args = {}) {
      const { gateway, operation } = await selectGatewayOperation(methodName);
      return operation.call(gateway, args);
    };
  }

  return {
    async getStatus() {
      const snapshots = await getSnapshots();
      return buildGatewayStatus(snapshots, normalizedPreference);
    },

    completeText: createCompletionMethod('completeText'),
    completeJson: createCompletionMethod('completeJson'),
  };
}
