#!/usr/bin/env node
// MeadowCRM V1 task DAG helper - zero dependencies, plain Node.
// Reads/writes ../tasks.json. Usage: node docs/tasks/cli/tasks.js <command> [args]

'use strict';
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'tasks.json');
const VALID_STATUSES = ['pending', 'in_progress', 'done', 'deferred'];

// Statuses that take a task out of the active plan entirely. `deferred` is work
// pulled off the critical path and scheduled after feature development;
// `merged` is a tombstone whose content now lives in another task's slice.
// Neither is set through `status` - `merged` is written by the slice merge, and
// both are excluded from progress percentages and from the blocked list.
const PARKED_STATUSES = ['deferred', 'merged'];
const isParked = (t) => PARKED_STATUSES.includes(t.status);

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
    // A parked dependency is not something we are waiting for: deferred work was
    // deliberately taken off the critical path, so it must not gate readiness.
    return dep && (dep.status === 'done' || isParked(dep));
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

/**
 * How many tasks finishing this one would actually release.
 *
 * Only live work counts. A `done` descendant was never waiting; a `merged` one
 * is a tombstone whose content is already counted inside the slice that absorbed
 * it; a `deferred` one was taken off the critical path on purpose. Counting any
 * of the three inflated the figure by roughly a third and, worse, flattered the
 * tasks deepest in the stack — the ones with the most history beneath them.
 *
 * The walk still traverses *through* parked and finished tasks, because an edge
 * that runs through them still reaches live work on the far side.
 */
function descendantCount(data) {
  const kids = childMap(data);
  const map = byId(data);
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
    let live = 0;
    for (const id of seen) {
      const task = map.get(id);
      if (task && task.status !== 'done' && !isParked(task)) live++;
    }
    counts.set(t.id, live);
  }
  return counts;
}

/**
 * Live prerequisites still standing between a task and being buildable.
 *
 * The counterpart to descendantCount, and the one that answers "what could we
 * show somebody". Fan-out ranks a task by what waits on it, so it always favours
 * schemas and route contracts — everything sits on top of those. A vertical
 * slice is a leaf: nothing depends on a demo, so fan-out ranks every demo last.
 * Distance-to-buildable inverts that and asks how much is left underneath.
 */
function prerequisiteDepth(data) {
  const map = byId(data);
  const depth = new Map();
  for (const t of data.tasks) {
    const blocking = new Set();
    const visited = new Set();
    const stack = [t.id];
    while (stack.length) {
      const current = map.get(stack.pop());
      for (const depId of current?.depends_on || []) {
        const dep = map.get(depId);
        if (!dep || visited.has(depId)) continue;
        visited.add(depId);
        // Parked and finished prerequisites are not in the way, but the chain
        // above them may still hold live work, so keep walking through.
        if (dep.status !== 'done' && !isParked(dep)) blocking.add(depId);
        stack.push(depId);
      }
    }
    depth.set(t.id, blocking);
  }
  return depth;
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

  // Both flags mean "filter to a person", so an unresolved handle has to stop
  // here. Falling through would silently widen the list to the whole ready set -
  // and an unattended /build-task reads the top line of that and starts building
  // whatever has the most fan-out, which is exactly the work nobody assigned.
  if ((opts.mine || opts.claimed) && !owner) {
    console.error(
      `next --${opts.claimed ? 'claimed' : 'mine'} needs a handle, and none resolved.\n` +
        'Set SALESNOVA_DEV, pass --as <handle>, or run from a checkout with git config user.name.'
    );
    process.exitCode = 1;
    return;
  }

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

/**
 * What could we put in front of somebody, soonest.
 *
 * `next` answers a different question - which task releases the most work - and
 * because a demo is a leaf in the graph it ranks every demo last. That ordering
 * builds the stack bottom-up and leaves nothing to show. This ranks the same
 * graph by how far each demo-gated slice still is from buildable, and then names
 * the tasks in the way, so the shared ones are visible.
 */
function cmdDemo(data, opts) {
  const map = byId(data);
  const depth = prerequisiteDepth(data);
  const limit = opts.limit ? Number(opts.limit) : 10;

  const slices = filterTasks(
    data.tasks.filter((t) => t.track === 'fullstack' && t.status !== 'done' && !isParked(t)),
    { ...opts, track: undefined }
  ).sort(
    (a, b) =>
      depth.get(a.id).size - depth.get(b.id).size ||
      a.gate.localeCompare(b.gate) ||
      a.id.localeCompare(b.id)
  );

  if (slices.length === 0) {
    console.log('No demo-gated slices match those filters.');
    return;
  }

  console.log(`${slices.length} slice(s) not yet demoable, nearest first:\n`);
  const shown = slices.slice(0, limit);
  for (const t of shown) {
    const n = depth.get(t.id).size;
    const away = (n === 0 ? 'buildable now' : `${n} task(s) away`).padStart(15);
    const title = t.title.replace(/^Slice:\s*/, '');
    console.log(`  ${away}  [${t.gate}]  ${t.id.padEnd(17)}${title}${ownerLabel(t)}`);
  }
  if (slices.length > shown.length) {
    console.log(`  ... and ${slices.length - shown.length} further out (--limit to see more)`);
  }

  // A task in the way of several slices at once buys more than its fan-out says.
  // Tallied over everything within reach rather than over the printed rows, so
  // --limit changes what is listed above without changing this answer.
  const NEARBY = 3;
  const tally = new Map();
  for (const t of slices.filter((s) => depth.get(s.id).size <= NEARBY)) {
    for (const blockerId of depth.get(t.id)) {
      if (!tally.has(blockerId)) tally.set(blockerId, []);
      tally.get(blockerId).push(t.id);
    }
  }
  const shared = [...tally.entries()]
    .filter(([, slicesBlocked]) => slicesBlocked.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (shared.length) {
    console.log(`\nIn the way of more than one slice within ${NEARBY} tasks of demoable:\n`);
    for (const [blockerId, slicesBlocked] of shared.slice(0, 10)) {
      const b = map.get(blockerId);
      const ready = isReady(b, map) ? 'ready' : b.status;
      console.log(
        `  ${blockerId.padEnd(17)}unlocks ${String(slicesBlocked.length).padStart(2)}  [${b.track}/${ready}]  ${b.title}${ownerLabel(b)}`
      );
    }
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
    console.error('Usage: status <TASK-ID> <pending|in_progress|done|deferred>');
    process.exitCode = 1;
    return;
  }
  if (!VALID_STATUSES.includes(newStatus)) {
    console.error(`Invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  {
    const existing = byId(data).get(id);
    if (existing && existing.status === 'merged') {
      console.error(`${id} was merged into ${existing.merged_into}. Set the status on that task instead.`);
      process.exitCode = 1;
      return;
    }
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

  if (newStatus === 'done') {
    const bad = residualGate(t);
    if (bad.length) {
      console.error(`${id} cannot be marked done - ${bad.length} residual(s) are not properly recorded:`);
      for (const b of bad) console.error(`  ${b}`);
      console.error(`\nEvery residual needs a type (${RESIDUAL_TYPES.join(' | ')}), and a`);
      console.error(`blocked_on_unbuilt residual needs a closes_when naming the task that closes it.`);
      console.error(`Debt that names no owner is debt nobody closes. Pass --force to override.`);
      if (!opts.force) { process.exitCode = 1; return; }
    }
  }

  const prev = t.status;
  t.status = newStatus;
  const autoClosed = newStatus === 'done' ? closeResidualsSatisfiedBy(data, id) : [];
  save(data);
  console.log(`${id}: ${prev} -> ${newStatus}${t.owner ? `  @${ownerOf(t)}` : ''}`);
  if (newStatus === 'done') {
    const nowReady = data.tasks.filter((x) => x.depends_on.includes(id) && isReady(x, map));
    if (nowReady.length) {
      console.log(`\nNewly unblocked:`);
      for (const nt of nowReady) console.log(`  ${nt.id}  [${nt.track}]  ${nt.title}`);
    }
    if (autoClosed.length) {
      console.log(`\nResiduals closed by this (every task they were waiting on is now done):`);
      for (const r of autoClosed) console.log(`  ${r.id}  ${r.text.slice(0, 88)}`);
    }
    const stillOpen = (t.residuals || []).filter((r) => r.status === 'open');
    if (stillOpen.length) {
      console.log(`\n${id} carries ${stillOpen.length} open residual(s) - they outlive this task:`);
      for (const r of stillOpen) console.log(`  [${r.type}] ${r.id}${r.closes_when.length ? ' -> ' + r.closes_when.join(', ') : ''}`);
    }
  }
}

// ---- Residuals -------------------------------------------------------------
// A residual is a known shortfall recorded against a task that was otherwise
// completed. Keeping them on the task, rather than spawning a follow-up task
// each, stops a 160-item debt list from doubling the size of the backlog - but
// only works if the CLI refuses to let one be recorded without a fate.
const RESIDUAL_TYPES = ['blocked_on_unbuilt', 'deferred_verification', 'decision_needed', 'spec_defect', 'known_gap'];

function residualGate(t) {
  const bad = [];
  for (const r of t.residuals || []) {
    if (r.status !== 'open') continue;
    if (!r.type || !RESIDUAL_TYPES.includes(r.type)) bad.push(`${r.id}: missing or unknown type "${r.type}"`);
    else if (r.type === 'blocked_on_unbuilt' && !(r.closes_when || []).length) bad.push(`${r.id}: blocked_on_unbuilt with no closes_when`);
  }
  return bad;
}

// When a task goes done, any residual anywhere that was waiting only on tasks
// which are now all done closes itself. This is the whole reason the largest
// category never became a backlog item.
function closeResidualsSatisfiedBy(data, doneId) {
  const map = byId(data);
  const closed = [];
  for (const t of data.tasks) {
    for (const r of t.residuals || []) {
      if (r.status !== 'open' || r.type !== 'blocked_on_unbuilt') continue;
      if (!(r.closes_when || []).includes(doneId)) continue;
      const allDone = r.closes_when.every((x) => { const d = map.get(x); return d && d.status === 'done'; });
      if (allDone) { r.status = 'closed'; r.closed_by = doneId; closed.push(r); }
    }
  }
  return closed;
}

function cmdResiduals(data, opts) {
  const rows = [];
  for (const t of data.tasks) {
    for (const r of t.residuals || []) {
      if (opts.all !== true && r.status !== 'open') continue;
      if (opts.type && r.type !== opts.type) continue;
      if (opts.domain && t.domain !== opts.domain) continue;
      if (opts.gate && t.gate !== opts.gate) continue;
      rows.push({ t, r });
    }
  }
  if (!rows.length) { console.log('No residuals match.'); return; }
  const map = byId(data);
  const byType = {};
  for (const { r } of rows) byType[r.type] = (byType[r.type] || 0) + 1;
  console.log(`${rows.length} residual(s): ` + Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(', ') + '\n');
  let last = '';
  for (const { t, r } of rows.sort((a, b) => (a.r.type + a.t.id).localeCompare(b.r.type + b.t.id))) {
    if (r.type !== last) { last = r.type; console.log(`\n== ${r.type}`); }
    const waiting = (r.closes_when || []).map((x) => { const d = map.get(x); return `${x}[${d ? d.status : 'MISSING'}]`; }).join(' ');
    console.log(`  ${r.id}${r.status === 'closed' ? ' (closed)' : ''}`);
    console.log(`    ${r.text.slice(0, 150)}`);
    if (waiting) console.log(`    waiting on: ${waiting}`);
  }
}

// A gate cannot be declared exited while a spec defect recorded inside it is
// still open: that is a requirement nobody has decided, not a task nobody has done.
function cmdGateExit(data, gate) {
  if (!gate) { console.error('Usage: gate-exit <G0|G1|G2|G3|G4|G5>'); process.exitCode = 1; return; }
  const inGate = data.tasks.filter((t) => t.gate === gate && !isParked(t));
  const unfinished = inGate.filter((t) => t.status !== 'done');
  const defects = [];
  for (const t of data.tasks) {
    for (const r of t.residuals || []) {
      if (r.status === 'open' && r.type === 'spec_defect' && t.gate === gate) defects.push({ t, r });
    }
  }
  console.log(`${gate}: ${inGate.length - unfinished.length}/${inGate.length} tasks done`);
  if (defects.length) {
    console.log(`\n${defects.length} open spec defect(s) recorded in ${gate} - these block the gate:`);
    for (const { t, r } of defects) console.log(`  ${r.id}  (${t.id})  ${r.text.slice(0, 110)}`);
  }
  const ok = !unfinished.length && !defects.length;
  console.log(`\n${gate} exit: ${ok ? 'CLEAR' : 'BLOCKED'}`);
  if (!ok) process.exitCode = 1;
}

function cmdBlocked(data, opts) {
  const map = byId(data);
  const blocked = filterTasks(
    data.tasks.filter((t) => t.status !== 'done' && !isParked(t) && !isReady(t, map)),
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
  const active = data.tasks.filter((t) => !isParked(t));
  const groups = {};
  for (const t of active) {
    const key = t[groupBy] || 'unknown';
    if (!groups[key]) groups[key] = { total: 0, done: 0, in_progress: 0 };
    groups[key].total++;
    if (t.status === 'done') groups[key].done++;
    if (t.status === 'in_progress') groups[key].in_progress++;
  }
  const totalAll = active.length;
  const doneAll = active.filter((t) => t.status === 'done').length;
  const inProgAll = active.filter((t) => t.status === 'in_progress').length;
  const deferredAll = data.tasks.filter((t) => t.status === 'deferred').length;
  const mergedAll = data.tasks.filter((t) => t.status === 'merged').length;
  console.log(`Overall: ${doneAll}/${totalAll} done (${((doneAll / totalAll) * 100).toFixed(1)}%), ${inProgAll} in progress`);
  console.log(`Parked:  ${deferredAll} deferred, ${mergedAll} merged into slices (excluded from the figures above)\n`);
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

  const rIds = new Set();
  for (const t of data.tasks) {
    for (const r of t.residuals || []) {
      if (rIds.has(r.id)) { console.log(`DUPLICATE RESIDUAL ID: ${r.id}`); problems++; }
      rIds.add(r.id);
      if (!RESIDUAL_TYPES.includes(r.type)) { console.log(`RESIDUAL BAD TYPE: ${r.id} has "${r.type}"`); problems++; }
      for (const c of r.closes_when || []) {
        if (!ids.has(c)) { console.log(`RESIDUAL DANGLING closes_when: ${r.id} -> ${c}`); problems++; }
        else if (map.get(c).status === 'merged') { console.log(`RESIDUAL closes_when POINTS AT TOMBSTONE: ${r.id} -> ${c} (use ${map.get(c).merged_into})`); problems++; }
      }
      if (r.status === 'open' && r.type === 'blocked_on_unbuilt' && !(r.closes_when || []).length) {
        console.log(`RESIDUAL blocked_on_unbuilt WITH NO TARGET: ${r.id}`); problems++;
      }
      if (r.status === 'open' && r.type === 'blocked_on_unbuilt' &&
          (r.closes_when || []).length && r.closes_when.every((c) => map.get(c) && map.get(c).status === 'done')) {
        console.log(`RESIDUAL MAY BE CLOSEABLE: ${r.id} - every task it waits on is done`);
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
  demo [--limit N]        Demo-gated slices ranked by how far each is from buildable, plus the
                          tasks in the way of more than one. Use this to pick what to show.
  show <TASK-ID>          Full detail: description, spec refs, dependency status, acceptance criteria
  status <TASK-ID> <s>    Set status to pending | in_progress | done; reports newly-unblocked tasks
  blocked                 List tasks not yet ready, and exactly what they're waiting on
  progress [--by X]       Completion percentage overall and by gate|track|domain (default: gate)
  graph <TASK-ID>         Full ancestor/descendant chain for one task
  depends <ID> on|drop <DEP-ID...>   Add or remove dependency edges; refuses cycles
  residuals [--type T]    Open residuals recorded against completed tasks, grouped by type.
                          --type blocked_on_unbuilt|deferred_verification|decision_needed|
                                 spec_defect|known_gap   --domain D  --gate G  --all
  gate-exit <GATE>        Whether a gate can be exited: unfinished tasks + open spec defects
  validate                Check for duplicate ids, dangling refs, cycles, residual integrity

  whoami                  Print the handle every command below will act as
  claim <TASK-ID...>      Put your name on tasks so the other developer sees them taken
  claim --ready [--limit N]   Claim the N highest-fan-out unclaimed ready tasks (default 3)
  release <TASK-ID...>    Drop your claim
  mine                    Everything you have claimed

Filters (next, blocked, mine, claim, demo): --track backend|frontend|design|infra|qa  --domain ARCH
                                      --gate G0   --owner <handle>   --unassigned

next lists most-leverage-first. "unblocks 141 via 1" means 141 live tasks downstream
reached through 1 direct child - one big subtree passing through, not this task's own
breadth. Done, merged and deferred tasks are not counted: none of them is waiting.

next and demo answer different questions, and the second is usually the one being asked.
Fan-out ranks a task by what sits on top of it, so schemas and route contracts always win
and a demo - a leaf nothing depends on - always loses. Ranking by fan-out alone builds the
stack bottom-up and leaves nothing to show. Pick a slice with demo, then let next order
the work inside it.

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
    case 'demo':
      return cmdDemo(data, opts);
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
    case 'residuals':
      return cmdResiduals(data, opts);
    case 'gate-exit':
      return cmdGateExit(data, positional[0]);
    case 'validate':
      return cmdValidate(data);
    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

main();
