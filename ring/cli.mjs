#!/usr/bin/env node

/**
 * ring-cli — Command-line interface for the dp-ring protocol.
 *
 * Usage:
 *   node ring/cli.mjs <command> [options]
 *
 * Commands:
 *   create <type> --name <name> [--status <status>] [--created-by <actor>] [--data <json>]
 *   read <type> <id>
 *   list <type> [--status <status>]
 *   update <type> <id> --status <new-status>
 *   validate <type> <file>
 *   gate <milestone-id>
 *   rank <task-type>
 *   new-id <type> --name <name> [--parent-id <id>]
 *   knowledge <task-type> [--min-confidence <float>]
 *   context <session-id>
 */

import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRing } from './index.mjs';

const args = process.argv.slice(2);
const command = args[0];

function flag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function positional(n) {
  // Skip flags and their values; collect positional args
  const positionals = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) { i++; continue; } // skip flag + value
    positionals.push(args[i]);
  }
  return positionals[n] ?? undefined;
}

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

async function main() {
  if (!command || command === '--help') {
    console.log(`
ring-cli — dp-ring protocol command-line interface

Commands:
  create <type>          Create a new artifact (--name, --status, --created-by, --data)
  read <type> <id>       Read an artifact by type and id
  list <type>            List all artifacts of a type (--status to filter)
  update <type> <id>     Update an artifact (--status, --data)
  validate <type> <file> Validate a JSON file against a schema
  gate <milestone-id>    Evaluate gate prerequisites for a milestone
  rank <task-type>       Show ranked workflows for a task type
  new-id <type>          Generate a new artifact ID (--name, --parent-id)
  knowledge <task-type>  Get relevant distilled knowledge (--min-confidence)
  context <session-id>   Get the full session startup context for an agent
`.trim());
    process.exit(0);
  }

  // Find repo root (walk up from cwd until we find .ring/)
  let repoRoot = process.cwd();
  while (true) {
    try {
      await readFile(resolve(repoRoot, '.ring', 'config.json'), 'utf-8');
      break;
    } catch {
      const parent = resolve(repoRoot, '..');
      if (parent === repoRoot) die('Cannot find .ring/ directory. Are you inside a dp-ring repository?');
      repoRoot = parent;
    }
  }

  const ring = await createRing(repoRoot);

  switch (command) {
    case 'create': {
      const type = positional(0);
      if (!type) die('Usage: create <type> --name <name> [--status <status>] [--created-by <actor>] [--data <json>]');
      const name = flag('--name');
      if (!name) die('--name is required for create');
      const id = await ring.newId(type, { name, parentId: flag('--parent-id') });
      const status = flag('--status') ?? getDefaultStatus(type);
      const createdBy = flag('--created-by') ?? 'human';
      let data = {};
      const rawData = flag('--data');
      if (rawData) {
        try { data = JSON.parse(rawData); }
        catch { die('--data must be valid JSON'); }
      }
      // For convenience, auto-fill name into data if not present
      if (!data.name) data.name = name;
      const result = await ring.create(type, { id, status, data, created_by: createdBy });
      if (!result.ok) die(`Validation failed:\n${JSON.stringify(result.errors, null, 2)}`);
      console.log(JSON.stringify(result.artifact, null, 2));
      break;
    }

    case 'read': {
      const type = positional(0);
      const id = positional(1);
      if (!type || !id) die('Usage: read <type> <id>');
      try {
        const artifact = await ring.read(type, id);
        console.log(JSON.stringify(artifact, null, 2));
      } catch { die(`Artifact not found: ${type}/${id}`); }
      break;
    }

    case 'list': {
      const type = positional(0);
      if (!type) die('Usage: list <type> [--status <status>]');
      let items = await ring.list(type);
      const statusFilter = flag('--status');
      if (statusFilter) items = items.filter(i => i.status === statusFilter);
      console.log(JSON.stringify(items, null, 2));
      break;
    }

    case 'update': {
      const type = positional(0);
      const id = positional(1);
      if (!type || !id) die('Usage: update <type> <id> --status <new-status>');
      const patch = {};
      const newStatus = flag('--status');
      if (newStatus) patch.status = newStatus;
      const rawData = flag('--data');
      if (rawData) {
        try { patch.data = JSON.parse(rawData); }
        catch { die('--data must be valid JSON'); }
      }
      if (Object.keys(patch).length === 0) die('Provide --status and/or --data');
      const result = await ring.update(type, id, patch);
      if (!result.ok) die(`Update failed:\n${JSON.stringify(result.errors, null, 2)}`);
      console.log(JSON.stringify(result.artifact, null, 2));
      break;
    }

    case 'validate': {
      const type = positional(0);
      const filePath = positional(1);
      if (!type || !filePath) die('Usage: validate <type> <file>');
      const raw = await readFile(resolve(filePath), 'utf-8');
      const doc = JSON.parse(raw);
      const { valid, errors } = ring.validator.validate(type, doc);
      if (valid) { console.log('Valid.'); }
      else {
        console.error('Validation errors:');
        console.error(JSON.stringify(errors, null, 2));
        process.exit(1);
      }
      break;
    }

    case 'gate': {
      const milestoneId = positional(0);
      if (!milestoneId) die('Usage: gate <milestone-id>');
      const result = await ring.checkGate(milestoneId);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
      break;
    }

    case 'rank': {
      const taskType = positional(0);
      if (!taskType) die('Usage: rank <task-type>');
      const ranked = await ring.registry.rank(taskType);
      if (ranked.length === 0) console.log('No workflows ranked for this task type.');
      else console.log(JSON.stringify(ranked, null, 2));
      break;
    }

    case 'new-id': {
      const type = positional(0);
      if (!type) die('Usage: new-id <type> --name <name>');
      const name = flag('--name');
      if (!name) die('--name is required');
      const id = await ring.newId(type, { name, parentId: flag('--parent-id') });
      console.log(id);
      break;
    }

    case 'knowledge': {
      const taskType = positional(0);
      if (!taskType) die('Usage: knowledge <task-type>');
      const minConf = flag('--min-confidence');
      const items = await ring.knowledge(taskType, minConf ? parseFloat(minConf) : undefined);
      console.log(JSON.stringify(items, null, 2));
      break;
    }

    case 'context': {
      const sessionId = positional(0);
      if (!sessionId) die('Usage: context <session-id>');
      const ctx = await ring.sessionContext(sessionId);
      console.log(JSON.stringify(ctx, null, 2));
      break;
    }

    default:
      die(`Unknown command: "${command}". Use --help to see available commands.`);
  }
}

function getDefaultStatus(type) {
  const defaults = {
    requirement:    'draft',
    milestone:      'draft',
    task:           'pending',
    workflow:        'active',
    'workflow-run': 'pending',
    session:        'gate_pending',
    evaluation:     'draft',
    feedback:       'open',
    distillation:   'draft',
  };
  return defaults[type] ?? 'draft';
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
