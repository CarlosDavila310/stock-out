// PROTOTYPE - NOT FOR PRODUCTION
// Online play for up to four players, browser to browser (WebRTC, through PeerJS).
//
// One browser hosts: it runs the whole shop (customers, director, the bot) and sends everyone a
// snapshot of it 20 times a second. The others walk their own figure at once, report where it
// stands and what they press, and show what the host sends. A slip or a bump is the host's call:
// while a figure is down or stunned it follows the host. Every number is in config.js (net_*).
//
// This file only defines things; index.html calls netInit() once it is ready. It reads index.html's
// globals (state, scene, workers, the fixtures) when it runs, never when it loads.
'use strict';

const NET_MAX = 4;                          // people in a room
const ROOM_PREFIX = 'stockout-';            // the room's address on the public PeerJS broker
const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: they read as 1 and 0
const STAT_KEYS = ['ventas', 'pedidos', 'repos', 'limpiezas', 'bolsas', 'ayudas', 'resbalones', 'choques', 'soles'];
const NET_MOVING = [[0, 0]];                // a customer a client draws as walking: only the length of its path is read

const net = {
  role: null,        // null offline · 'host' · 'client'
  phase: 'off',      // off · connecting · lobby · playing
  code: '', error: '', typed: '',
  myId: 'p1', slot: 1,
  bot: false, diff: 'intermedio',
  roster: [],        // the slots taken, in order: [1, 3]
  link: null,        // the transport's handle
  hostConn: null,    // client: the connection to the host
  conns: new Map(),  // host: slot -> { conn, slot, seen }
  inputs: {},        // host: id -> the last report from that browser
  fx: [],            // host: sounds and floating words since the last snapshot
  k: 0, lastScene: null, lastRecv: 0, sendT: 0, g: 0, s: 0, joinAt: 0, sfxRaw: null, copied: 0,
};
const online = () => net.role !== null;
const netR2 = v => Math.round(v * 100) / 100;
const netRoster = () => net.roster.map(s => 'p' + s).concat(net.bot ? ['bot'] : []);

// ---- Transports: the one the players use (PeerJS) and one for tests (?net=local, same browser) ----
function netWrapPeerConn(dc) {
  const c = { onmessage: null, onclose: null, send(m) { try { dc.send(m); } catch (e) { /* closed */ } }, close() { try { dc.close(); } catch (e) { /* closed */ } } };
  dc.on('data', d => { if (c.onmessage) c.onmessage(d); });
  dc.on('close', () => { if (c.onclose) c.onclose(); });
  dc.on('error', () => { if (c.onclose) c.onclose(); });
  return c;
}
const NET_PEER = {
  host(code, h) { // h: onReady, onConn(conn), onError(why)
    const p = new Peer(ROOM_PREFIX + code, { debug: 0 });
    let ready = false; // once the room is open, a broker hiccup must not end a game already in play
    p.on('open', () => { ready = true; h.onReady(); });
    p.on('connection', dc => { const conn = netWrapPeerConn(dc); dc.on('open', () => h.onConn(conn)); });
    p.on('error', e => { if (!ready) h.onError(e && e.type ? e.type : 'error'); });
    return { close() { try { p.destroy(); } catch (e) { /* gone */ } } };
  },
  join(code, h) { // h: onOpen(conn), onError(why)
    const p = new Peer({ debug: 0 });
    let opened = false; // after that, the data connection's own close tells us
    p.on('open', () => {
      const dc = p.connect(ROOM_PREFIX + code, { reliable: true, serialization: 'json' });
      const conn = netWrapPeerConn(dc);
      dc.on('open', () => { opened = true; h.onOpen(conn); });
    });
    p.on('error', e => { if (!opened) h.onError(e && e.type ? e.type : 'error'); });
    return { close() { try { p.destroy(); } catch (e) { /* gone */ } } };
  },
};
const NET_LOCAL = { // BroadcastChannel between tabs of one browser: for tests, never offered to players
  host(code, h) {
    const bc = new BroadcastChannel(ROOM_PREFIX + code), peers = new Map();
    bc.onmessage = e => {
      const m = e.data; if (m.to !== 'host') return;
      if (m.kind === 'hello') {
        const conn = { onmessage: null, onclose: null, send(d) { bc.postMessage({ to: m.from, kind: 'data', d }); }, close() { bc.postMessage({ to: m.from, kind: 'bye' }); peers.delete(m.from); } };
        peers.set(m.from, conn); bc.postMessage({ to: m.from, kind: 'welcome' }); h.onConn(conn);
      } else if (m.kind === 'data') { const c = peers.get(m.from); if (c && c.onmessage) c.onmessage(m.d); }
      else if (m.kind === 'bye') { const c = peers.get(m.from); if (c && c.onclose) c.onclose(); peers.delete(m.from); }
    };
    setTimeout(() => h.onReady(), 0);
    return { close() { for (const [id] of peers) bc.postMessage({ to: id, kind: 'bye' }); bc.close(); } };
  },
  join(code, h) {
    const id = Math.random().toString(36).slice(2), bc = new BroadcastChannel(ROOM_PREFIX + code);
    let opened = false;
    const conn = { onmessage: null, onclose: null, send(d) { bc.postMessage({ to: 'host', kind: 'data', from: id, d }); }, close() { bc.postMessage({ to: 'host', kind: 'bye', from: id }); } };
    bc.onmessage = e => {
      const m = e.data; if (m.to !== id) return;
      if (m.kind === 'welcome') { opened = true; h.onOpen(conn); }
      else if (m.kind === 'data' && conn.onmessage) conn.onmessage(m.d);
      else if (m.kind === 'bye' && conn.onclose) conn.onclose();
    };
    bc.postMessage({ to: 'host', kind: 'hello', from: id });
    setTimeout(() => { if (!opened) h.onError('peer-unavailable'); }, 1500);
    return { close() { bc.close(); } };
  },
};
const netTransport = () => params.get('net') === 'local' ? NET_LOCAL : NET_PEER;

// ---- Setup ------------------------------------------------------------------------------------
function netInit() {
  // The host records every sound and floating word as it happens, so a client can play them too.
  net.sfxRaw = {};
  for (const k of Object.keys(sfx)) {
    const f = net.sfxRaw[k] = sfx[k];
    sfx[k] = (...a) => { f(...a); if (net.role === 'host' && net.phase === 'playing') netFx(['s', k, ...a]); };
  }
  for (const name of ['floater', 'puff', 'paperFly']) {
    const f = window[name];
    window[name] = (...a) => { f(...a); if (net.role === 'host' && net.phase === 'playing') netFx([name, ...a]); };
  }
  scenes.netmenu = { update: netMenuUpdate, draw() { render3D(); drawNetMenu(); } };
  scenes.lobby = { update: netLobbyUpdate, draw() { render3D(); drawLobby(); } };
  addEventListener('beforeunload', () => netLeave(true));
  if (window.game) { window.game.net = net; window.game.pack = packState; }
  const room = (params.get('sala') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (room.length === 4 && !params.get('scene')) { net.typed = room; netJoinRoom(room); }
}
function netFx(e) { if (net.fx.length < 200) net.fx.push(e); }
function netSend(conn, m) { if (conn) conn.send(m); }
function netBroadcast(m) { for (const rec of net.conns.values()) rec.conn.send(m); }
function netCode() { let s = ''; for (let i = 0; i < 4; i++) s += ROOM_LETTERS[Math.floor(Math.random() * ROOM_LETTERS.length)]; return s; }

function netOpenMenu() { net.typed = ''; net.error = ''; scene = 'netmenu'; sfx.signal(); }
function netFail(msg) { // back to the room menu with a reason
  netLeave(true); net.error = msg; scene = 'netmenu';
}
function netLeave(silent) {
  if (net.hostConn) { net.hostConn.onclose = null; net.hostConn.send({ t: 'bye' }); net.hostConn.close(); }
  for (const rec of net.conns.values()) { rec.conn.onclose = null; rec.conn.close(); }
  if (net.link) net.link.close();
  const was = net.role;
  Object.assign(net, { role: null, phase: 'off', code: '', link: null, hostConn: null, roster: [], bot: false, myId: 'p1', slot: 1, g: 0, s: 0, lastScene: null });
  net.conns = new Map(); net.inputs = {}; net.fx = [];
  if (was && state) { reset(); if (!silent) scene = 'title'; }
}

// ---- Creating and joining a room ---------------------------------------------------------------
function netHostRoom() {
  netLeave(true);
  net.role = 'host'; net.phase = 'connecting'; net.myId = 'p1'; net.slot = 1; net.roster = [1]; net.error = '';
  net.diff = diff === 'tutorial' ? 'intermedio' : diff;
  const open = tries => {
    net.code = netCode();
    net.link = netTransport().host(net.code, {
      onReady() { net.phase = 'lobby'; scene = 'lobby'; },
      onConn: netHostConn,
      onError(why) {
        if (why === 'unavailable-id' && tries < 6) { net.link.close(); open(tries + 1); } // the code was taken: draw another
        else netFail('No se pudo crear la sala: no hay conexión con el servidor de salas.');
      },
    });
  };
  open(0);
}
function netJoinRoom(code) {
  netLeave(true);
  net.role = 'client'; net.phase = 'connecting'; net.code = code; net.error = ''; net.joinAt = clock.now();
  scene = 'netmenu';
  net.link = netTransport().join(code, {
    onOpen(conn) { net.hostConn = conn; netClientConn(conn); conn.send({ t: 'hello' }); },
    onError(why) {
      netFail(why === 'peer-unavailable' ? 'No existe esa sala. Revisa el código.' : 'No se pudo contactar el servidor de salas.');
    },
  });
}

// ---- The host: a room of up to four ------------------------------------------------------------
function netHostConn(conn) {
  const rec = { conn, slot: 0, seen: clock.now() };
  conn.onmessage = m => {
    rec.seen = clock.now();
    if (m.t === 'hello' && !rec.slot) {
      if (net.phase !== 'lobby') { conn.send({ t: 'refuse', why: 'busy' }); conn.close(); return; }
      const free = [1, 2, 3, 4].find(s => !net.roster.includes(s));
      if (!free) { conn.send({ t: 'refuse', why: 'full' }); conn.close(); return; }
      rec.slot = free; net.roster.push(free); net.roster.sort();
      if (net.roster.length >= NET_MAX) net.bot = false; // four people and a bot would make five
      net.conns.set(free, rec);
      conn.send({ t: 'welcome', slot: free });
      netBroadcastLobby();
    } else if (m.t === 'in' && rec.slot) net.inputs['p' + rec.slot] = m;
    else if (m.t === 'bye') netDrop(rec.slot);
  };
  conn.onclose = () => netDrop(rec.slot);
}
function netBroadcastLobby(back) { netBroadcast({ t: 'lobby', roster: net.roster, diff: net.diff, bot: net.bot, back: back ? 1 : 0 }); }
function netDrop(slot) {
  if (!slot || !net.conns.has(slot)) return;
  net.conns.delete(slot); net.roster = net.roster.filter(s => s !== slot); delete net.inputs['p' + slot];
  if (net.phase === 'lobby') { netBroadcastLobby(); return; }
  const w = state.workers.find(o => o.id === 'p' + slot);
  if (!w) return;
  if (w.held) dropOnFloor(w.held, w.x, w.z, w);
  if (w.view) w.view.g.visible = false;
  state.workers.splice(state.workers.indexOf(w), 1);
  banner(`${w.name} salió`);
}
function netStartRound() { // host: a new turn for everyone in the room
  net.phase = 'playing'; diff = net.diff; net.inputs = {}; net.fx = []; net.lastScene = null;
  reset(); scene = 'play'; sfx.banner();
  netBroadcast({ t: 'start', roster: net.roster, bot: net.bot, diff: net.diff });
}
function netBackToLobby() { // host: back to the room, same people
  net.phase = 'lobby'; scene = 'lobby'; reset();
  netBroadcastLobby(true);
}
function netEndScreenKeys() { // over and results, online
  if (net.role === 'host') {
    if (pressed('Enter') || pressed('KeyR')) netStartRound();
    else if (pressed('Escape') || pressed('KeyT')) netBackToLobby();
  } else if (pressed('Escape')) netLeave(false);
}

// ---- The host's clock: snapshots out, silent clients dropped ------------------------------------
function netTick() {
  if (net.role !== 'host' || net.phase !== 'playing') return;
  net.k++;
  const every = Math.max(1, Math.round(60 / tune.net_snapshot_hz));
  if (scene !== net.lastScene || net.k % (scene === 'play' ? every : 30) === 0) netSendSnapshot();
  net.lastScene = scene;
  const now = clock.now();
  for (const [slot, rec] of [...net.conns]) if (now - rec.seen > tune.net_timeout) { rec.conn.close(); netDrop(slot); }
}
function packState() {
  const s = state, r = netR2, fixId = f => !f ? -1 : f.type === 'counter' ? counters.indexOf(f) : f.type === 'oven' ? 100 + ovens.indexOf(f) : -1;
  return {
    t: 'snap', st: r(s.t), sc: scene, ph: s.phase, m: r(s.money), sat: r(s.sat), sv: s.served, an: s.angry, sp: s.spawned, sr: s.stars, lc: s.lastCall ? 1 : 0, gn: s.gained,
    bn: s.banner ? [s.banner.text, r(s.banner.t)] : null,
    sg: s.signal ? [r(s.signal.x), r(s.signal.z), r(s.signal.t)] : null,
    w: s.workers.map(w => [w.id, r(w.x), r(w.z), r(w.vx), r(w.vz), r(w.fx), r(w.fz), w.held ? w.held.id : 0, r(w.down), r(w.stun), r(w.spin), w.workKind || 0, r(w.workP), STAT_KEYS.map(k => r(w.stats[k]))]),
    c: s.customers.map(c => [c.id, c.kind, r(c.x), r(c.z), r(c.face[0]), r(c.face[1]), c.path.length ? 1 : 0, c.st, c.want || 0, r(c.patience), r(c.pmax), c.arrivedOnce ? 1 : 0, c.served ? 1 : 0, c.happy ? 1 : 0, c.mood, r(c.leaveT), r(c.slipT), c.atSlot ? 1 : 0, c.order || 0, c.gone ? 1 : 0, c.skin || 0]),
    i: s.items.map(it => [it.id, it.kind, it.prod || 0, it.food || 0, r(it.cook), it.place, r(it.x), r(it.z), r(it.rot), it.holder ? it.holder.id : 0, fixId(it.fix), it.lastBy || 0,
      it.fly ? [r(it.fly.sx), r(it.fly.sz), r(it.fly.sy), r(it.fly.ex), r(it.fly.ez), r(it.fly.ey), r(it.fly.t), it.fly.dur, fixId(it.fly.land)] : 0]),
    sl: s.spills.map(p => [p.id, p.type, r(p.x), r(p.z), r(p.age)]),
    sh: PRODS.map(p => shelves[p].stock), ds: FOODS.map(k => display.stock[k] || 0), bf: r(bin.fill),
    fx: net.fx.splice(0),
  };
}
function netSendSnapshot() { const m = packState(); for (const rec of net.conns.values()) rec.conn.send(m); }

// What the host does with a client's report: its key presses, and where its figure stands.
function netRemoteInput(w) {
  const R = net.inputs[w.id], inp = { mx: 0, mz: 0, grab: false, work: false, signal: false, face: null };
  if (!R) return inp;
  inp.work = !!R.work;
  if (w.lastG < 0) { w.lastG = R.g; w.lastS = R.s; }
  if (R.g !== w.lastG) { inp.grab = true; w.lastG = R.g; }
  if (R.s !== w.lastS) { inp.signal = true; w.lastS = R.s; }
  return inp;
}
function netAdoptReport(w) {
  const R = net.inputs[w.id]; if (!R) return;
  w.x = R.x; w.z = R.z; w.vx = R.vx; w.vz = R.vz;
  if (R.fx || R.fz) { w.fx = R.fx; w.fz = R.fz; }
  collide(w);
}

// ---- A client: send what is pressed, show what the host sends -----------------------------------
function netClientConn(conn) {
  conn.onmessage = m => {
    net.lastRecv = clock.now();
    switch (m.t) {
      case 'welcome': net.slot = m.slot; net.myId = 'p' + m.slot; net.phase = 'lobby'; scene = 'lobby'; break;
      case 'refuse': netFail(m.why === 'full' ? 'La sala está llena (máximo 4).' : 'Esa partida ya empezó. Espera al próximo turno.'); break;
      case 'lobby':
        net.roster = m.roster; net.diff = m.diff; net.bot = !!m.bot;
        if (m.back && net.phase === 'playing') { net.phase = 'lobby'; scene = 'lobby'; reset(); }
        break;
      case 'start':
        net.roster = m.roster; net.bot = !!m.bot; net.diff = diff = m.diff; net.phase = 'playing'; net.g = net.s = 0;
        reset(); scene = 'play'; net.lastRecv = clock.now(); sfx.banner();
        break;
      case 'snap': if (net.phase === 'playing') netApply(m); break;
    }
  };
  conn.onclose = () => netFail('Se cerró la conexión con el anfitrión.');
}
function netClientUpdate(dt) {
  animT += dt; state.t += dt;
  const me = state.workers.find(w => w.local), k = Math.min(1, tune.net_smooth * dt);
  let edge = false;
  for (const w of state.workers) {
    if (w.down > 0) { w.down = Math.max(0, w.down - dt); w.spin += dt * 14 * Math.max(0, w.down / tune.slip_time); }
    if (w.stun > 0) w.stun = Math.max(0, w.stun - dt);
    if (w === me && !w.hostCtl) {
      walk(w, keyInput(w), dt); // your own figure walks at once; the host only takes over for a slip or a bump
      w.target = findTarget(w);
    } else netGlide(w, k);
  }
  for (const c of state.customers) netGlide(c, k);
  for (const it of state.items) if (it.place === 'fly' && it.fly) it.fly.t = Math.min(it.fly.dur, it.fly.t + dt);
  if (me && scene === 'play') {
    const kk = KEYS.p1;
    if (pressed(kk.grab)) { net.g++; edge = true; }
    if (pressed(kk.signal)) { net.s++; edge = true; }
    net.sendT -= dt;
    if (edge || net.sendT <= 0) {
      net.sendT = 1 / tune.net_input_hz;
      netSend(net.hostConn, { t: 'in', x: netR2(me.x), z: netR2(me.z), vx: netR2(me.vx), vz: netR2(me.vz), fx: netR2(me.fx), fz: netR2(me.fz), work: down.has(kk.work) ? 1 : 0, g: net.g, s: net.s });
    }
  }
  updateFX(dt);
  if (clock.now() - net.lastRecv > tune.net_timeout) netFail('Se perdió la conexión con el anfitrión.');
}
function netGlide(e, k) { // ease a figure toward the spot the host last gave it, or jump if it is far
  const dx = e.nx - e.x, dz = e.nz - e.z;
  if (Math.hypot(dx, dz) > tune.net_snap_dist) { e.x = e.nx; e.z = e.nz; } else { e.x += dx * k; e.z += dz * k; }
}
function netNewCustomer(id, kind, x, z, skin) {
  const c = {
    id, kind, x, z, nx: x, nz: z, face: [0, -1], path: [], st: 'shop', list: [], got: [], order: null, pmax: 1, patience: 1, arrivedOnce: false, atSlot: false,
    slot: null, checkoutP: 0, waitT: 0, slipT: 0, slipped: new Set(), spillAt: -1, forceSpill: false, want: null, served: false, happy: true, mood: '', leaveT: 0,
    gone: false, view: null, h: KIND[kind].h, shelf: null, skin,
  };
  if (world3) { c.view = makeCustomer(kind, skin); c.view.g.position.set(x, 0, z); c.view.g.scale.setScalar(tune.figure_scale); c.view.ang = Math.PI; world3.add(c.view.g); }
  return c;
}
function netApply(m) {
  const s = state, fixOf = id => id < 0 ? null : id < 100 ? counters[id] : ovens[id - 100];
  if (m.sc !== scene) { scene = m.sc; if (scene === 'results') s.resT = 0; }
  s.t = m.st; s.phase = m.ph; s.money = m.m; s.score = Math.round(m.m); s.sat = m.sat; s.served = m.sv; s.angry = m.an; s.spawned = m.sp; s.stars = m.sr; s.lastCall = !!m.lc; s.gained = m.gn;
  if (m.bn && (!s.banner || s.banner.text !== m.bn[0])) s.banner = { text: m.bn[0], t: m.bn[1] };
  s.signal = m.sg ? { x: m.sg[0], z: m.sg[1], t: m.sg[2], forBot: false } : null;
  for (const r of m.w) {
    const w = s.workers.find(o => o.id === r[0]); if (!w) continue;
    const hostDrives = r[8] > 0 || r[9] > 0;
    w.nx = r[1]; w.nz = r[2]; w.vx = r[3]; w.vz = r[4];
    if (!w.local || hostDrives) { w.fx = r[5]; w.fz = r[6]; }
    if (w.local && hostDrives && !w.hostCtl) { w.x = r[1]; w.z = r[2]; } // a slip or a bump: the host's spot, at once
    w.hostCtl = w.local && hostDrives;
    if (!w.local) { w.workKind = r[11] || null; w.workP = r[12]; }
    else if (hostDrives) { w.workKind = null; }
    else { w.workKind = r[11] || null; w.workP = r[12]; }
    w.down = r[8]; w.stun = r[9]; w.spin = r[10];
    STAT_KEYS.forEach((k, i) => { w.stats[k] = r[13][i]; });
    w.heldId = r[7];
  }
  const onHost = new Set(m.w.map(r => r[0])); // someone left: the host no longer lists their figure
  for (const w of [...s.workers]) if (!onHost.has(w.id)) { if (w.view) w.view.g.visible = false; s.workers.splice(s.workers.indexOf(w), 1); }
  // customers
  const haveC = new Map(s.customers.map(c => [c.id, c])), seenC = new Set();
  for (const r of m.c) {
    let c = haveC.get(r[0]);
    if (!c) { c = netNewCustomer(r[0], r[1], r[2], r[3], r[20]); s.customers.push(c); }
    seenC.add(c.id);
    c.nx = r[2]; c.nz = r[3]; c.face = [r[4], r[5]]; c.path = r[6] ? NET_MOVING : []; c.st = r[7]; c.want = r[8] || null; c.patience = r[9]; c.pmax = r[10];
    c.arrivedOnce = !!r[11]; c.served = !!r[12]; c.happy = !!r[13]; c.mood = r[14]; c.leaveT = r[15]; c.slipT = r[16]; c.atSlot = !!r[17]; c.order = r[18] || null; c.gone = !!r[19];
  }
  s.customers = s.customers.filter(c => { if (seenC.has(c.id)) return true; if (c.view && world3) world3.remove(c.view.g); c.view = null; return false; });
  // things to carry
  const haveI = new Map(s.items.map(i => [i.id, i])), seenI = new Set();
  for (const r of m.i) {
    let it = haveI.get(r[0]);
    if (!it) { it = newItem(r[1], { prod: r[2] || null, food: r[3] || null }); it.id = r[0]; }
    seenI.add(it.id);
    it.cook = r[4]; it.place = r[5]; it.x = r[6]; it.z = r[7]; it.rot = r[8]; it.holderId = r[9]; it.fixId = r[10]; it.lastBy = r[11] || null;
    const f = r[12];
    it.fly = f ? { sx: f[0], sz: f[1], sy: f[2], ex: f[3], ez: f[4], ey: f[5], t: it.fly ? it.fly.t : f[6], dur: f[7], land: null } : null;
  }
  s.items = s.items.filter(it => { if (seenI.has(it.id)) return true; if (it.mesh && world3) world3.remove(it.mesh); return false; });
  for (const w of s.workers) w.held = null;
  for (const f of counters) f.item = null;
  for (const o of ovens) o.item = null;
  for (const it of s.items) {
    it.holder = it.holderId ? s.workers.find(w => w.id === it.holderId) || null : null;
    if (it.holder) it.holder.held = it;
    it.fix = fixOf(it.fixId);
    if (it.fix && (it.place === 'counter' || it.place === 'oven')) it.fix.item = it;
    if (it.place === 'held' && !it.holder) it.place = 'floor';
    if ((it.place === 'counter' || it.place === 'oven') && !it.fix) it.place = 'floor';
    if (it.kind === 'mop') s.mop = it;
  }
  // spills, shelves, the case, the bin
  const haveS = new Map(s.spills.map(p => [p.id, p])), next = [];
  for (const r of m.sl) {
    let p = haveS.get(r[0]);
    if (!p) {
      p = { id: r[0], type: r[1], x: r[2], z: r[3], age: r[4], clean: 0, mesh: null, ring: null };
      if (world3) { p.mesh = spillMesh(p.type); p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = (p.id * 2.3) % 6.28; p.ring = p.mesh.userData.ring; world3.add(p.mesh); }
    }
    p.age = r[4]; next.push(p);
  }
  for (const p of s.spills) if (!next.includes(p) && p.mesh && world3) world3.remove(p.mesh);
  s.spills = next;
  PRODS.forEach((p, i) => { shelves[p].stock = m.sh[i]; });
  FOODS.forEach((k, i) => { display.stock[k] = m.ds[i]; });
  bin.fill = m.bf;
  for (const e of m.fx) netPlayFx(e);
  net.lastRecv = clock.now();
}
function netPlayFx(e) {
  switch (e[0]) {
    case 's': if (net.sfxRaw[e[1]]) net.sfxRaw[e[1]](...e.slice(2)); break;
    case 'floater': floater(...e.slice(1)); break;
    case 'puff': puff(...e.slice(1)); break;
    case 'paperFly': paperFly(...e.slice(1)); break;
  }
}

// ---- The room menu and the lobby -----------------------------------------------------------------
function netMenuUpdate(dt) {
  animT += dt;
  if (net.role === 'client' && net.phase === 'connecting') { // waiting for a room: give up after a while
    if (clock.now() - net.joinAt > tune.net_join_timeout) netFail('No se pudo conectar. Algunas redes bloquean la conexión directa.');
    if (pressed('Escape')) netLeave(false);
    return;
  }
  if (net.role === 'host' && net.phase === 'connecting') { if (pressed('Escape')) netLeave(false); return; }
  if (pressed('Escape')) { net.error = ''; scene = 'title'; return; }
  if (pressed('Digit1') || pressed('Numpad1')) { netHostRoom(); return; }
  if (pressed('Backspace')) net.typed = net.typed.slice(0, -1);
  for (let c = 65; c <= 90; c++) if (pressed('Key' + String.fromCharCode(c)) && net.typed.length < 4) net.typed += String.fromCharCode(c);
  if (pressed('Enter') && net.typed.length === 4) netJoinRoom(net.typed);
}
function netLobbyUpdate(dt) {
  animT += dt;
  if (pressed('Escape')) { netLeave(false); return; }
  if (pressed('KeyL')) { // copy the invitation link
    const link = netLink();
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => { net.copied = clock.now(); }, () => {});
  }
  if (net.role !== 'host') return;
  const pickDiff = d => { net.diff = d; netBroadcastLobby(); sfx.grab(); };
  if (pressed('Digit2') || pressed('Numpad2')) pickDiff('facil');
  if (pressed('Digit3') || pressed('Numpad3')) pickDiff('intermedio');
  if (pressed('Digit4') || pressed('Numpad4')) pickDiff('dificil');
  if (pressed('KeyB') && net.roster.length < NET_MAX) { net.bot = !net.bot; netBroadcastLobby(); sfx.signal(); }
  if (pressed('Enter')) netStartRound();
}
const netLink = () => location.origin !== 'null' ? `${location.origin}${location.pathname}?sala=${net.code}` : `?sala=${net.code}`;
function drawNetMenu() {
  ctx.clearRect(0, 0, W, H);
  wash('rgba(29, 10, 24, 0.7)');
  panel(W / 2 - 360, 70, 720, 110, COL.mag, COL.ink, 5, 18);
  text('JUGAR ONLINE', W / 2, 112, 48, '#FFFFFF');
  text('Hasta 4 jugadores, cada uno en su navegador', W / 2, 154, 20, '#FFFFFF');
  if (net.phase === 'connecting') {
    panel(W / 2 - 360, 220, 720, 200, '#FFFFFF', COL.ink, 4, 16);
    text(net.role === 'host' ? 'Creando la sala…' : `Conectando a la sala ${net.code}…`, W / 2, 300, 30, COL.ink);
    text('Esc: cancelar', W / 2, 360, 18, COL.ink, 'center', 'normal');
    return;
  }
  panel(W / 2 - 360, 220, 720, 240, '#FFFFFF', COL.ink, 4, 16);
  pill('1: crear una sala', W / 2, 270, 28, COL.yel, COL.ink);
  text('o escribe el código de una sala', W / 2, 330, 20, COL.ink, 'center', 'normal');
  for (let i = 0; i < 4; i++) {
    const x = W / 2 + (i - 1.5) * 78;
    panel(x - 31, 352, 62, 70, i === net.typed.length ? COL.yel : '#F4EEF3', COL.ink, 3, 10);
    text(net.typed[i] || '', x, 389, 40, COL.ink);
  }
  text(net.typed.length === 4 ? 'Enter: unirse' : 'Escribe 4 letras · Borrar: corregir', W / 2, 446, 16, COL.ink, 'center', 'normal');
  if (net.error) { panel(W / 2 - 360, 484, 720, 56, COL.red, COL.ink, 3, 12); text(net.error, W / 2, 513, 18, '#FFFFFF'); }
  text('Esc: volver al inicio', W / 2, 580, 18, '#FFFFFF', 'center', 'normal');
}
function drawLobby() {
  ctx.clearRect(0, 0, W, H);
  wash('rgba(29, 10, 24, 0.7)');
  const host = net.role === 'host';
  panel(W / 2 - 400, 40, 800, 100, COL.mag, COL.ink, 5, 18);
  text('SALA', W / 2 - 250, 90, 30, '#FFFFFF');
  net.code.split('').forEach((ch, i) => { const x = W / 2 - 110 + i * 70; panel(x - 30, 62, 60, 56, COL.yel, COL.ink, 3, 10); text(ch, x, 92, 38, COL.ink); });
  text(netLink(), W / 2, 164, 16, '#FFFFFF', 'center', 'normal');
  text(clock.now() - net.copied < 2 ? 'Enlace copiado' : 'L: copiar el enlace para invitar', W / 2, 188, 16, COL.yel);
  panel(W / 2 - 400, 212, 800, 270, '#FFFFFF', COL.ink, 4, 16);
  for (let s = 1; s <= NET_MAX; s++) {
    const y = 250 + (s - 1) * 56, taken = net.roster.includes(s), P = PLAYERS['p' + s];
    pill(P.name, W / 2 - 300, y, 22, taken ? P.pill[0] : '#E9E4EE', taken ? P.pill[1] : '#8A8492');
    text(taken ? (s === net.slot ? 'Tú' : s === 1 ? 'Anfitrión' : 'Conectado') : 'Libre: esperando…', W / 2 - 220, y, 22, taken ? COL.ink : '#8A8492', 'left', taken ? 'bold' : 'normal');
  }
  if (net.bot) { pill('BOT', W / 2 - 300, 250 + NET_MAX * 56 - 12, 20, PLAYERS.bot.pill[0], PLAYERS.bot.pill[1]); text('Ayuda con lo que falte', W / 2 - 220, 250 + NET_MAX * 56 - 12, 18, COL.ink, 'left', 'normal'); }
  text('Dificultad', W / 2 + 190, 246, 16, COL.ink);
  [['facil', 2], ['intermedio', 3], ['dificil', 4]].forEach(([d, n], i) => pill(`${n} ${DIFF_NAME[d]}`, W / 2 + 190, 286 + i * 44, 18, d === net.diff ? COL.yel : '#F4EEF3', COL.ink));
  if (host) {
    pill('Enter: empezar el turno', W / 2, 530, 26, COL.yel, COL.ink);
    text(net.roster.length < NET_MAX ? `B: ${net.bot ? 'quitar' : 'poner'} el bot · 2 a 4: dificultad · Esc: cerrar la sala` : '2 a 4: dificultad · Esc: cerrar la sala', W / 2, 576, 16, '#FFFFFF', 'center', 'normal');
    text('Mantén esta pestaña abierta y a la vista: el turno corre aquí.', W / 2, 604, 16, '#FFFFFF', 'center', 'normal');
  } else {
    pill('Esperando que el anfitrión empiece…', W / 2, 530, 24, '#FFFFFF', COL.ink);
    text('Esc: salir de la sala', W / 2, 576, 16, '#FFFFFF', 'center', 'normal');
  }
}
