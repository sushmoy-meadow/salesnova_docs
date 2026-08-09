#!/usr/bin/env node
// MeadowCRM V1 task DAG helper - zero dependencies, plain Node.
// Reads/writes ../tasks.json. Usage: node docs/tasks/cli/tasks.js <command> [args]

'use strict';
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'tasks.json');
const VALID_STATUSES = ['pending', 'in_progress', 'done'];

function load() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
}

function byId(data) {
  const map = new Map();
  for (const t of data.tasks) map.set(t.id, t);
  return map;
}

function isReady(task, map) {
  if (task.status !== 'pending') return false;
  if (task.blocked_reason) return false;
  return task.depends_on.every((depId) => {
    const dep = map.get(depId);
    return dep && dep.status === 'done';
  });
}

// A handle is the first word of a name, lowercased, so "Sakib Khan", "sakib"
// and a git user.name all land on the same person.
function normaliseOwner(who) {
  return String(who).trim().split(/\s+/)[0].toLowerCase();
}

/**
 * Who is running this. Explicit flag, then the env var a shared shell can set,
 * then the git identity - which is already per-machine and already correct.
 */
function resolveOwner(opts = {}) {
  for (const flag of [opts.to, opts.as]) {
    if (flag && flag !== true) return normaliseOwner(flag);
  }
  if (process.env.SALESNOVA_DEV) return normaliseOwner(process.env.SALESNOVA_DEV);
  try {
    const name = require('child_process')
      .execSync('git config user.name', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return name.trim() ? normaliseOwner(name) : null;
  } catch {
    return null;
  }
}

function ownerOf(task) {
  return task.owner ? normaliseOwner(task.owner) : null;
}

function childMap(data) {
  const kids = new Map();
  for (const t of data.tasks) {
    for (const d of t.depends_on) {
      if (!kids.has(d)) kids.set(d, []);
      kids.get(d).push(t.id);
    }
  }
  return kids;
}

function descendantCount(data) {
  const kids = childMap(data);
  const counts = new Map();
  for (const t of data.tasks) {
    const seen = new Set();
    const stack = [t.id];
    while (stack.length) {
      for (const kid of kids.get(stack.pop()) || []) {
        if (!seen.has(kid)) {
          seen.add(kid);
          stack.push(kid);
        }
      }
    }
    counts.set(t.id, seen.size);
  }
  return counts;
}

function parseArgs(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    } else {
      rest.push(a);
    }
  }
  return { opts, rest };
}

function filterTasks(tasks, opts) {
  const owner = opts.owner ? normaliseOwner(opts.owner) : null;
  return tasks.filter(
    (t) =>
      (!opts.track || t.track === opts.track) &&
      (!opts.domain || t.domain === opts.domain) &&
      (!opts.gate || t.gate === opts.gate) &&
      (!opts.unassigned || ownerOf(t) === null) &&
      (!owner || ownerOf(t) === owner)
  );
}

function ownerLabel(task) {
  return task.owner ? `  @${ownerOf(task)}` : '';
}

function cmdNext(data, opts) {
  const map = byId(data);
  const owner = opts.mine || opts.claimed
    ? resolveOwner(opts)
    : (opts.owner && opts.owner !== true ? normaliseOwner(opts.owner) : null);

  // --claimed is your assignment and nothing else. --mine and --owner also keep
  // unclaimed tasks, because those answer "what may I pick up" rather than
  // "what did we agree I would build".
  const inScope = (t) => {
    if (!owner) return true;
    if (opts.claimed) return ownerOf(t) === owner;
    return ownerOf(t) === null || ownerOf(t) === owner;
  };

  const fan = descendantCount(data);
  const kids = childMap(data);
  const ready = filterTasks(
    data.tasks.filter((t) => isReady(t, map)),
    { ...opts, owner: undefined }
  )
    .filter(inScope)
    .sort(
      (a, b) =>
        fan.get(b.id) - fan.get(a.id) ||
        a.gate.localeCompare(b.gate) ||
        a.id.localeCompare(b.id)
    );

  if (ready.length === 0) {
    console.log('No ready tasks match those filters.');
    return;
  }
  const taken = ready.filter((t) => ownerOf(t) !== null).length;
  const suffix = owner && taken && !opts.claimed ? ` (${taken} already claimed by you)` : '';
  console.log(`${ready.length} task(s) ready to start now${suffix}, most leverage first:\n`);
  for (const t of ready) {
    // "via" is the direct-child count: a big number reached through one child is
    // one subtree's leverage passing through, not breadth of this task's own.
    const reach = `unblocks ${fan.get(t.id)} via ${(kids.get(t.id) || []).length}`;
    console.log(
      `  ${t.id.padEnd(17)}[${t.track}/${t.gate}/${t.size}]  ${reach.padEnd(20)}  ${t.title}${ownerLabel(t)}`
    );
  }
}

function cmdWhoami(opts) {
  const who = resolveOwner(opts);
  console.log(who
    ? `@${who}`
    : 'Nobody. Set git config user.name, or SALESNOVA_DEV, or pass --to <handle>.');
}

function cmdMine(data, opts) {
  const who = opts.owner && opts.owner !== true ? opts.owner : resolveOwner(opts);
  if (!who) {
    console.error('Usage: mine [--owner <handle>]');
    process.exitCode = 1;
    return;
  }
  const map = byId(data);
  const owned = filterTasks(data.tasks, { ...opts, owner: who });
  if (owned.length === 0) {
    console.log(`Nothing claimed by @${normaliseOwner(who)}.`);
    return;
  }
  console.log(`${owned.length} task(s) claimed by @${normaliseOwner(who)}:\n`);
  for (const t of owned) {
    const state = t.status === 'pending' && isReady(t, map) ? 'ready' : t.status;
    console.log(`  ${t.id}  [${t.track}/${t.gate}/${t.size}]  ${state.padEnd(11)} ${t.title}`);
  }
}

function cmdClaim(data, ids, opts) {
  const owner = resolveOwner(opts);
  if (!owner) {
    console.error('Cannot tell who you are. Pass --to <handle>, or set git config user.name.');
    process.exitCode = 1;
    return;
  }
  const map = byId(data);

  let targets = ids;
  if (opts.ready) {
    const fan = descendantCount(data);
    const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 3;
    targets = filterTasks(data.tasks.filter((t) => isReady(t, map) && ownerOf(t) === null), {
      ...opts,
      owner: undefined,
      unassigned: undefined,
    })
      .sort((a, b) => fan.get(b.id) - fan.get(a.id))
      .slice(0, limit)
      .map((t) => t.id);
    if (targets.length === 0) {
      console.log('No unclaimed ready tasks match those filters.');
      return;
    }
  }

  if (targets.length === 0) {
    console.error('Name at least one task id, or pass --ready to take the top unclaimed ones.');
    process.exitCode = 1;
    return;
  }

  const claimed = [];
  for (const id of targets) {
    const t = map.get(id);
    if (!t) {
      console.error(`Unknown task id: ${id}`);
      process.exitCode = 1;
      continue;
    }
    const held = ownerOf(t);
    if (held && held !== owner && !opts.force) {
      console.error(`${id} is already claimed by @${held}. Pass --force to take it over.`);
      process.exitCode = 1;
      continue;
    }
    t.owner = owner;
    claimed.push(t);
  }

  if (claimed.length === 0) return;
  save(data);
  console.log(`Claimed for @${owner}:`);
  for (const t of claimed) {
    const state = isReady(t, map) ? 'ready now' : t.status;
    console.log(`  ${t.id}  [${state}]  ${t.title}`);
  }
}

function cmdRelease(data, ids) {
  if (ids.length === 0) {
    console.error('Usage: release <TASK-ID...>');
    process.exitCode = 1;
    return;
  }
  const map = byId(data);
  const freed = [];
  for (const id of ids) {
    const t = map.get(id);
    if (!t) {
      console.error(`Unknown task id: ${id}`);
      process.exitCode = 1;
      continue;
    }
    if (!t.owner) {
      console.log(`${id} was not claimed.`);
      continue;
    }
    freed.push(`${id} (was @${ownerOf(t)})`);
    delete t.owner;
  }
  if (freed.length === 0) return;
  save(data);
  console.log(`Released:\n  ${freed.join('\n  ')}`);
}

// Adding "id depends on dep" closes a cycle exactly when dep already reaches id.
function reachesThroughDeps(map, from, target) {
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const t = map.get(cur);
    if (t) stack.push(...t.depends_on);
  }
  return false;
}

function gateFileFor(gate) {
  const dir = path.join(__dirname, '..');
  return fs.readdirSync(dir).find((f) => f.startsWith(`${gate}-`) && f.endsWith('.md'));
}

function cmdDepends(data, positional, opts) {
  const [id, verb, ...deps] = positional;
  if (!id || !['on', 'drop'].includes(verb) || deps.length === 0) {
    console.error('Usage: depends <TASK-ID> on|drop <DEP-ID...>');
    process.exitCode = 1;
    return;
  }
  const map = byId(data);
  const t = map.get(id);
  if (!t) {
    console.error(`Unknown task id: ${id}`);
    process.exitCode = 1;
    return;
  }

  const changed = [];
  for (const depId of deps) {
    if (!map.has(depId)) {
      console.error(`Unknown task id: ${depId}`);
      process.exitCode = 1;
      continue;
    }
    if (verb === 'drop') {
      if (!t.depends_on.includes(depId)) {
        console.log(`${id} does not depend on ${depId}.`);
        continue;
      }
      t.depends_on = t.depends_on.filter((d) => d !== depId);
      changed.push(`- ${depId}  ${map.get(depId).title}`);
      continue;
    }
    if (depId === id) {
      console.error(`${id} cannot depend on itself.`);
      process.exitCode = 1;
      continue;
    }
    if (t.depends_on.includes(depId)) {
      console.log(`${id} already depends on ${depId}.`);
      continue;
    }
    if (reachesThroughDeps(map, depId, id)) {
      console.error(`${depId} already depends on ${id}; adding this edge would make a cycle.`);
      process.exitCode = 1;
      continue;
    }
    t.depends_on = [...t.depends_on, depId];
    changed.push(`+ ${depId}  ${map.get(depId).title}`);
  }

  if (changed.length === 0) return;
  if (t.status === 'done' && verb === 'on') {
    console.log(`NOTE: ${id} is already done, so the new dependency does not gate anything.`);
  }
  save(data);
  console.log(`${id} dependencies:\n  ${changed.join('\n  ')}`);
  console.log(`\nNow depends on: ${t.depends_on.join(', ') || '(none)'}`);

  const file = gateFileFor(t.gate);
  if (file) {
    console.log(
      `\nThe per-gate reference is hand-written, not generated - update the ${id} row in docs/tasks/${file} to match.`
    );
  }
  if (!opts.quiet) {
    const nowReady = isReady(t, map);
    console.log(nowReady ? `${id} is still ready to start.` : `${id} is no longer ready to start.`);
  }
}

function cmdShow(data, id) {
  const map = byId(data);
  const t = map.get(id);
  if (!t) {
    console.error(`Unknown task id: ${id}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${t.id} - ${t.title}`);
  console.log(`track: ${t.track}  domain: ${t.domain}  gate: ${t.gate}  size: ${t.size}  status: ${t.status}  owner: ${ownerOf(t) ? `@${ownerOf(t)}` : '(unclaimed)'}${t.blocked_reason ? `  blocked: ${t.blocked_reason}` : ''}`);
  console.log(`\nDescription:\n  ${t.description}`);
  console.log(`\nSpec refs: ${t.spec_refs.join(', ') || '(none)'}`);
  console.log(`\nDepends on:`);
  if (t.depends_on.length === 0) {
    console.log('  (none - can start as soon as it is assigned)');
  } else {
    for (const depId of t.depends_on) {
      const dep = map.get(depId);
      console.log(`  ${depId}  [${dep ? dep.status : 'MISSING'}]  ${dep ? dep.title : '(dangling reference)'}`);
    }
  }
  console.log(`\nAcceptance criteria:`);
  for (const ac of t.acceptance_criteria) console.log(`  - ${ac}`);
}

function cmdStatus(data, id, newStatus, opts = {}) {
  if (!id || !newStatus) {
    console.error('Usage: status <TASK-ID> <pending|in_progress|done>');
    process.exitCode = 1;
    return;
  }
  if (!VALID_STATUSES.includes(newStatus)) {
    console.error(`Invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const map = byId(data);
  const t = map.get(id);
  if (!t) {
    console.error(`Unknown task id: ${id}`);
    process.exitCode = 1;
    return;
  }
  const held = ownerOf(t);
  const actor = resolveOwner(opts);
  if (newStatus === 'in_progress' && held && actor && held !== actor) {
    console.error(`${id} is claimed by @${held}. Ask them to release it, or pass --force.`);
    if (!opts.force) {
      process.exitCode = 1;
      return;
    }
  }
  if (newStatus === 'in_progress' && !held && actor) {
    t.owner = actor;
  }

  const prev = t.status;
  t.status = newStatus;
  save(data);
  console.log(`${id}: ${prev} -> ${newStatus}${t.owner ? `  @${ownerOf(t)}` : ''}`);
  if (newStatus === 'done') {
    const nowReady = data.tasks.filter((x) => x.depends_on.includes(id) && isReady(x, map));
    if (nowReady.length) {
      console.log(`\nNewly unblocked:`);
      for (const nt of nowReady) console.log(`  ${nt.id}  [${nt.track}]  ${nt.title}`);
    }
  }
}

function cmdBlocked(data, opts) {
  const map = byId(data);
  const blocked = filterTasks(
    data.tasks.filter((t) => t.status !== 'done' && !isReady(t, map)),
    opts
  );
  console.log(`${blocked.length} task(s) not yet ready:\n`);
  for (const t of blocked) {
    const unmet = t.depends_on.filter((d) => {
      const dep = map.get(d);
      return !dep || dep.status !== 'done';
    });
    const reason = t.blocked_reason ? ` [BLOCKED: ${t.blocked_reason}]` : '';
    const waiting = unmet.length ? `waiting on: ${unmet.join(', ')}` : '(no unmet deps - already in progress or otherwise held)';
    console.log(`  ${t.id}  ${waiting}${reason}`);
  }
}

function cmdProgress(data, opts) {
  const groupBy = ['gate', 'track', 'domain'].includes(opts.by) ? opts.by : 'gate';
  const groups = {};
  for (const t of data.tasks) {
    const key = t[groupBy] || 'unknown';
    if (!groups[key]) groups[key] = { total: 0, done: 0, in_progress: 0 };
    groups[key].total++;
    if (t.status === 'done') groups[key].done++;
    if (t.status === 'in_progress') groups[key].in_progress++;
  }
  const totalAll = data.tasks.length;
  const doneAll = data.tasks.filter((t) => t.status === 'done').length;
  const inProgAll = data.tasks.filter((t) => t.status === 'in_progress').length;
  console.log(`Overall: ${doneAll}/${totalAll} done (${((doneAll / totalAll) * 100).toFixed(1)}%), ${inProgAll} in progress\n`);
  console.log(`By ${groupBy}:`);
  for (const [key, g] of Object.entries(groups).sort()) {
    const pct = ((g.done / g.total) * 100).toFixed(0);
    console.log(`  ${key.padEnd(10)} ${String(g.done).padStart(3)}/${String(g.total).padEnd(3)} done (${pct.padStart(3)}%)  ${g.in_progress} in progress`);
  }
}

function cmdGraph(data, id) {
  const map = byId(data);
  if (!map.has(id)) {
    console.error(`Unknown task id: ${id}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Ancestors (must finish before ${id} can start):`);
  const seenA = new Set();
  (function walkUp(cur, depth) {
    const t = map.get(cur);
    if (!t) return;
    for (const d of t.depends_on) {
      if (seenA.has(d)) continue;
      seenA.add(d);
      const dep = map.get(d);
      console.log(`${'  '.repeat(depth)}${d}  [${dep ? dep.status : '?'}]  ${dep ? dep.title : '(dangling)'}`);
      walkUp(d, depth + 1);
    }
  })(id, 1);

  console.log(`\nDescendants (blocked on ${id}):`);
  const seenD = new Set();
  (function walkDown(cur, depth) {
    for (const t of data.tasks) {
      if (t.depends_on.includes(cur) && !seenD.has(t.id)) {
        seenD.add(t.id);
        console.log(`${'  '.repeat(depth)}${t.id}  [${t.status}]  ${t.title}`);
        walkDown(t.id, depth + 1);
      }
    }
  })(id, 1);
}

function cmdValidate(data) {
  const map = byId(data);
  const ids = new Set(data.tasks.map((t) => t.id));
  let problems = 0;

  const seen = new Set();
  for (const t of data.tasks) {
    if (seen.has(t.id)) {
      console.log(`DUPLICATE ID: ${t.id}`);
      problems++;
    }
    seen.add(t.id);
  }

  for (const t of data.tasks) {
    for (const d of t.depends_on) {
      if (!ids.has(d)) {
        console.log(`DANGLING REF: ${t.id} -> ${d} (does not exist)`);
        problems++;
      }
    }
  }

  const color = new Map();
  function dfs(id, stack) {
    color.set(id, 1);
    const t = map.get(id);
    if (t) {
      for (const d of t.depends_on) {
        if (!map.has(d)) continue;
        const c = color.get(d) || 0;
        if (c === 1) {
          console.log(`CYCLE: ${[...stack, id, d].join(' -> ')}`);
          problems++;
        } else if (c === 0) {
          dfs(d, [...stack, id]);
        }
      }
    }
    color.set(id, 2);
  }
  for (const t of data.tasks) if (!color.get(t.id)) dfs(t.id, []);

  const backwardGateOrder = { G0: 0, G1: 1, G2: 2, G3: 3, G4: 4, G5: 5 };
  let backward = 0;
  for (const t of data.tasks) {
    for (const d of t.depends_on) {
      const dep = map.get(d);
      if (dep && backwardGateOrder[dep.gate] > backwardGateOrder[t.gate]) backward++;
    }
  }
  if (backward > 0) console.log(`NOTE: ${backward} depends_on edge(s) point at a later gate than their own task (informational - gate is a label, not a dependency, but worth a human glance).`);

  // Work nobody's name is on is work the other developer cannot see is taken.
  const anonymous = data.tasks.filter((t) => t.status === 'in_progress' && !t.owner);
  if (anonymous.length) {
    console.log(`NOTE: ${anonymous.length} task(s) in progress with no owner: ${anonymous.map((t) => t.id).join(', ')}`);
  }

  console.log(problems === 0 ? '\nNo structural problems found (0 duplicate ids, 0 dangling refs, 0 cycles).' : `\n${problems} problem(s) found.`);
}

function printHelp() {
  console.log(`MeadowCRM V1 task DAG CLI

Usage: node docs/tasks/cli/tasks.js <command> [args] [--track T] [--domain D] [--gate G]

Commands:
  next                    List tasks ready to start now (all dependencies done, not blocked)
  show <TASK-ID>          Full detail: description, spec refs, dependency status, acceptance criteria
  status <TASK-ID> <s>    Set status to pending | in_progress | done; reports newly-unblocked tasks
  blocked                 List tasks not yet ready, and exactly what they're waiting on
  progress [--by X]       Completion percentage overall and by gate|track|domain (default: gate)
  graph <TASK-ID>         Full ancestor/descendant chain for one task
  depends <ID> on|drop <DEP-ID...>   Add or remove dependency edges; refuses cycles
  validate                Check for duplicate ids, dangling refs, cycles

  whoami                  Print the handle every command below will act as
  claim <TASK-ID...>      Put your name on tasks so the other developer sees them taken
  claim --ready [--limit N]   Claim the N highest-fan-out unclaimed ready tasks (default 3)
  release <TASK-ID...>    Drop your claim
  mine                    Everything you have claimed

Filters (next, blocked, mine, claim): --track backend|frontend|design|infra|qa   --domain ARCH
                                      --gate G0   --owner <handle>   --unassigned

next lists most-leverage-first. "unblocks 141 via 1" means 141 tasks downstream reached
through 1 direct child - one big subtree passing through, not this task's own breadth.

Who you are is resolved in this order, so on your own machine you never type it:
  --to/--as <handle>  >  $SALESNOVA_DEV  >  git config user.name
A handle is the first word of a name, lowercased: "Sakib Khan" and "sakib" are one person.

  next --mine     ready tasks that are unclaimed OR already yours - what you may pick up
  next --claimed  ready tasks you already hold - your assignment, nothing new
  claim/status    refuse to touch a task somebody else holds; --force overrides

Examples:
  node docs/tasks/cli/tasks.js whoami
  node docs/tasks/cli/tasks.js next --claimed --track backend
  node docs/tasks/cli/tasks.js claim --ready --track backend --limit 5
  node docs/tasks/cli/tasks.js claim TASK-ARCH-004 TASK-ARCH-005 --to sakib
  node docs/tasks/cli/tasks.js status TASK-ARCH-004 in_progress
  node docs/tasks/cli/tasks.js mine
`);
}

function main() {
  const [, , cmd, ...rest] = process.argv;
  const { opts, rest: positional } = parseArgs(rest);

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  const data = load();

  switch (cmd) {
    case 'next':
      return cmdNext(data, opts);
    case 'show':
      return cmdShow(data, positional[0]);
    case 'status':
      return cmdStatus(data, positional[0], positional[1], opts);
    case 'whoami':
      return cmdWhoami(opts);
    case 'claim':
      return cmdClaim(data, positional, opts);
    case 'release':
      return cmdRelease(data, positional);
    case 'mine':
      return cmdMine(data, opts);
    case 'blocked':
      return cmdBlocked(data, opts);
    case 'progress':
      return cmdProgress(data, opts);
    case 'graph':
      return cmdGraph(data, positional[0]);
    case 'depends':
      return cmdDepends(data, positional, opts);
    case 'validate':
      return cmdValidate(data);
    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

main();
