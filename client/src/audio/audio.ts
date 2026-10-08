import { comparer, reaction } from "mobx";

import { isAudioChannel } from "@app/config/channels";
import type { ServerMessage } from "@app/socket/events";
import { EVENT } from "@app/socket/events";
import { socket } from "@app/socket/socket";
import type { RootStore } from "@app/stores";
import type AudioStore from "@app/stores/audio";
import type { MicDevice } from "@app/stores/audio";

// Open-mic WebRTC audio mesh within a channel.
//
// Everything here is IMPERATIVE: peer connections, the mic stream and the
// <audio> elements live in plain Maps on this singleton, never in MobX/React
// state. Presence stays the observable source of truth — a reaction watches
// "my channel + who's in it" and calls sync(), which reconciles the mesh.
//
// Glare-free initiation (see docs/events.md "Mesh rules"): for each pair of
// peers in a channel, the lexicographically SMALLER id creates the offer; the
// larger id only ever answers. Both sides create the pc up front.
//
// Voice-activity detection also lives here: ONE shared AudioContext, one
// AnalyserNode per monitored stream (each remote peer + my own mic), and a
// single ~100ms poll. Only the derived per-id "speaking" boolean goes to the
// observable AudioStore, and only on transitions.

// Google STUN only. No TURN yet — a peer behind a symmetric/stubborn NAT may
// fail to connect; adding a TURN server here is the escape hatch for that.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// VAD tuning. RMS of the time-domain signal (-1..1); speech is ~0.03-0.2.
const VAD_THRESHOLD = 0.03;
const VAD_HANGOVER_MS = 250; // stay "speaking" this long after dropping below
const VAD_POLL_MS = 100;

const CUE_GAIN = 0.06; // join/leave blips: audible, well under voice

// Chrome's pseudo-devices that alias a real one; we offer our own "default".
const PSEUDO_DEVICE_IDS = new Set(["default", "communications"]);

const listMics = async (): Promise<MicDevice[]> => {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter(
      (d) => d.kind === "audioinput" && !PSEUDO_DEVICE_IDS.has(d.deviceId),
    )
    .map((d) => ({ deviceId: d.deviceId, label: d.label }));
};

// getUserMedia for a specific input, falling back to the default device if
// that one is gone (OverconstrainedError/NotFoundError). Permission errors
// propagate — that's the mic-blocked case.
const openMic = async (deviceId?: string): Promise<MediaStream> => {
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name !== "OverconstrainedError" && name !== "NotFoundError")
        throw err;
      console.warn("[audio] chosen mic unavailable, using default:", err);
    }
  }
  // Browser defaults keep echo cancellation / noise suppression on.
  return navigator.mediaDevices.getUserMedia({ audio: true });
};

type Monitor = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buf: Float32Array<ArrayBuffer>;
  lastLoud: number; // ms timestamp of the last above-threshold reading
  speaking: boolean;
};

type Peer = {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement | null;
  // ICE candidates that arrived before the remote description was set.
  pendingCandidates: RTCIceCandidateInit[];
};

class AudioManager {
  #myId = "";
  #channel = ""; // the audio channel the mesh is currently built for ("" = none)
  #desired = new Set<string>(); // peer ids I should be connected to
  #peers = new Map<string, Peer>();
  // Capture chain, on the shared AudioContext:
  //   raw mic → #micSource → #micGainNode (mic volume) → #micDest
  // #localStream is #micDest's stream: the OUTGOING track every peer gets and
  // what my VAD analyser reads. Gain + destination live for the whole channel
  // session; switching device only swaps #micSource, so the outgoing track
  // (and its enabled=false self-mute) never changes and peers need nothing.
  #rawStream: MediaStream | null = null;
  #micSource: MediaStreamAudioSourceNode | null = null;
  #micGainNode: GainNode | null = null;
  #micDest: MediaStreamAudioDestinationNode | null = null;
  #localStream: MediaStream | null = null;
  #selfMuted = false;
  // Settles (never rejects) once the mic attempt for this channel is done.
  #micReady: Promise<void> | null = null;
  // Bumped on every teardown so stale async work can tell it's been superseded.
  #generation = 0;

  // Observable flags (speaking / micBlocked); attached by startAudio().
  #store: AudioStore | null = null;
  // VAD: one shared context, one analyser per stream id, one poll loop.
  #ctx: AudioContext | null = null;
  #monitors = new Map<string, Monitor>();
  #vadTimer: ReturnType<typeof setInterval> | null = null;
  // Bumped per mic switch so an older, slower getUserMedia can't win.
  #switchSeq = 0;

  attach(store: AudioStore | null) {
    this.#store = store;
  }

  /** Called by the presence reaction whenever my channel or its members change. */
  sync(myId: string, channel: string, memberIds: string[]) {
    if (!myId || !isAudioChannel(channel)) {
      this.teardown();
      return;
    }

    if (channel !== this.#channel || myId !== this.#myId) {
      this.teardown();
      this.#myId = myId;
      this.#channel = channel;
      // We're inside the channel-join gesture here: create/resume the shared
      // context now, or it starts suspended and every analyser reads silence.
      this.#ensureContext();
      this.#micReady = this.#acquireMic(this.#generation);
    }

    this.#desired = new Set(memberIds.filter((id) => id !== myId));
    const gen = this.#generation;
    void this.#micReady?.then(() => {
      if (gen === this.#generation) this.#reconcile();
    });
  }

  /** Leave the mesh: close every pc, drop every <audio>, release the mic. */
  teardown() {
    this.#generation += 1;
    for (const id of [...this.#peers.keys()]) this.#closePeer(id);
    for (const id of [...this.#monitors.keys()]) this.#unmonitor(id);
    this.#store?.clearSpeaking();
    this.#store?.setMicBlocked(false); // only meaningful inside an audio channel
    this.#store?.setMicAcquiring(false);
    this.#store?.setActiveMic(null);
    this.#rawStream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop(); // release the mic
    });
    this.#localStream?.getTracks().forEach((t) => t.stop());
    this.#micSource?.disconnect();
    this.#micGainNode?.disconnect();
    this.#rawStream = null;
    this.#micSource = null;
    this.#micGainNode = null;
    this.#micDest = null;
    this.#localStream = null;
    this.#micReady = null;
    this.#desired.clear();
    this.#channel = "";
    this.#myId = "";
  }

  /** Full shutdown (logout/unmount): teardown plus closing the AudioContext. */
  dispose() {
    this.teardown();
    void this.#ctx?.close();
    this.#ctx = null;
  }

  /**
   * Re-attempt the mic after it was blocked (banner "retry"). If it works,
   * rebuild the mesh so peers get our track. A hard browser denial rejects
   * immediately without prompting — the banner points at site settings.
   */
  async retryMic() {
    if (!this.#channel || this.#localStream) return;
    const gen = this.#generation;
    this.#ensureContext(); // retry click is a fresh gesture
    this.#micReady = this.#acquireMic(gen);
    await this.#micReady;
    if (gen !== this.#generation || !this.#localStream) return;
    this.#rebuildMesh();
  }

  // ── microphone choice ──────────────────────────────────────────

  /** Re-read the list of audio inputs into the store. */
  async refreshDevices() {
    try {
      this.#store?.setDevices(await listMics());
    } catch (err) {
      console.warn("[audio] enumerateDevices failed:", err);
    }
  }

  /**
   * Ask for mic permission just so device labels become visible (the picker's
   * "allow access" hint). Releases the mic again unless we're using it.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop()); // just a permission probe
      await this.refreshDevices();
      return true;
    } catch (err) {
      console.warn("[audio] mic permission refused:", err);
      return false;
    }
  }

  /**
   * Pick an input ("" = system default). Always persisted; if we're in an
   * audio channel the live track is swapped in place, no rejoin.
   */
  async setMic(deviceId: string, label: string) {
    this.#store?.setMicChoice(deviceId, label);
    if (!this.#channel) return; // applies on next join
    if (!this.#localStream) {
      await this.retryMic(); // was blocked — try again with the new choice
      return;
    }
    await this.#switchMic(deviceId || undefined);
  }

  /**
   * Apply self-mute (driven by presence via startAudio's reaction). A hard
   * mute — the outgoing track is disabled, not gain 0 — and my own glow is
   * forced off explicitly rather than trusting the analyser to read silence.
   */
  setSelfMuted(muted: boolean) {
    this.#selfMuted = muted;
    this.#localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (muted && this.#myId) {
      const m = this.#monitors.get(this.#myId);
      if (m) m.speaking = false;
      this.#store?.setSpeaking(this.#myId, false);
    }
  }

  /** Live mic volume (0..2) on the outgoing chain. */
  setMicGain(gain: number) {
    if (this.#micGainNode && this.#ctx) {
      this.#micGainNode.gain.setTargetAtTime(gain, this.#ctx.currentTime, 0.02);
    }
  }

  /** Re-apply local mute + volume (per-person × master) to every <audio>. */
  applyPeerAudio() {
    for (const [id, peer] of this.#peers) this.#applyPeerAudio(id, peer);
  }

  #applyPeerAudio(id: string, peer: Peer) {
    const el = peer.audio;
    const store = this.#store;
    if (!el || !store) return;
    // Local mute/volume are keyed by the peer's uuid, resolved from presence.
    // Unknown yet → unmuted at full volume; the reaction re-applies once known.
    const uuid = store.uuidOfConnection(id);
    el.muted = uuid ? store.isLocallyMuted(uuid) : false; // local only, never broadcast
    el.volume = Math.min(
      1,
      Math.max(0, store.outputVolume * (uuid ? store.volumeOf(uuid) : 1)),
    );
  }

  /** Handler for navigator.mediaDevices "devicechange" (plug / unplug). */
  onDeviceChange = () => {
    void this.refreshDevices();
  };

  /** Incoming signalling from the socket dispatch; ignores everything else. */
  handleMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case EVENT.PeerOffer:
        void this.#onOffer(msg.from, msg.data);
        break;
      case EVENT.PeerAnswer:
        void this.#onAnswer(msg.from, msg.data);
        break;
      case EVENT.PeerCandidate:
        void this.#onCandidate(msg.from, msg.data);
        break;
      default:
        break;
    }
  };

  // ── mic ────────────────────────────────────────────────────────
  async #acquireMic(gen: number): Promise<void> {
    this.#store?.setMicAcquiring(true);
    try {
      const stream = await openMic(await this.#preferredDeviceId());
      if (gen !== this.#generation) {
        stream.getTracks().forEach((t) => t.stop()); // left before it arrived
        return;
      }
      this.#adoptStream(stream);
      this.#store?.setMicBlocked(false);
      void this.refreshDevices(); // labels are visible now we have permission
    } catch (err) {
      if (gen !== this.#generation) return;
      // Stay present (and still hear others, listen-only) — just no mic.
      // The persistent banner explains and offers a retry.
      console.warn("[audio] no microphone:", err);
      this.#store?.setMicBlocked(true);
    } finally {
      // A superseded attempt leaves the flag to the current one (teardown
      // already cleared it).
      if (gen === this.#generation) this.#store?.setMicAcquiring(false);
    }
  }

  // The persisted choice, if it's still plugged in. deviceIds can rotate, so
  // fall back to matching the saved label; without permission ids/labels are
  // hidden, so just try the saved id (openMic falls back if it's gone).
  async #preferredDeviceId(): Promise<string | undefined> {
    const id = this.#store?.micDeviceId;
    if (!id) return undefined;
    try {
      const mics = await listMics();
      if (mics.every((d) => !d.label)) return id;
      if (mics.some((d) => d.deviceId === id)) return id;
      const hint = this.#store?.micDeviceLabel;
      return hint ? mics.find((d) => d.label === hint)?.deviceId : undefined;
    } catch {
      return id;
    }
  }

  // Make `raw` the live mic: (re)point the capture chain at it, report the
  // active device, and watch for the device vanishing. The first time in a
  // channel session this also builds gain → destination, makes the
  // destination's track the outgoing one, and points my VAD analyser at it.
  #adoptStream(raw: MediaStream) {
    this.#ensureContext();
    const ctx = this.#ctx;
    if (!ctx) return;

    const old = this.#rawStream;
    this.#rawStream = raw;

    if (!this.#micGainNode || !this.#micDest) {
      this.#micGainNode = ctx.createGain();
      this.#micGainNode.gain.value = this.#store?.micGain ?? 1; // 1 = transparent
      this.#micDest = ctx.createMediaStreamDestination();
      this.#micGainNode.connect(this.#micDest);
      this.#localStream = this.#micDest.stream;
      this.setSelfMuted(this.#selfMuted); // carry mute into the new track
      this.#monitor(this.#myId, this.#localStream); // VAD on what peers hear
    }

    // Rebuild the source on the new device. Echo cancellation / noise
    // suppression were applied at capture, so they're preserved.
    this.#micSource?.disconnect();
    this.#micSource = ctx.createMediaStreamSource(raw);
    this.#micSource.connect(this.#micGainNode);

    const track = raw.getAudioTracks()[0];
    if (track) {
      this.#store?.setActiveMic({
        deviceId: track.getSettings().deviceId ?? "",
        label: track.label,
      });
      // Fires when the device is unplugged (not on our own stop()).
      track.onended = () => {
        if (this.#rawStream !== raw) return;
        console.warn("[audio] mic disconnected, falling back to default");
        this.#store?.setActiveMic(null);
        void this.#switchMic(undefined);
      };
    }

    if (old && old !== raw) {
      old.getTracks().forEach((t) => {
        t.onended = null;
        t.stop(); // release the old device (its indicator goes off)
      });
    }
  }

  // Switch input device live. Only the chain's source changes: the outgoing
  // destination track — already on every peer's sender — keeps flowing, so no
  // replaceTrack or renegotiation is needed; the old device is then released.
  async #switchMic(deviceId: string | undefined) {
    const gen = this.#generation;
    const seq = ++this.#switchSeq;
    let raw: MediaStream;
    try {
      raw = await openMic(deviceId);
    } catch (err) {
      console.warn("[audio] switching mic failed:", err);
      return;
    }
    if (gen !== this.#generation || seq !== this.#switchSeq) {
      raw.getTracks().forEach((t) => t.stop()); // superseded
      return;
    }
    this.#adoptStream(raw);
  }

  // ── mesh ───────────────────────────────────────────────────────
  #reconcile() {
    for (const id of [...this.#peers.keys()]) {
      if (!this.#desired.has(id)) this.#closePeer(id);
    }
    for (const id of this.#desired) {
      if (this.#peers.has(id)) continue;
      this.#createPeer(id);
      if (this.#myId < id) void this.#offer(id); // smaller id offers
    }
  }

  // After a mic retry succeeds our existing pcs are receive-only. Rather than
  // renegotiate each one, start fresh: close them and send a new offer to
  // every peer (whatever the ids — they're idle, so there's no glare). Their
  // onOffer sees an already-negotiated pc, replaces it, and answers.
  #rebuildMesh() {
    for (const id of [...this.#peers.keys()]) this.#closePeer(id);
    for (const id of this.#desired) {
      this.#createPeer(id);
      void this.#offer(id);
    }
  }

  #createPeer(id: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { pc, audio: null, pendingCandidates: [] };
    this.#peers.set(id, peer);

    // Add the mic track up front so offer/answer never needs renegotiation.
    // Without a mic we still want to hear them: receive-only transceiver.
    const track = this.#localStream?.getAudioTracks()[0];
    if (track && this.#localStream) pc.addTrack(track, this.#localStream);
    else pc.addTransceiver("audio", { direction: "recvonly" });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.send({
          type: EVENT.PeerCandidate,
          to: id,
          data: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      if (!peer.audio) {
        peer.audio = document.createElement("audio");
        peer.audio.autoplay = true;
        peer.audio.dataset.peer = id;
        peer.audio.hidden = true;
        document.body.appendChild(peer.audio);
      }
      peer.audio.srcObject = stream;
      this.#applyPeerAudio(id, peer); // local mute + volume
      // Joining a channel was a user gesture, so autoplay is allowed.
      peer.audio
        .play()
        .catch((err) => console.warn("[audio] play failed:", err));
      // Chrome only feeds a remote WebRTC stream into Web Audio while it's
      // also attached to a media element — which it now is.
      this.#monitor(id, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        console.warn(`[audio] connection to ${id} failed (no TURN server yet)`);
      }
    };

    return peer;
  }

  #closePeer(id: string) {
    const peer = this.#peers.get(id);
    if (!peer) return;
    this.#peers.delete(id);
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    this.#unmonitor(id); // and clear their glow
    if (peer.audio) {
      peer.audio.srcObject = null;
      peer.audio.remove();
    }
  }

  /**
   * A short, quiet two-tone blip on the shared AudioContext (no assets):
   * rising for "join", falling for "leave". Kept low so it sits under voice.
   */
  playCue(kind: "join" | "leave") {
    this.#ensureContext();
    const ctx = this.#ctx;
    if (!ctx) return;
    const [first, second] = kind === "join" ? [660, 880] : [880, 587];
    const tone = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // quick attack, exponential decay — no clicks
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(CUE_GAIN, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.12);
      osc.onended = () => gain.disconnect();
    };
    const play = () => {
      const t = ctx.currentTime + 0.01;
      tone(first, t);
      tone(second, t + 0.09);
    };
    // Normally running (joining was a click); resume quietly if not.
    if (ctx.state === "running") play();
    else ctx.resume().then(play, () => {});
  }

  // ── voice-activity detection ───────────────────────────────────
  #ensureContext() {
    this.#ctx ??= new AudioContext();
    if (this.#ctx.state === "suspended") void this.#ctx.resume();
  }

  #monitor(id: string, stream: MediaStream) {
    if (!this.#ctx || !id) return;
    this.#unmonitor(id);
    const source = this.#ctx.createMediaStreamSource(stream);
    const analyser = this.#ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser); // not to destination — the <audio> plays it
    this.#monitors.set(id, {
      source,
      analyser,
      buf: new Float32Array(analyser.fftSize),
      lastLoud: 0,
      speaking: false,
    });
    this.#vadTimer ??= setInterval(this.#pollVad, VAD_POLL_MS);
  }

  #unmonitor(id: string) {
    const m = this.#monitors.get(id);
    if (!m) return;
    this.#monitors.delete(id);
    m.source.disconnect();
    m.analyser.disconnect();
    if (m.speaking) this.#store?.setSpeaking(id, false);
    if (this.#monitors.size === 0 && this.#vadTimer) {
      clearInterval(this.#vadTimer);
      this.#vadTimer = null;
    }
  }

  #pollVad = () => {
    const now = performance.now();
    for (const [id, m] of this.#monitors) {
      m.analyser.getFloatTimeDomainData(m.buf);
      let sum = 0;
      for (const v of m.buf) sum += v * v;
      if (Math.sqrt(sum / m.buf.length) > VAD_THRESHOLD) m.lastLoud = now;

      const speaking =
        now - m.lastLoud < VAD_HANGOVER_MS &&
        !(this.#selfMuted && id === this.#myId); // muted: never glow
      if (speaking !== m.speaking) {
        m.speaking = speaking; // only touch the observable on transitions
        this.#store?.setSpeaking(id, speaking);
      }
    }
  };

  async #offer(id: string) {
    const peer = this.#peers.get(id);
    if (!peer) return;
    try {
      const offer = await peer.pc.createOffer();
      if (this.#peers.get(id) !== peer) return; // closed meanwhile
      await peer.pc.setLocalDescription(offer);
      socket.send({ type: EVENT.PeerOffer, to: id, data: offer });
    } catch (err) {
      console.warn(`[audio] offer to ${id} failed:`, err);
    }
  }

  // ── signalling handlers ────────────────────────────────────────
  // Each waits for the mic attempt first, so the local track is on the pc
  // before we answer. Stale generations (we've left since) are dropped.

  async #onOffer(from: string, offer: RTCSessionDescriptionInit) {
    const gen = this.#generation;
    await this.#micReady;
    if (gen !== this.#generation || !this.#channel) return;

    let peer = this.#peers.get(from);
    // A fresh offer for a pc that's already negotiated means they rebuilt
    // their side (e.g. left and came back) — start ours over too.
    if (peer?.pc.remoteDescription) {
      this.#closePeer(from);
      peer = undefined;
    }
    peer ??= this.#createPeer(from);

    try {
      await peer.pc.setRemoteDescription(offer);
      await this.#flushCandidates(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      if (this.#peers.get(from) !== peer) return;
      socket.send({ type: EVENT.PeerAnswer, to: from, data: answer });
    } catch (err) {
      console.warn(`[audio] answering ${from} failed:`, err);
    }
  }

  async #onAnswer(from: string, answer: RTCSessionDescriptionInit) {
    const peer = this.#peers.get(from);
    if (!peer || peer.pc.signalingState !== "have-local-offer") return;
    try {
      await peer.pc.setRemoteDescription(answer);
      await this.#flushCandidates(peer);
    } catch (err) {
      console.warn(`[audio] applying answer from ${from} failed:`, err);
    }
  }

  async #onCandidate(from: string, candidate: RTCIceCandidateInit) {
    const gen = this.#generation;
    await this.#micReady;
    if (gen !== this.#generation) return;

    const peer = this.#peers.get(from);
    if (!peer) return;
    // Candidates can beat the offer/answer here — hold them until the
    // remote description is set, or ICE silently misses them ("no audio").
    if (!peer.pc.remoteDescription) {
      peer.pendingCandidates.push(candidate);
      return;
    }
    await peer.pc.addIceCandidate(candidate).catch((err) => {
      console.warn(`[audio] bad candidate from ${from}:`, err);
    });
  }

  async #flushCandidates(peer: Peer) {
    const queued = peer.pendingCandidates.splice(0);
    for (const c of queued) {
      await peer.pc.addIceCandidate(c).catch((err) => {
        console.warn("[audio] bad queued candidate:", err);
      });
    }
  }
}

export const audio = new AudioManager();

/**
 * Drive the mesh from presence: whenever my id, my channel, or the set of
 * people in it changes, reconcile. Returns a disposer that also tears down.
 */
export function startAudio(root: RootStore): () => void {
  audio.attach(root.audio);
  void audio.refreshDevices();
  navigator.mediaDevices?.addEventListener(
    "devicechange",
    audio.onDeviceChange,
  );
  const dispose = reaction(
    () => {
      const { presence } = root;
      const channel = presence.myChannel;
      return {
        myId: presence.myId,
        channel,
        members: channel
          ? presence.membersInChannel(channel).sort().join(",")
          : "",
      };
    },
    ({ myId, channel, members }) =>
      audio.sync(myId, channel, members ? members.split(",") : []),
    {
      fireImmediately: true,
      equals: (a, b) =>
        a.myId === b.myId && a.channel === b.channel && a.members === b.members,
    },
  );
  // Self-mute follows presence (my own entry's `muted`, set locally + broadcast).
  const disposeMute = reaction(
    () => root.audio.selfMuted,
    (muted) => audio.setSelfMuted(muted),
    { fireImmediately: true },
  );
  const disposeGain = reaction(
    () => root.audio.micGain,
    (gain) => audio.setMicGain(gain),
  );
  // Local listening controls → every peer's <audio> element.
  const disposeVolumes = reaction(
    () => ({
      output: root.audio.outputVolume,
      muted: [...root.audio.localMuted.keys()].sort(),
      volumes: [...root.audio.peerVolume.entries()].sort(),
      // connection id -> uuid, so a peer whose uuid arrives later is re-applied
      uuids: [...root.presence.users.entries()]
        .map(([id, u]) => `${id}:${u.uuid}`)
        .sort(),
    }),
    () => audio.applyPeerAudio(),
    { equals: comparer.structural },
  );
  return () => {
    dispose();
    disposeMute();
    disposeGain();
    disposeVolumes();
    navigator.mediaDevices?.removeEventListener(
      "devicechange",
      audio.onDeviceChange,
    );
    audio.dispose();
    audio.attach(null);
  };
}
