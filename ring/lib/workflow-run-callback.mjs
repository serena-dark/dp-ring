import { createHmac } from 'node:crypto';

function callbackState(workflowRunOrCallback) {
  return workflowRunOrCallback?.data?.callback ?? workflowRunOrCallback ?? {};
}

export function callbackSignaturePayload(timestamp, payload) {
  return `${timestamp}.${JSON.stringify(payload ?? {})}`;
}

export function computeCallbackSignature(secret, timestamp, payload) {
  return createHmac('sha256', secret)
    .update(callbackSignaturePayload(timestamp, payload))
    .digest('hex');
}

export function signedWorkflowRunHeaders(
  workflowRunOrCallback,
  payload,
  {
    timestamp = new Date().toISOString(),
    workerId = null,
    includeKeyVersion = false,
  } = {},
) {
  const callback = callbackState(workflowRunOrCallback);
  return {
    headers: {
      authorization: `Bearer ${callback.token}`,
      'x-ring-timestamp': timestamp,
      'x-ring-signature': `sha256=${computeCallbackSignature(
        callback.signing_secret,
        timestamp,
        payload,
      )}`,
      ...(workerId ? { 'x-ring-worker-id': workerId } : {}),
      ...(includeKeyVersion
        ? { 'x-ring-key-version': String(callback.key_version ?? 1) }
        : {}),
    },
  };
}
