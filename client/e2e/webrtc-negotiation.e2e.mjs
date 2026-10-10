// WebRTC negotiation e2e: two peers in separate browser processes join a voice
// channel; for each scenario assert that ICE reaches connected on BOTH sides,
// audio actually flows (inbound bytes > 0), and the pair negotiated exactly
// ONCE (one offer + one answer, a single RTCPeerConnection per side — no pc
// is ever recreated).
//
// Scenarios include the failure modes behind "signalling stable, ICE stuck at
// new": a duplicate/late offer, a mic blocked then retried (which used to
// rebuild the mesh with a second offer), and candidates arriving before the
// peer connection exists.
//
// Needs the app running (dev: `make dev` in server/ + `yarn dev` here; or a
// prod build on one origin). Then:
//   yarn e2e:webrtc
// Env: DOGSPEAK_URL (default http://localhost:5173), DOGSPEAK_PASSWORD
// (default "woof"), CHROMIUM_PATH (optional executable), SCENARIOS
// (comma list; default all).
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.DOGSPEAK_URL ?? "http://localhost:5173";
const PASSWORD = process.env.DOGSPEAK_PASSWORD ?? "woof";
const ALL = ["normal", "slowmic", "simul", "dupoffer", "retry", "retry-both", "early"];
const SCENARIOS = (process.env.SCENARIOS ?? ALL.join(",")).split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A 3s 440Hz tone at -10dBFS as the fake mic (loops): clearly above the
// voice-activation gate, so audio must flow whenever ICE is up.
function toneWav() {
  const rate = 48000, secs = 3, n = rate * secs, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 0.3 * 32767), 44 + i * 2);
  const p = join(mkdtempSync(join(tmpdir(), "dogspeak-e2e-")), "tone.wav");
  writeFileSync(p, buf);
  return p;
}
const WAV = toneWav();

const launch = () =>
  chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${WAV}`, "--autoplay-policy=no-user-gesture-required"],
  });

// In-page: log every pc and its SDP steps; optionally delay getUserMedia (a
// slow permission prompt) or reject its first call (a dismissed prompt).
const instrument = ([gumDelay, failFirst]) => {
  window.__ev = [];
  window.__pcs = [];
  const P = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...a) {
    const pc = new P(...a);
    window.__pcs.push(pc);
    for (const k of ["setLocalDescription", "setRemoteDescription"]) {
      const o = pc[k].bind(pc);
      pc[k] = async (...x) => { const r = await o(...x); window.__ev.push(`${k}:${x[0]?.type ?? "implicit"}`); return r; };
    }
    return pc;
  };
  window.RTCPeerConnection.prototype = P.prototype;
  const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  let calls = 0;
  navigator.mediaDevices.getUserMedia = (c) => {
    calls += 1;
    if (failFirst && calls === 1) return Promise.reject(new DOMException("Permission dismissed", "NotAllowedError"));
    return new Promise((r) => setTimeout(r, gumDelay)).then(() => g(c));
  };
};

// Re-route the page's socket to inject the scenario's signalling oddity.
async function routeSocket(page, scenario) {
  if (scenario !== "dupoffer" && scenario !== "early") return;
  await page.routeWebSocket(/\/ws/, (ws) => {
    const srv = ws.connectToServer();
    ws.onMessage((m) => srv.send(m));
    srv.onMessage((m) => {
      let type = "";
      try { type = JSON.parse(m).type; } catch { /* not JSON */ }
      const later = (ms) => setTimeout(() => { try { ws.send(m); } catch { /* closed */ } }, ms);
      if (scenario === "dupoffer") {
        ws.send(m);
        if (type === "peer:offer") later(4000); // the same offer again, 4s later
      } else if (type === "user:change_channel" || type === "peer:offer") {
        later(1500); // presence + offer late: candidates arrive before any pc exists
      } else ws.send(m);
    });
  });
}

async function person(browser, name, scenario, { gumDelay = 0, failFirst = false } = {}) {
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  await ctx.addInitScript((n) => localStorage.setItem("$MobX-profile", JSON.stringify({ name: n, colour: "#3b82f6" })), name);
  await ctx.addInitScript(instrument, [gumDelay, failFirst]);
  const res = await ctx.request.post(`${BASE}/api/session`, { data: { password: PASSWORD } });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  const page = await ctx.newPage();
  await routeSocket(page, scenario);
  await page.goto(`${BASE}/`);
  await page.locator('[data-sidebar="content"]').getByText(name, { exact: true }).first().waitFor({ timeout: 15000 });
  return page;
}

const voiceGroup = (p) =>
  p.locator('[data-sidebar="content"] [data-sidebar="group"]').filter({ has: p.locator('[data-sidebar="group-label"]', { hasText: /^voice channels$/ }) });
const joinVoice = (p) => voiceGroup(p).getByRole("button", { name: "general", exact: true }).dblclick();

const snapshot = (p) =>
  p.evaluate(async () => {
    const open = window.__pcs.filter((pc) => pc.signalingState !== "closed");
    const conns = await Promise.all(open.map(async (pc) => {
      let rx = 0;
      (await pc.getStats()).forEach((r) => { if (r.type === "inbound-rtp" && r.kind === "audio") rx += r.bytesReceived; });
      return { ice: pc.iceConnectionState, rx };
    }));
    return {
      conns,
      pcsEver: window.__pcs.length,
      offers: window.__ev.filter((e) => e === "setLocalDescription:offer").length,
      answers: window.__ev.filter((e) => e === "setLocalDescription:answer").length,
    };
  });

async function run(scenario) {
  const [aB, bB] = [await launch(), await launch()];
  const tag = Math.random().toString(36).slice(2, 6);
  try {
    const retry = scenario.startsWith("retry");
    const a = await person(aB, `a-${tag}`, scenario, { failFirst: scenario === "retry-both" });
    const b = await person(bB, `b-${tag}`, scenario, { gumDelay: scenario === "slowmic" ? 4000 : 0, failFirst: retry });
    await joinVoice(a);
    if (scenario !== "simul") await sleep(1500);
    await joinVoice(b);
    if (retry) {
      await sleep(3000); // the banner shows; the user retries
      if (scenario === "retry-both") await a.getByRole("button", { name: "retry" }).click();
      await b.getByRole("button", { name: "retry" }).click();
    }
    await sleep(scenario === "dupoffer" ? 9000 : 7000); // past any duplicate
    const [sa, sb] = [await snapshot(a), await snapshot(b)];
    const problems = [];
    for (const [who, s] of [["a", sa], ["b", sb]]) {
      if (s.conns.length !== 1) problems.push(`${who}: ${s.conns.length} open pcs`);
      for (const c of s.conns) {
        if (!["connected", "completed"].includes(c.ice)) problems.push(`${who}: ice=${c.ice}`);
        if (!(c.rx > 0)) problems.push(`${who}: no audio received`);
      }
      if (s.pcsEver !== 1) problems.push(`${who}: ${s.pcsEver} pcs created (recreated)`);
    }
    if (sa.offers + sb.offers !== 1) problems.push(`${sa.offers + sb.offers} offers (want 1)`);
    if (sa.answers + sb.answers !== 1) problems.push(`${sa.answers + sb.answers} answers (want 1)`);
    return { scenario, ok: problems.length === 0, problems, a: sa, b: sb };
  } finally {
    await aB.close();
    await bB.close();
  }
}

let failed = 0;
for (const sc of SCENARIOS) {
  const r = await run(sc).catch((err) => ({ scenario: sc, ok: false, problems: [String(err).split("\n")[0]] }));
  if (!r.ok) failed += 1;
  const detail = r.a ? ` a=${JSON.stringify(r.a.conns)} b=${JSON.stringify(r.b.conns)}` : "";
  console.log(`${r.ok ? "PASS" : "FAIL"} ${sc}${r.ok ? "" : ` — ${r.problems.join("; ")}`}${detail}`);
}
process.exit(failed ? 1 : 0);
