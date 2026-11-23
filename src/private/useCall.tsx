import { useCallback, useEffect, useRef, useState } from 'react'
import { decryptPayload, encryptPayload, type CallOutcome } from './crypto'

export type CallMedia = 'audio' | 'video'
export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active'

/** Encrypted envelope sent over the realtime channel. */
export type SignalEnvelope = { from: string; sv: number; rv: number; id: string; ct: string; iv: string }

type Signal =
  | { t: 'offer'; callId: string; media: CallMedia; sdp: string }
  | { t: 'answer'; callId: string; sdp: string }
  | { t: 'ice'; callId: string; c: RTCIceCandidateInit }
  | { t: 'end'; callId: string }
  | { t: 'decline'; callId: string }
  | { t: 'busy'; callId: string }

// Cloudflare's free public STUN server. A TURN relay can be added here later
// for networks that block direct connections.
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]
const RING_TIMEOUT_MS = 45_000

type Options = {
  meId: string
  peerId: string
  /** Shared AES key for (my key version, peer key version). */
  sharedFor: (myVersion: number, peerVersion: number) => Promise<CryptoKey | null>
  myVersion: number
  peerVersion: number
  /** Sends an envelope to the peer over the realtime channel. */
  transmit: (env: SignalEnvelope) => Promise<void>
  /** Called once per outgoing call with its result, to record call history. */
  onLog?: (entry: { media: CallMedia; outcome: CallOutcome; duration?: number }) => void
}

/** Simple two-tone ring generated in the browser (no audio files needed). */
function createRinger() {
  let ctx: AudioContext | null = null
  let timer: number | undefined
  const beep = () => {
    if (!ctx) return
    for (const [freq, start] of [[440, 0], [480, 0], [440, 0.5], [480, 0.5]] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.value = 0.05
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + 0.4)
    }
  }
  return {
    start() {
      try {
        ctx = new AudioContext()
        beep()
        timer = window.setInterval(beep, 3000)
      } catch {
        // Browsers may block sound until the page has been tapped.
      }
    },
    stop() {
      window.clearInterval(timer)
      void ctx?.close()
      ctx = null
    },
  }
}

export function useCall({ meId, peerId, sharedFor, myVersion, peerVersion, transmit, onLog }: Options) {
  const [status, setStatus] = useState<CallStatus>('idle')
  const [media, setMedia] = useState<CallMedia>('audio')
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [notice, setNotice] = useState('')

  const pc = useRef<RTCPeerConnection | null>(null)
  const callId = useRef<string | null>(null)
  const statusRef = useRef<CallStatus>('idle')
  const pendingOffer = useRef<{ sdp: string; media: CallMedia } | null>(null)
  const queuedIce = useRef<RTCIceCandidateInit[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const ringTimer = useRef<number | undefined>(undefined)
  const ringer = useRef(createRinger())
  const isCaller = useRef(false)
  const logged = useRef(true)
  const mediaRef = useRef<CallMedia>('audio')
  const startedRef = useRef<number | null>(null)
  const onLogRef = useRef(onLog)
  onLogRef.current = onLog

  /** Records the result of an outgoing call once (the caller keeps the history). */
  const log = (outcome: CallOutcome) => {
    if (!isCaller.current || logged.current) return
    logged.current = true
    const started = startedRef.current
    let final: CallOutcome = started && outcome !== 'declined' && outcome !== 'busy' ? 'completed' : outcome
    if (final === 'completed' && !started) final = 'cancelled' // hung up before it connected
    onLogRef.current?.({
      media: mediaRef.current, outcome: final,
      duration: final === 'completed' && started ? Math.round((Date.now() - started) / 1000) : undefined,
    })
  }

  const setStatusBoth = (s: CallStatus) => {
    statusRef.current = s
    setStatus(s)
  }

  const send = useCallback(async (signal: Signal) => {
    const key = await sharedFor(myVersion, peerVersion)
    if (!key) return
    const id = crypto.randomUUID()
    const { ciphertext, iv } = await encryptPayload(key, id, { v: 1, text: JSON.stringify(signal) })
    await transmit({ from: meId, sv: myVersion, rv: peerVersion, id, ct: ciphertext, iv })
  }, [meId, myVersion, peerVersion, sharedFor, transmit])

  const cleanup = useCallback((message = '') => {
    window.clearTimeout(ringTimer.current)
    ringer.current.stop()
    pc.current?.close()
    pc.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    callId.current = null
    pendingOffer.current = null
    queuedIce.current = []
    setLocalStream(null)
    setRemoteStream(null)
    setMuted(false)
    setCameraOff(false)
    setStartedAt(null)
    startedRef.current = null
    setStatusBoth('idle')
    setNotice(message)
    if (message) window.setTimeout(() => setNotice(''), 4000)
  }, [])

  const getMedia = async (kind: CallMedia) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: kind === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    })
    streamRef.current = stream
    setLocalStream(stream)
    return stream
  }

  const createPeer = (stream: MediaStream) => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    stream.getTracks().forEach((track) => peer.addTrack(track, stream))
    peer.onicecandidate = (e) => {
      if (e.candidate && callId.current) void send({ t: 'ice', callId: callId.current, c: e.candidate.toJSON() })
    }
    peer.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]))
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setStatusBoth('active')
        if (!startedRef.current) startedRef.current = Date.now()
        setStartedAt((t) => t ?? Date.now())
      } else if (peer.connectionState === 'failed') {
        log('failed')
        if (callId.current) void send({ t: 'end', callId: callId.current })
        cleanup('The call could not connect.')
      }
    }
    pc.current = peer
    return peer
  }

  const flushIce = async () => {
    const peer = pc.current
    if (!peer?.remoteDescription) return
    for (const c of queuedIce.current.splice(0)) await peer.addIceCandidate(c).catch(() => {})
  }

  /** Starts an outgoing call. */
  const start = useCallback(async (kind: CallMedia) => {
    if (statusRef.current !== 'idle') return
    callId.current = crypto.randomUUID()
    isCaller.current = true
    logged.current = false
    mediaRef.current = kind
    setMedia(kind)
    setStatusBoth('outgoing')
    try {
      const stream = await getMedia(kind)
      const peer = createPeer(stream)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await send({ t: 'offer', callId: callId.current, media: kind, sdp: offer.sdp ?? '' })
      ringTimer.current = window.setTimeout(() => {
        if (statusRef.current === 'outgoing' && callId.current) {
          log('no-answer')
          void send({ t: 'end', callId: callId.current })
          cleanup('No answer.')
        }
      }, RING_TIMEOUT_MS)
    } catch {
      logged.current = true // media was blocked before ringing: nothing to record
      cleanup(kind === 'video' ? 'Camera or microphone access was blocked.' : 'Microphone access was blocked.')
    }
  }, [send, cleanup])

  const accept = useCallback(async () => {
    const offer = pendingOffer.current
    if (statusRef.current !== 'incoming' || !offer || !callId.current) return
    ringer.current.stop()
    window.clearTimeout(ringTimer.current)
    setStatusBoth('connecting')
    try {
      const stream = await getMedia(offer.media)
      const peer = createPeer(stream)
      await peer.setRemoteDescription({ type: 'offer', sdp: offer.sdp })
      await flushIce()
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      await send({ t: 'answer', callId: callId.current, sdp: answer.sdp ?? '' })
    } catch {
      if (callId.current) void send({ t: 'end', callId: callId.current })
      cleanup('Camera or microphone access was blocked.')
    }
  }, [send, cleanup])

  const decline = useCallback(() => {
    if (callId.current) void send({ t: 'decline', callId: callId.current })
    cleanup()
  }, [send, cleanup])

  const hangUp = useCallback(() => {
    log(statusRef.current === 'outgoing' ? 'cancelled' : 'completed')
    if (callId.current) void send({ t: 'end', callId: callId.current })
    cleanup()
  }, [send, cleanup])

  /** Handles an encrypted envelope received from the realtime channel. */
  const onEnvelope = useCallback(async (env: SignalEnvelope) => {
    if (!env || env.from !== peerId) return
    let signal: Signal
    try {
      const key = await sharedFor(env.rv, env.sv)
      if (!key) return
      const payload = await decryptPayload(key, env.id, env.ct, env.iv)
      signal = JSON.parse(payload.text ?? '') as Signal
    } catch {
      return // not decryptable: ignore (could be forged)
    }

    if (signal.t === 'offer') {
      if (statusRef.current !== 'idle') {
        await send({ t: 'busy', callId: signal.callId })
        return
      }
      callId.current = signal.callId
      isCaller.current = false
      pendingOffer.current = { sdp: signal.sdp, media: signal.media }
      setMedia(signal.media)
      setStatusBoth('incoming')
      ringer.current.start()
      ringTimer.current = window.setTimeout(() => {
        if (statusRef.current === 'incoming') cleanup('Missed call.')
      }, RING_TIMEOUT_MS)
      return
    }
    if (signal.callId !== callId.current) return

    switch (signal.t) {
      case 'answer':
        window.clearTimeout(ringTimer.current)
        setStatusBoth('connecting')
        await pc.current?.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
        await flushIce()
        break
      case 'ice':
        queuedIce.current.push(signal.c)
        await flushIce()
        break
      case 'decline':
        log('declined')
        cleanup('Call declined.')
        break
      case 'busy':
        log('busy')
        cleanup('They are on another call.')
        break
      case 'end':
        log(statusRef.current === 'outgoing' ? 'no-answer' : 'completed')
        cleanup(statusRef.current === 'incoming' ? 'Missed call.' : 'Call ended.')
        break
    }
  }, [peerId, sharedFor, send, cleanup])

  const toggleMute = () => {
    const next = !muted
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next })
    setMuted(next)
  }
  const toggleCamera = () => {
    const next = !cameraOff
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next })
    setCameraOff(next)
  }

  // End any call if the page goes away.
  useEffect(() => () => {
    log(statusRef.current === 'outgoing' ? 'cancelled' : 'completed')
    if (callId.current) void send({ t: 'end', callId: callId.current })
    cleanup()
  }, [])

  return {
    status, media, localStream, remoteStream, muted, cameraOff, startedAt, notice,
    start, accept, decline, hangUp, toggleMute, toggleCamera, onEnvelope,
  }
}
