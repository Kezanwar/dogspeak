import { reaction } from "mobx";

import { CHANNELS } from "@app/config/channels";
import type { ServerMessage } from "@app/socket/events";
import { EVENT } from "@app/socket/events";
import { socket } from "@app/socket/socket";
import type { RootStore } from "@app/stores";
import { toast } from "sonner";

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

// Google STUN only. No TURN yet — a peer behind a symmetric/stubborn NAT may
// fail to connect; adding a TURN server here is the escape hatch for that.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const isAudioChannel = (channel: string) =>
  CHANNELS.some((c) => c.id === channel && c.hasAudio);

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
  #localStream: MediaStream | null = null;
  // Settles (never rejects) once the mic attempt for this channel is done.
  #micReady: Promise<void> | null = null;
  // Bumped on every teardown so stale async work can tell it's been superseded.
  #generation = 0;

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
    this.#localStream?.getTracks().forEach((t) => t.stop());
    this.#localStream = null;
    this.#micReady = null;
    this.#desired.clear();
    this.#channel = "";
    this.#myId = "";
  }

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
    try {
      // Browser defaults keep echo cancellation / noise suppression on.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (gen !== this.#generation) {
        stream.getTracks().forEach((t) => t.stop()); // left before it arrived
        return;
      }
      this.#localStream = stream;
    } catch (err) {
      if (gen !== this.#generation) return;
      // Stay present (and still hear others, listen-only) — just no mic.
      console.warn("[audio] no microphone:", err);
      toast.error(
        "couldn't access your microphone — you can still listen and chat",
      );
    }
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
      // Joining a channel was a user gesture, so autoplay is allowed.
      peer.audio
        .play()
        .catch((err) => console.warn("[audio] play failed:", err));
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
    if (peer.audio) {
      peer.audio.srcObject = null;
      peer.audio.remove();
    }
  }

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
  return () => {
    dispose();
    audio.teardown();
  };
}
