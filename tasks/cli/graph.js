#!/usr/bin/env node
// Renders tasks.json as a standalone dependency viewer: waves (what can run at
// once) and a tree (what waits on what). Zero dependencies, plain Node.
// Usage: node docs/tasks/cli/graph.js [--out path]

'use strict';
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'tasks.json');
const DEFAULT_OUT = path.join(__dirname, '..', 'graph.html');

function load() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).tasks;
}

/**
 * Longest path from a dependency root. Tasks sharing a level have no path
 * between them, so every level is a set that can be worked simultaneously.
 */
function levels(tasks, map) {
  const memo = new Map();
  const walk = (id, seen) => {
    if (memo.has(id)) return memo.get(id);
    const task = map.get(id);
    if (!task) return 0;
    if (seen.has(id)) throw new Error(`dependency cycle through ${id}`);
    seen.add(id);
    let deepest = -1;
    for (const dep of task.depends_on) {
      if (map.has(dep)) deepest = Math.max(deepest, walk(dep, seen));
    }
    seen.delete(id);
    const level = deepest + 1;
    memo.set(id, level);
    return level;
  };
  for (const task of tasks) walk(task.id, new Set());
  return memo;
}

function children(tasks) {
  const kids = new Map();
  for (const task of tasks) {
    for (const dep of task.depends_on) {
      if (!kids.has(dep)) kids.set(dep, []);
      kids.get(dep).push(task.id);
    }
  }
  return kids;
}

function fanOut(tasks, kids) {
  const memo = new Map();
  for (const task of tasks) {
    const seen = new Set();
    const stack = [task.id];
    while (stack.length) {
      for (const kid of kids.get(stack.pop()) || []) {
        if (!seen.has(kid)) {
          seen.add(kid);
          stack.push(kid);
        }
      }
    }
    memo.set(task.id, seen.size);
  }
  return memo;
}

function build() {
  const tasks = load();
  const map = new Map(tasks.map((t) => [t.id, t]));
  const level = levels(tasks, map);
  const kids = children(tasks);
  const fan = fanOut(tasks, kids);

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    track: t.track,
    domain: t.domain,
    gate: t.gate,
    size: t.size,
    status: t.status,
    owner: t.owner ? String(t.owner).trim().toLowerCase() : null,
    blocked: t.blocked_reason || null,
    deps: t.depends_on,
    unblocks: kids.get(t.id) || [],
    level: level.get(t.id),
    fan: fan.get(t.id),
    ready:
      t.status === 'pending' &&
      !t.blocked_reason &&
      t.depends_on.every((d) => map.has(d) && map.get(d).status === 'done'),
  }));
}

function render(nodes) {
  // Escaped so a title containing markup cannot close the script element.
  const payload = JSON.stringify(nodes).replace(/</g, '\\u003c');
  return TEMPLATE.replace('__DATA__', payload);
}

const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SalesNova task graph</title>
<script>
// Runs before first paint so the page never flashes the wrong theme. localStorage
// throws on some file:// origins, which only costs the toggle its memory.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('sn-graph-theme'); } catch (e) {}
  document.documentElement.dataset.theme =
    saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
})();
</script>
<style>
/* The theme is resolved to an explicit data-theme by the script in <head>, so
   these two blocks are the whole story - no media query to disagree with them. */
:root {
  color-scheme: light;
  --bg: #fbfbfc; --card: #ffffff; --line: #e2e5ea; --line2: #eef0f3;
  --ink: #14181d; --mute: #737d8a; --faint: #99a2ae;
  --backend: #3b6fe0; --frontend: #a855c7; --qa: #d97f1e; --infra: #159c73; --design: #d1457c;
  --ready: #12965a; --wip: #d97f1e; --shadow: 0 1px 2px rgba(16,22,30,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1014; --card: #161a20; --line: #262c34; --line2: #1e232a;
  --ink: #e8ebef; --mute: #8d97a4; --faint: #6b7482;
  --backend: #5b8bf0; --frontend: #bd77d8; --qa: #e2953c; --infra: #2bb389; --design: #e0648f;
  --ready: #2fb974; --wip: #e2953c; --shadow: none;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
button { font: inherit; color: inherit; }

header { position: sticky; top: 0; z-index: 30; background: var(--bg);
  border-bottom: 1px solid var(--line); padding: 16px 24px 0; }
.brand { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
#theme { margin-left: auto; border: 1px solid var(--line); background: var(--card); cursor: pointer;
  border-radius: 7px; padding: 5px 11px; font-size: 12px; color: var(--mute); }
#theme:hover { color: var(--ink); }
h1 { font-size: 16px; font-weight: 650; margin: 0; letter-spacing: -.01em; }
#summary { font-size: 13px; color: var(--mute); }
.controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
input[type=search], select { font: inherit; font-size: 13px; padding: 6px 10px;
  border: 1px solid var(--line); border-radius: 7px; background: var(--card); color: var(--ink); }
input[type=search] { min-width: 230px; }
.toggle { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; font-size: 13px;
  border: 1px solid var(--line); border-radius: 7px; background: var(--card); cursor: pointer;
  user-select: none; }
.toggle input { margin: 0; accent-color: var(--ready); }
.toggle.off { opacity: .42; }
.swatch { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.tabs { display: flex; gap: 4px; }
.tab { padding: 8px 16px; font-size: 13px; font-weight: 550; background: none; border: 0;
  border-bottom: 2px solid transparent; cursor: pointer; color: var(--mute); }
.tab[aria-selected=true] { color: var(--ink); border-bottom-color: var(--ink); }

main { display: grid; grid-template-columns: minmax(0,1fr) 340px; }
.view { padding: 22px 24px 90px; }
.view[hidden] { display: none; }

.wave { margin-bottom: 30px; }
.wave.empty { display: none; }
.wave-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px;
  padding-bottom: 8px; border-bottom: 1px solid var(--line2); }
.wave-head b { font-size: 13px; font-weight: 650; letter-spacing: .01em; }
.wave-head span { font-size: 12px; color: var(--faint); }
.wave.current .wave-head b { color: var(--ready); }
.cards { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 9px;
  padding: 12px 13px; cursor: pointer; box-shadow: var(--shadow); border-left: 3px solid var(--line);
  transition: border-color .12s, transform .12s; }
.card:hover { transform: translateY(-1px); border-color: var(--faint); }
.card .top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.card .id { font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; }
.card .fan { margin-left: auto; font-size: 11px; color: var(--faint);
  font-variant-numeric: tabular-nums; }
.card .title { margin: 0 0 9px; font-size: 13px; line-height: 1.45; color: var(--ink);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card .meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--faint); }
.tag { border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }
.owner { margin-left: auto; font-weight: 600; padding: 1px 7px; border-radius: 999px;
  font-size: 11px; color: #fff; }

[data-track=backend]  { border-left-color: var(--backend) !important; }
[data-track=frontend] { border-left-color: var(--frontend) !important; }
[data-track=qa]       { border-left-color: var(--qa) !important; }
[data-track=infra]    { border-left-color: var(--infra) !important; }
[data-track=design]   { border-left-color: var(--design) !important; }
.card[data-status=done] { opacity: .45; }
.card[data-status=done] .id { text-decoration: line-through; }
.card[data-status=in_progress] { border-color: var(--wip); }
.card[data-ready=true] .id::before { content: ""; display: inline-block; width: 6px; height: 6px;
  border-radius: 50%; background: var(--ready); margin-right: 6px; vertical-align: 1px; }
.card.hidden { display: none; }
body.focusing .card { opacity: .16; }
body.focusing .card.up, body.focusing .card.down { opacity: 1; }
body.focusing .card.up { border-color: var(--wip); }
body.focusing .card.down { border-color: var(--backend); }
body.focusing .card.sel { opacity: 1; outline: 2px solid var(--ink); outline-offset: 1px; }

.tree-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.tree-head .hint { font-size: 13px; color: var(--mute); }
.tree-head button { border: 1px solid var(--line); background: var(--card); border-radius: 7px;
  padding: 5px 11px; font-size: 12px; cursor: pointer; }
.tree-section { margin-bottom: 26px; }
.tree-section > h3 { font-size: 12px; font-weight: 650; text-transform: uppercase;
  letter-spacing: .07em; color: var(--mute); margin: 0 0 10px; }
.tree ul { list-style: none; margin: 0; padding-left: 26px; position: relative; }
.tree > ul { padding-left: 0; }
.tree ul ul::before { content: ""; position: absolute; left: 10px; top: -4px; bottom: 18px;
  border-left: 1.5px solid var(--line); }
.tree li { position: relative; }
.tree ul ul > li::before { content: ""; position: absolute; left: -16px; top: 18px; width: 17px;
  border-top: 1.5px solid var(--line); }
.node { display: flex; align-items: center; gap: 9px; padding: 7px 10px 7px 4px; margin: 1px 0;
  border-radius: 7px; cursor: pointer; }
.node .kids { font-size: 11px; color: var(--faint); font-variant-numeric: tabular-nums; }
.node:hover { background: var(--card); }
.node.sel { background: var(--card); outline: 1px solid var(--ink); }
.caret { width: 18px; height: 18px; flex: 0 0 18px; border: 0; background: none; cursor: pointer;
  color: var(--faint); font-size: 10px; line-height: 1; padding: 0; }
.caret.leaf { visibility: hidden; }
.node .id { font: 600 12px/1 ui-monospace, Menlo, monospace; white-space: nowrap; }
.node .ttl { font-size: 13px; color: var(--mute); overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
.node .badge { margin-left: auto; display: flex; gap: 6px; align-items: center; flex: 0 0 auto; }
.node[data-status=done] { opacity: .5; }
.node[data-status=done] .id { text-decoration: line-through; }
.node[data-ready=true] .id { color: var(--ready); }
.repeat { font-size: 11px; color: var(--faint); font-style: italic; }

aside { position: sticky; top: 118px; align-self: start; max-height: calc(100vh - 118px);
  overflow: auto; border-left: 1px solid var(--line); padding: 22px 20px 60px; }
aside .placeholder { color: var(--mute); font-size: 13px; line-height: 1.6; }
aside h3 { margin: 0 0 4px; font: 600 13px/1.3 ui-monospace, Menlo, monospace; }
aside .subtitle { margin: 0 0 16px; font-size: 13px; line-height: 1.5; }
aside dl { display: grid; grid-template-columns: auto 1fr; gap: 5px 14px; margin: 0 0 6px;
  font-size: 12.5px; }
aside dt { color: var(--mute); }
aside dd { margin: 0; }
aside h4 { font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: .07em;
  color: var(--mute); margin: 20px 0 6px; }
aside ol { list-style: none; margin: 0; padding: 0; }
aside ol li { padding: 4px 0; font-size: 12.5px; cursor: pointer; display: flex; gap: 8px; }
aside ol li:hover .lid { text-decoration: underline; }
aside .lid { font: 600 12px/1.4 ui-monospace, Menlo, monospace; }
aside .lst { color: var(--faint); font-size: 11px; margin-left: auto; }
aside .none { color: var(--faint); font-size: 12.5px; }

@media (max-width: 980px) {
  main { grid-template-columns: 1fr; }
  aside { position: static; max-height: none; border-left: 0; border-top: 1px solid var(--line); }
}
</style>
</head>
<body>
<header>
  <div class="brand">
    <h1>SalesNova task graph</h1><div id="summary"></div>
    <button id="theme" type="button" title="Switch between light and dark"></button>
  </div>
  <div class="controls">
    <input type="search" id="q" placeholder="Search id, title or domain">
    <select id="gate"><option value="">All gates</option></select>
    <select id="owner"><option value="">Anyone</option><option value="__none">Unclaimed</option></select>
    <label class="toggle"><input type="checkbox" id="readyOnly">Ready now</label>
    <label class="toggle"><input type="checkbox" id="hideDone">Hide done</label>
    <span id="trackChips" style="display:contents"></span>
  </div>
  <div class="tabs" role="tablist">
    <button class="tab" role="tab" data-view="waves" aria-selected="true">Waves</button>
    <button class="tab" role="tab" data-view="tree" aria-selected="false">Tree</button>
  </div>
</header>
<main>
  <div>
    <div class="view" id="waves"></div>
    <div class="view" id="tree" hidden></div>
  </div>
  <aside id="detail"></aside>
</main>
<script>
const DATA = __DATA__;
const byId = new Map(DATA.map(t => [t.id, t]));
const TRACKS = [...new Set(DATA.map(t => t.track))].sort();
const OWNERS = [...new Set(DATA.map(t => t.owner).filter(Boolean))].sort();
const maxLevel = Math.max(...DATA.map(t => t.level));
const openRows = new Set();
const state = { q: '', gate: '', owner: '', readyOnly: false, hideDone: false,
  tracks: new Set(TRACKS), sel: null, view: 'waves' };

const el = (tag, props = {}, kids = []) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k) n.append(k);
  return n;
};
const shortId = id => id.replace('TASK-', '');

function ownerHue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
// Nothing is rendered for an unclaimed task: most of the backlog is unclaimed,
// so a badge saying so on every row is the noise, not the signal.
function ownerBadge(t) {
  if (!t.owner) return null;
  return el('span', { className: 'owner', textContent: '@' + t.owner,
    style: 'background:hsl(' + ownerHue(t.owner) + ' 52% 42%)' });
}

/* ---------- filtering ---------- */

function visible(t) {
  if (!state.tracks.has(t.track)) return false;
  if (state.gate && t.gate !== state.gate) return false;
  if (state.owner === '__none' && t.owner) return false;
  if (state.owner && state.owner !== '__none' && t.owner !== state.owner) return false;
  if (state.readyOnly && !t.ready) return false;
  if (state.hideDone && t.status === 'done') return false;
  if (state.q && !(t.id + ' ' + t.title + ' ' + t.domain).toLowerCase().includes(state.q)) return false;
  return true;
}

function reach(id, key) {
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    for (const next of byId.get(stack.pop())[key]) {
      if (byId.has(next) && !seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return seen;
}

/* ---------- controls ---------- */

function buildControls() {
  const gate = document.getElementById('gate');
  for (const g of [...new Set(DATA.map(t => t.gate))].sort()) {
    gate.append(el('option', { value: g, textContent: g }));
  }
  gate.onchange = () => { state.gate = gate.value; paint(); };

  const owner = document.getElementById('owner');
  for (const o of OWNERS) owner.append(el('option', { value: o, textContent: '@' + o }));
  owner.onchange = () => { state.owner = owner.value; paint(); };

  const chips = document.getElementById('trackChips');
  for (const tr of TRACKS) {
    const box = el('input', { type: 'checkbox', checked: true });
    const chip = el('label', { className: 'toggle' }, [
      box, el('span', { className: 'swatch', style: 'background:var(--' + tr + ')' }),
      document.createTextNode(tr),
    ]);
    box.onchange = () => {
      box.checked ? state.tracks.add(tr) : state.tracks.delete(tr);
      chip.classList.toggle('off', !box.checked);
      paint();
    };
    chips.append(chip);
  }

  const q = document.getElementById('q');
  q.oninput = () => { state.q = q.value.trim().toLowerCase(); paint(); };
  for (const key of ['readyOnly', 'hideDone']) {
    const box = document.getElementById(key);
    box.onchange = () => { state[key] = box.checked; paint(); };
  }

  const theme = document.getElementById('theme');
  const paintTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    theme.textContent = dark ? '\\u2600 Light' : '\\u263e Dark';
  };
  theme.onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('sn-graph-theme', next); } catch (e) {}
    paintTheme();
  };
  paintTheme();

  for (const tab of document.querySelectorAll('.tab')) {
    tab.onclick = () => {
      state.view = tab.dataset.view;
      for (const other of document.querySelectorAll('.tab')) {
        other.setAttribute('aria-selected', String(other === tab));
      }
      document.getElementById('waves').hidden = state.view !== 'waves';
      document.getElementById('tree').hidden = state.view !== 'tree';
      if (state.view === 'tree') drawTree();
    };
  }
}

/* ---------- waves ---------- */

function card(t) {
  const node = el('article', { className: 'card', title: t.title }, [
    el('div', { className: 'top' }, [
      el('span', { className: 'id', textContent: shortId(t.id) }),
      el('span', { className: 'fan', textContent: t.fan ? 'unblocks ' + t.fan : '' }),
    ]),
    el('p', { className: 'title', textContent: t.title }),
    el('div', { className: 'meta' }, [
      el('span', { className: 'tag', textContent: t.gate }),
      el('span', { className: 'tag', textContent: t.size }),
      el('span', { textContent: t.track }),
      ownerBadge(t),
    ]),
  ]);
  Object.assign(node.dataset, { track: t.track, status: t.status, ready: String(t.ready), id: t.id });
  node.onclick = e => { e.stopPropagation(); select(t.id); };
  return node;
}

function buildWaves() {
  const host = document.getElementById('waves');
  const firstOpen = Math.min(...DATA.filter(t => t.status !== 'done').map(t => t.level));
  for (let l = 0; l <= maxLevel; l++) {
    const wave = el('section', { className: 'wave' + (l === firstOpen ? ' current' : '') });
    wave.dataset.level = l;
    wave.append(el('div', { className: 'wave-head' }, [
      el('b', { textContent: 'Wave ' + l }),
      el('span', { className: 'count' }),
    ]));
    const grid = el('div', { className: 'cards' });
    for (const t of DATA.filter(t => t.level === l).sort((a, b) => b.fan - a.fan)) grid.append(card(t));
    wave.append(grid);
    host.append(wave);
  }
  // Clicking empty canvas clears the selection, but the header and the detail
  // panel are controls - a tab switch there must not drop what you were looking at.
  document.body.onclick = e => { if (!e.target.closest('header, aside')) select(null); };
}

/* ---------- tree ---------- */

function treeRow(t, kids, path, dir) {
  const expandable = kids.length > 0;
  const repeated = path.includes(t.id);
  const key = dir + ':' + path.concat(t.id).join('>');
  const open = openRows.has(key);

  const caret = el('button', { className: 'caret' + (expandable && !repeated ? '' : ' leaf'),
    textContent: open ? '\\u25be' : '\\u25b8' });
  const row = el('div', { className: 'node' }, [
    caret,
    el('span', { className: 'swatch', style: 'background:var(--' + t.track + ')' }),
    el('span', { className: 'id', textContent: shortId(t.id) }),
    el('span', { className: 'ttl', textContent: t.title }),
    el('span', { className: 'badge' }, [
      repeated ? el('span', { className: 'repeat', textContent: 'shown above' }) : null,
      expandable && !repeated ? el('span', { className: 'kids', textContent: '+' + kids.length }) : null,
      ownerBadge(t),
    ]),
  ]);
  Object.assign(row.dataset, { track: t.track, status: t.status, ready: String(t.ready), id: t.id });
  if (t.id === state.sel) row.classList.add('sel');

  const li = el('li', {}, [row]);
  if (expandable && !repeated) {
    caret.onclick = e => {
      e.stopPropagation();
      open ? openRows.delete(key) : openRows.add(key);
      drawTree();
    };
    if (open) li.append(subtree(kids, path.concat(t.id), dir));
  }
  row.onclick = e => { e.stopPropagation(); select(t.id); };
  return li;
}

function subtree(ids, path, dir) {
  const ul = el('ul');
  for (const id of ids) {
    const t = byId.get(id);
    if (!t || !visible(t)) continue;
    ul.append(treeRow(t, t[dir].filter(x => byId.has(x)), path, dir));
  }
  return ul;
}

function section(heading, ids, dir) {
  const ul = subtree(ids, [], dir);
  return el('section', { className: 'tree-section' }, [
    el('h3', { textContent: heading }),
    ul.childElementCount ? el('div', { className: 'tree' }, [ul])
      : el('p', { className: 'none', textContent: 'nothing' }),
  ]);
}

function drawTree() {
  const host = document.getElementById('tree');
  host.textContent = '';
  const head = el('div', { className: 'tree-head' });

  if (state.sel) {
    const t = byId.get(state.sel);
    head.append(el('span', { className: 'hint',
      textContent: 'Rooted at ' + shortId(t.id) + ' \\u2014 ' + t.title }));
    head.append(el('button', { textContent: 'Show all roots', onclick: e => {
      e.stopPropagation(); select(null); } }));
    host.append(head);
    host.append(section('Waits on \\u2014 must finish first', t.deps.filter(d => byId.has(d)), 'deps'));
    host.append(section('Unblocks \\u2014 waiting on this', t.unblocks, 'unblocks'));
  } else {
    head.append(el('span', { className: 'hint',
      textContent: 'Tasks with no dependencies. Expand to walk what each one unblocks, or click any task to root the tree there.' }));
    host.append(head);
    host.append(section('Roots', DATA.filter(t => t.deps.length === 0).sort((a, b) => b.fan - a.fan)
      .map(t => t.id), 'unblocks'));
  }
}

/* ---------- paint + detail ---------- */

function paint() {
  let shown = 0;
  for (const node of document.querySelectorAll('.card')) {
    const on = visible(byId.get(node.dataset.id));
    node.classList.toggle('hidden', !on);
    if (on) shown++;
  }
  for (const wave of document.querySelectorAll('.wave')) {
    const live = wave.querySelectorAll('.card:not(.hidden)').length;
    wave.classList.toggle('empty', live === 0);
    wave.querySelector('.count').textContent = live + (live === 1 ? ' task' : ' tasks');
  }
  const done = DATA.filter(t => t.status === 'done').length;
  const ready = DATA.filter(t => t.ready).length;
  const wip = DATA.filter(t => t.status === 'in_progress').length;
  const free = DATA.filter(t => t.ready && !t.owner).length;
  document.getElementById('summary').textContent =
    done + ' of ' + DATA.length + ' done \\u00b7 ' + ready + ' ready (' + free + ' unclaimed) \\u00b7 ' +
    wip + ' in progress \\u00b7 ' + (maxLevel + 1) + ' waves \\u00b7 ' + shown + ' shown';
  if (state.view === 'tree') drawTree();
}

function select(id) {
  state.sel = id;
  document.body.classList.toggle('focusing', Boolean(id));
  for (const node of document.querySelectorAll('.card')) node.classList.remove('up', 'down', 'sel');

  const panel = document.getElementById('detail');
  panel.textContent = '';
  if (!id) {
    panel.append(el('p', { className: 'placeholder', textContent:
      'Pick a task to see what it waits on and what it unblocks. Tasks in one wave have no dependency between them, so they can all be worked at the same time \\u2014 but a later wave is not gated on the whole earlier one, only on its own parents.' }));
    if (state.view === 'tree') drawTree();
    return;
  }

  const t = byId.get(id);
  for (const up of reach(id, 'deps')) mark(up, 'up');
  for (const down of reach(id, 'unblocks')) mark(down, 'down');
  mark(id, 'sel');

  panel.append(el('h3', { textContent: t.id }), el('p', { className: 'subtitle', textContent: t.title }));
  const dl = el('dl');
  const rows = [['owner', t.owner ? '@' + t.owner : 'unclaimed'], ['status', t.status],
    ['startable', t.ready ? 'yes, now' : 'not yet'], ['wave', String(t.level)],
    ['track', t.track], ['domain', t.domain], ['gate', t.gate], ['size', t.size],
    ['unblocks', t.fan + ' downstream']];
  if (t.blocked) rows.push(['blocked', t.blocked]);
  for (const [k, v] of rows) dl.append(el('dt', { textContent: k }), el('dd', { textContent: v }));
  panel.append(dl);

  if (!t.owner) {
    panel.append(el('h4', { textContent: 'to claim it' }),
      el('p', { className: 'none',
        textContent: 'node docs/tasks/cli/tasks.js claim ' + t.id + ' --to <handle>' }));
  }
  list(panel, 'waits on (' + t.deps.length + ')', t.deps);
  list(panel, 'unblocks directly (' + t.unblocks.length + ')', t.unblocks);
  if (state.view === 'tree') drawTree();
}

function mark(id, cls) {
  const node = document.querySelector('.card[data-id="' + id + '"]');
  if (node) node.classList.add(cls);
}

function list(panel, heading, ids) {
  panel.append(el('h4', { textContent: heading }));
  if (!ids.length) { panel.append(el('p', { className: 'none', textContent: 'nothing' })); return; }
  const ol = el('ol');
  for (const id of ids) {
    const dep = byId.get(id);
    if (!dep) continue;
    const li = el('li', {}, [
      el('span', { className: 'lid', textContent: shortId(id) }),
      el('span', { className: 'lst', textContent: dep.ready ? 'ready' : dep.status }),
    ]);
    li.onclick = e => {
      e.stopPropagation();
      select(id);
      document.querySelector('.card[data-id="' + id + '"]')?.scrollIntoView({ block: 'center' });
    };
    ol.append(li);
  }
  panel.append(ol);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') select(null); });
buildControls();
buildWaves();
select(null);
paint();
</script>
</body>
</html>
`;

function main() {
  const argv = process.argv.slice(2);
  const flag = argv.indexOf('--out');
  const out = flag === -1 ? DEFAULT_OUT : path.resolve(argv[flag + 1]);
  const nodes = build();
  fs.writeFileSync(out, render(nodes));
  const ready = nodes.filter((n) => n.ready).length;
  const unclaimed = nodes.filter((n) => n.ready && !n.owner).length;
  const deepest = Math.max(...nodes.map((n) => n.level));
  process.stdout.write(
    `Wrote ${path.relative(process.cwd(), out)} - ${nodes.length} tasks, ` +
      `${deepest + 1} waves, ${ready} ready (${unclaimed} unclaimed).\n`
  );
}

main();
