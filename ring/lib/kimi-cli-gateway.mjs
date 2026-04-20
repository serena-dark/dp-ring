import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_COMMAND = 'kimi';
const DEFAULT_MODEL = 'cli-default';

function trimString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseJsonSafe(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'gu');

function stripAnsi(value) {
  return String(value ?? '').replace(ANSI_PATTERN, '');
}

function stripResumeFooter(value) {
  return stripAnsi(value)
    .replace(/\n*To resume this session: kimi -r [^\n]+\s*$/u, '')
    .trim();
}

function stripJsonFences(value) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/u);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonCodeBlock(value) {
  const matches = value.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gu);
  for (const match of matches) {
    const candidate = match[1].trim();
    if (parseJsonSafe(candidate, null) !== null) {
      return candidate;
    }
  }
  return null;
}

function extractJsonText(value) {
  const cleaned = stripResumeFooter(value);
  const unfenced = stripJsonFences(cleaned);
  if (parseJsonSafe(unfenced, null) !== null) {
    return unfenced;
  }

  const codeBlock = extractJsonCodeBlock(cleaned);
  if (codeBlock) {
    return codeBlock;
  }

  const objectMatch = unfenced.match(/\{[\s\S]*\}/u);
  if (objectMatch && parseJsonSafe(objectMatch[0], null) !== null) {
    return objectMatch[0];
  }

  const arrayMatch = unfenced.match(/\[[\s\S]*\]/u);
  if (arrayMatch && parseJsonSafe(arrayMatch[0], null) !== null) {
    return arrayMatch[0];
  }

  return unfenced;
}

function buildError(message, details = null) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function credentialsDefaultPath() {
  return join(homedir(), '.kimi', 'credentials', 'kimi-code.json');
}

async function readCredentials(credentialsPath) {
  const raw = await readFile(credentialsPath, 'utf-8').catch(() => null);
  return raw ? parseJsonSafe(raw, null) : null;
}

async function runSpawn(command, args, { cwd = null, input = '' } = {}) {
  return await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: cwd ?? undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr, code });
        return;
      }
      rejectRun(buildError(`Kimi CLI exited with code ${code}.`, { stdout, stderr, code }));
    });

    child.stdin.end(input);
  });
}

function buildTextPrompt({ instructions, input, metadata = null }) {
  const parts = [];
  if (trimString(instructions)) {
    parts.push(String(instructions).trim());
  }
  if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
    parts.push(`Metadata:\n${JSON.stringify(metadata, null, 2)}`);
  }
  if (trimString(input)) {
    parts.push(`Input:\n${String(input).trim()}`);
  }
  return parts.join('\n\n').trim();
}

function buildJsonPrompt({ instructions, input, schemaName, schema, metadata = null }) {
  return [
    trimString(instructions) ?? 'Return a structured response.',
    'Return ONLY valid JSON.',
    'Do not use markdown fences.',
    'Do not include explanatory text before or after the JSON.',
    `Schema name: ${schemaName}`,
    `Schema:\n${JSON.stringify(schema, null, 2)}`,
    metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0
      ? `Metadata:\n${JSON.stringify(metadata, null, 2)}`
      : null,
    trimString(input) ? `Input:\n${String(input).trim()}` : null,
  ].filter(Boolean).join('\n\n');
}

function resolveThinking(reasoning) {
  const effort = trimString(reasoning?.effort);
  if (effort === 'low') {
    return false;
  }
  if (effort === 'medium' || effort === 'high') {
    return true;
  }
  return null;
}

async function defaultProbeCli({ command }) {
  try {
    const { stdout } = await runSpawn(command, ['info']);
    const versionLine = stripAnsi(stdout)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.startsWith('kimi-cli version:'));
    return {
      available: true,
      version: versionLine?.split(':').slice(1).join(':').trim() ?? null,
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      error: error.message,
    };
  }
}

async function defaultRunPrompt({ command, prompt, model = null, workdir = null, thinking = null }) {
  const args = [
    '--print',
    '--input-format', 'text',
    '--output-format', 'text',
    '--final-message-only',
  ];
  if (workdir) {
    args.push('-w', workdir);
  }
  if (trimString(model)) {
    args.push('-m', model.trim());
  }
  if (thinking === true) {
    args.push('--thinking');
  } else if (thinking === false) {
    args.push('--no-thinking');
  }

  const { stdout } = await runSpawn(command, args, {
    cwd: workdir,
    input: prompt,
  });
  return stdout;
}

export function createKimiCliGateway(repoRoot, {
  command = DEFAULT_COMMAND,
  credentialsPath = credentialsDefaultPath(),
  env = process.env,
  probeCli = null,
  runPrompt = null,
} = {}) {
  const cliProbe = probeCli ?? ((args) => defaultProbeCli(args));
  const promptRunner = runPrompt ?? ((request) => defaultRunPrompt(request));

  async function getStatus() {
    const [credentials, cli] = await Promise.all([
      readCredentials(credentialsPath),
      cliProbe({ command }),
    ]);

    const connected = Boolean(trimString(credentials?.access_token) || trimString(credentials?.refresh_token));
    return {
      provider: 'kimi',
      cli: {
        command,
        available: Boolean(cli?.available),
        version: trimString(cli?.version),
        credentials_path: credentialsPath,
        credentials_present: Boolean(credentials),
      },
      responses: {
        api_base_url: 'cli://kimi',
        default_model: trimString(env.KIMI_MODEL) ?? DEFAULT_MODEL,
        auth_mode: connected ? 'oauth' : 'none',
        available: Boolean(cli?.available) && connected,
      },
      session: {
        connected,
        expires_at: trimString(credentials?.expires_at),
        updated_at: null,
        scope: [],
        token_type: 'Bearer',
        user: {
          sub: null,
          email: null,
          name: null,
          preferred_username: null,
        },
      },
    };
  }

  async function completeText({
    instructions,
    input,
    model = null,
    reasoning = null,
    metadata = null,
  } = {}) {
    const status = await getStatus();
    if (!status.responses.available) {
      throw buildError('Kimi CLI is not available or authenticated.', status);
    }

    const prompt = buildTextPrompt({ instructions, input, metadata });
    const rawOutput = await promptRunner({
      command,
      prompt,
      model,
      thinking: resolveThinking(reasoning),
      workdir: repoRoot,
    });
    const outputText = stripResumeFooter(rawOutput);

    return {
      provider: 'kimi',
      auth_mode: 'oauth',
      model: trimString(model) ?? status.responses.default_model,
      output_text: outputText,
      response: {
        raw_output: rawOutput,
      },
    };
  }

  async function completeJson({
    instructions,
    input,
    schemaName,
    schema,
    model = null,
    reasoning = null,
    metadata = null,
  } = {}) {
    const status = await getStatus();
    if (!status.responses.available) {
      throw buildError('Kimi CLI is not available or authenticated.', status);
    }

    const prompt = buildJsonPrompt({
      instructions,
      input,
      schemaName,
      schema,
      metadata,
    });
    const rawOutput = await promptRunner({
      command,
      prompt,
      model,
      thinking: resolveThinking(reasoning),
      workdir: repoRoot,
    });
    const outputText = extractJsonText(rawOutput);
    const parsed = parseJsonSafe(outputText, null);

    if (!parsed || typeof parsed !== 'object') {
      throw buildError('Kimi CLI returned a non-JSON structured response.', {
        raw_output: rawOutput,
        output_text: outputText,
      });
    }

    return {
      provider: 'kimi',
      auth_mode: 'oauth',
      model: trimString(model) ?? status.responses.default_model,
      output_text: outputText,
      parsed,
      response: {
        raw_output: rawOutput,
      },
    };
  }

  return {
    getStatus,
    completeText,
    completeJson,
  };
}
