import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Send,
  Copy,
  Check,
  Users,
  MessageSquare,
  Info,
  Sun,
  Moon,
  X,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8080";

const parseIceServers = () => {
  const servers = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrls = import.meta.env.VITE_TURN_URLS;

  if (turnUrls) {
    servers.push({
      urls: turnUrls.split(",").map((url) => url.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }

  return servers;
};

const iceServers = parseIceServers();

const CallRoom = () => {
  const { roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const heartbeatTimerRef = useRef(null);
  const chatEndRef = useRef(null);

  const [status, setStatus] = useState("Connecting");
  const [micOn, setMicOnState] = useState(true);
  const [cameraOn, setCameraOnState] = useState(true);
  
  const micOnRef = useRef(true);
  const cameraOnRef = useRef(true);

  const setMicOn = (val) => {
    micOnRef.current = val;
    setMicOnState(val);
  };

  const setCameraOn = (val) => {
    cameraOnRef.current = val;
    setCameraOnState(val);
  };
  
  // Chat & UI states
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPeerActive, setIsPeerActive] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [swapped, setSwapped] = useState(false);
  
  // Remote user profile and track states
  const [remoteDisplayName, setRemoteDisplayNameState] = useState("Participant");
  const remoteDisplayNameRef = useRef("Participant");
  const setRemoteDisplayName = (name) => {
    const safeName = name || "Participant";
    remoteDisplayNameRef.current = safeName;
    setRemoteDisplayNameState(safeName);
  };
  const [remoteMicOn, setRemoteMicOn] = useState(true);
  const [remoteCameraOn, setRemoteCameraOn] = useState(true);

  const getSavedUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  };
  const loggedInUser = getSavedUser();
  const displayName = loggedInUser?.fullName || searchParams.get("name") || "Guest";

  const sendSignal = useCallback((message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(`${roomCode}::${JSON.stringify(message)}`);
    }
  }, [roomCode]);

  const playVideo = useCallback((videoElement) => {
    videoElement?.play?.().catch(() => {
      // Mobile browsers can delay autoplay until the element is visible/touched.
    });
  }, []);

  const updateRemoteVideoState = useCallback((stream) => {
    const liveVideoTrack = stream
      ?.getVideoTracks()
      .find((track) => track.readyState === "live");
    setHasRemoteVideo(Boolean(liveVideoTrack));
  }, []);

  const bindRemoteStream = useCallback((stream) => {
    if (!stream) return;
    remoteStreamRef.current = stream;
    updateRemoteVideoState(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      playVideo(remoteVideoRef.current);
    }
  }, [playVideo, updateRemoteVideoState]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Re-bind camera streams to HTML video elements on DOM mount/update
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      playVideo(localVideoRef.current);
    }
  }, [isPeerActive, cameraOn, playVideo]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      bindRemoteStream(remoteStreamRef.current);
    }
  }, [hasRemoteVideo, remoteCameraOn, bindRemoteStream]);

  useEffect(() => {
    let cancelled = false;

    const createPeer = () => {
      const peer = new RTCPeerConnection({ iceServers });
      peerRef.current = peer;

      localStreamRef.current?.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current);
      });

      peer.ontrack = (event) => {
        const stream = event.streams?.[0] || remoteStreamRef.current || new MediaStream();
        if (!event.streams?.length && !stream.getTracks().some((track) => track.id === event.track.id)) {
          stream.addTrack(event.track);
        }

        event.track.onunmute = () => updateRemoteVideoState(stream);
        event.track.onmute = () => updateRemoteVideoState(stream);
        event.track.onended = () => updateRemoteVideoState(stream);

        bindRemoteStream(stream);
        setStatus("Connected");
        setIsPeerActive(true);
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: "candidate", candidate: event.candidate });
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setStatus("Connected");
          setIsPeerActive(true);
        }
        if (peer.connectionState === "disconnected") {
          setStatus("Reconnecting");
        }
        if (["failed", "closed"].includes(peer.connectionState)) {
          setStatus("Peer disconnected");
          setIsPeerActive(false);
          setHasRemoteVideo(false);
        }
      };

      return peer;
    };

    const flushCandidates = async () => {
      const peer = peerRef.current;
      if (!peer?.remoteDescription) return;
      const candidates = pendingCandidatesRef.current.splice(0);
      for (const candidate of candidates) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const start = async () => {
      if (!localStorage.getItem("token")) {
        localStorage.setItem("redirectAfterLogin", window.location.pathname);
        navigate("/");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        setCameraOn(false);
        setMicOn(false);
        setStatus("Camera or microphone unavailable");
      }

      const socket = new WebSocket(`${WS_BASE_URL}/signal`);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus("Waiting for another participant");
        socket.send(`JOIN:${roomCode}`);
        heartbeatTimerRef.current = window.setInterval(() => {
          sendSignal({ type: "keepalive", at: Date.now() });
        }, 25000);
      };

      socket.onmessage = async (event) => {
        if (event.data === "ROOM_FULL") {
          setStatus("Room is full");
          setIsPeerActive(false);
          return;
        }

        if (event.data === "EXISTING_USER") {
          createPeer();
          setMessages(prev => [...prev, { system: true, text: "Joined. Waiting for other participant..." }]);
          return;
        }

        if (event.data === "NEW_USER_JOINED") {
          const peer = peerRef.current || createPeer();
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendSignal({ type: "offer", offer, name: displayName, micOn: micOnRef.current, cameraOn: cameraOnRef.current });
          sendSignal({ type: "identity", name: displayName, micOn: micOnRef.current, cameraOn: cameraOnRef.current });
          setIsPeerActive(true);
          return;
        }

        const message = JSON.parse(event.data);

        if (message.type === "keepalive") {
          return;
        }

        // Intercept track statuses
        if (message.type === "track-status") {
          if (message.kind === "audio") {
            setRemoteMicOn(message.enabled);
          }
          if (message.kind === "video") {
            setRemoteCameraOn(message.enabled);
          }
          return;
        }

        // Intercept identity signals
        if (message.type === "identity") {
          const senderName = message.name || "Participant";
          setRemoteDisplayName(senderName);
          if (message.micOn !== undefined) setRemoteMicOn(message.micOn);
          if (message.cameraOn !== undefined) setRemoteCameraOn(message.cameraOn);

          setMessages(prev => {
            if (prev.some(m => m.text === `${senderName} joined the call.`)) {
              return prev;
            }
            return [...prev, { system: true, text: `${senderName} joined the call.` }];
          });
          return;
        }

        // Intercept chat messages
        if (message.type === "chat") {
          setMessages(prev => [
            ...prev,
            {
              sender: message.sender,
              text: message.text,
              self: false,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
          ]);
          return;
        }

        const peer = peerRef.current || createPeer();

        if (message.type === "offer") {
          if (message.name) {
            setRemoteDisplayName(message.name);
          }
          if (message.micOn !== undefined) setRemoteMicOn(message.micOn);
          if (message.cameraOn !== undefined) setRemoteCameraOn(message.cameraOn);

          await peer.setRemoteDescription(new RTCSessionDescription(message.offer));
          await flushCandidates();
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal({ type: "answer", answer, name: displayName, micOn: micOnRef.current, cameraOn: cameraOnRef.current });
          sendSignal({ type: "identity", name: displayName, micOn: micOnRef.current, cameraOn: cameraOnRef.current });
          setIsPeerActive(true);
        }

        if (message.type === "answer") {
          if (message.name) {
            setRemoteDisplayName(message.name);
          }
          if (message.micOn !== undefined) setRemoteMicOn(message.micOn);
          if (message.cameraOn !== undefined) setRemoteCameraOn(message.cameraOn);

          await peer.setRemoteDescription(new RTCSessionDescription(message.answer));
          await flushCandidates();
          setIsPeerActive(true);
        }

        if (message.type === "candidate") {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(message.candidate));
          } else {
            pendingCandidatesRef.current.push(message.candidate);
          }
        }

        if (message.type === "user-left") {
          setStatus("Peer left the room");
          setIsPeerActive(false);
          setRemoteMicOn(true);
          setRemoteCameraOn(true);
          const nameWhoLeft = remoteDisplayNameRef.current;
          setRemoteDisplayName("Participant");
          setMessages(prev => [...prev, { system: true, text: `${nameWhoLeft} left the call.` }]);
          remoteStreamRef.current = null;
          setHasRemoteVideo(false);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        }
      };

      socket.onerror = () => setStatus("Signaling connection failed");
      socket.onclose = () => setStatus("Disconnected");
    };

    start();

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimerRef.current);
      socketRef.current?.close();
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [navigate, roomCode, displayName, bindRemoteStream, sendSignal, updateRemoteVideoState]);

  const toggleTrack = (kind) => {
    const track = localStreamRef.current?.getTracks().find((item) => item.kind === kind);
    if (!track) return;
    track.enabled = !track.enabled;
    if (kind === "audio") {
      setMicOn(track.enabled);
      sendSignal({ type: "track-status", kind: "audio", enabled: track.enabled });
    }
    if (kind === "video") {
      setCameraOn(track.enabled);
      sendSignal({ type: "track-status", kind: "video", enabled: track.enabled });
    }
  };

  const leaveRoom = () => {
    navigate("/meetings");
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const payload = {
      type: "chat",
      sender: displayName,
      text: inputText.trim()
    };

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(`${roomCode}::${JSON.stringify(payload)}`);
    }

    setMessages(prev => [
      ...prev,
      {
        sender: displayName,
        text: inputText.trim(),
        self: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
    setInputText("");
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="h-[100dvh] bg-zinc-50 dark:bg-[#09090b] text-zinc-800 dark:text-[#e4e4e7] flex flex-col overflow-hidden font-sans relative transition-colors duration-300">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-violet-600/2 dark:bg-violet-600/5 blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-indigo-600/2 dark:bg-indigo-600/5 blur-[150px] pointer-events-none -z-10" />

      {/* Header (Absolute overlay on top of video) */}
      <header className="absolute top-0 left-0 right-0 min-h-16 px-3 py-3 sm:h-20 sm:px-6 sm:py-0 flex items-start sm:items-center justify-between gap-3 z-30 bg-gradient-to-b from-black/70 to-transparent text-white pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <BrandLogo size="sm" />
          <div className="h-4 w-[1px] bg-white/20 hidden sm:block" />
          <span className="text-white/60 text-xs font-semibold uppercase tracking-widest hidden sm:block">
            Secure Session
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-4 pointer-events-auto flex-wrap min-w-0">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/10 text-white/80 hover:text-white transition-colors shrink-0 cursor-pointer backdrop-blur-md"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-violet-400" />}
          </button>

          <div className="max-w-[44vw] sm:max-w-none px-2.5 sm:px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2 text-xs text-white backdrop-blur-md min-w-0">
            <span className={`w-2 h-2 rounded-full ${isPeerActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="font-semibold truncate"><span className="hidden sm:inline">Room Code: </span>{roomCode}</span>
          </div>
          <div className="hidden md:flex px-3 py-1.5 rounded-xl bg-black/30 border border-white/10 items-center gap-2 text-xs text-white/80 backdrop-blur-md max-w-52">
            <span className="truncate">{status}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="p-2 sm:px-3 rounded-xl bg-black/40 border border-white/10 hover:bg-white/10 hover:text-white transition-all text-white/80 flex items-center gap-1.5 text-xs font-medium backdrop-blur-md cursor-pointer shrink-0"
          >
            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{isCopied ? "Copied!" : "Copy Link"}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="absolute inset-0 flex min-h-0 z-10">
        {/* Left Section: Video Feeds & Controls (Floating overlays) */}
        <div className="flex-1 relative min-w-0 bg-[#020203] overflow-hidden w-full h-full">
          
          {/* Remote Video Container */}
          <div
            onClick={swapped ? () => setSwapped(false) : undefined}
            className={`${
              !swapped
                ? "w-full h-full absolute inset-0 z-0 overflow-hidden"
                : "absolute bottom-24 right-3 sm:right-4 lg:bottom-8 lg:right-8 w-24 h-32 sm:w-36 sm:h-52 lg:w-56 lg:h-36 rounded-2xl border-2 border-white/10 lg:border-white/20 bg-zinc-950/80 shadow-2xl z-20 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-violet-500/50"
            }`}
          >
            {isPeerActive && remoteCameraOn && hasRemoteVideo ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              /* Center Initial Circle when Remote Camera is Off or Peer is Offline */
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-955 dark:from-[#0a0a0c] dark:to-[#121217] flex items-center justify-center transition-all duration-300 pointer-events-none">
                {isPeerActive ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-center px-4">
                    <div className={`rounded-full bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-extrabold text-indigo-600 dark:text-indigo-400 select-none shadow-md ${
                      swapped 
                        ? "w-12 h-12 lg:w-16 lg:h-16 text-xl lg:text-2xl" 
                        : "w-16 h-16 lg:w-24 lg:h-24 text-2xl lg:text-4xl"
                    }`}>
                      {(remoteDisplayName || "Participant").charAt(0).toUpperCase()}
                    </div>
                    {!hasRemoteVideo && remoteCameraOn && !swapped && (
                      <p className="text-xs font-semibold text-zinc-400">Connecting video...</p>
                    )}
                  </div>
                ) : swapped ? (
                  <div className="flex flex-col items-center justify-center text-center select-none gap-1">
                    <Users size={16} className="text-violet-600 dark:text-violet-400 animate-pulse" />
                    <p className="text-[9px] text-zinc-500 font-bold">Waiting...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 px-6 text-center select-none">
                    <div className="w-20 h-20 rounded-full border border-violet-500/10 dark:border-violet-500/30 flex items-center justify-center relative bg-violet-50 dark:bg-violet-950/20">
                      <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" />
                      <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                        <Users size={22} className="animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">Waiting for peer...</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-500 max-w-[220px] leading-relaxed">
                        Share the room code in the header or copy link to invite someone.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top-Right Red Status Indicators for Remote Participant */}
            {isPeerActive && (
              <div className={`absolute flex z-10 pointer-events-none ${swapped ? "top-2 right-2 gap-1" : "top-4 right-4 gap-2"}`}>
                {!remoteMicOn && (
                  <div className={`rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg border border-red-500/20 ${
                    swapped ? "w-6 h-6" : "w-8 h-8"
                  }`} title="Participant Muted">
                    <MicOff size={swapped ? 10 : 14} />
                  </div>
                )}
                {!remoteCameraOn && (
                  <div className={`rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg border border-red-500/20 ${
                    swapped ? "w-6 h-6" : "w-8 h-8"
                  }`} title="Participant Camera Off">
                    <VideoOff size={swapped ? 10 : 14} />
                  </div>
                )}
              </div>
            )}

            <div className={`absolute bg-black/70 font-semibold backdrop-blur-md border border-white/5 flex items-center text-white select-none pointer-events-none ${
              swapped 
                ? "left-2 bottom-2 px-2 py-1 rounded-lg text-[9px] gap-1" 
                : "left-4 bottom-4 px-3 py-1.5 rounded-xl text-xs gap-1.5"
            }`}>
              <span className={`rounded-full ${swapped ? "w-1.5 h-1.5" : "w-2 h-2"} ${
                isPeerActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"
              }`} />
              {isPeerActive ? remoteDisplayName : swapped ? "Remote" : "Remote Participant (Offline)"}
            </div>
          </div>

          {/* Local Video Container */}
          <div
            onClick={!swapped ? () => setSwapped(true) : undefined}
            className={`${
              swapped
                ? "w-full h-full absolute inset-0 z-0 overflow-hidden"
                : "absolute bottom-24 right-3 sm:right-4 lg:bottom-8 lg:right-8 w-24 h-32 sm:w-36 sm:h-52 lg:w-56 lg:h-36 rounded-2xl border-2 border-white/10 lg:border-white/20 bg-zinc-950/80 shadow-2xl z-20 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-violet-500/50"
            }`}
          >
            {cameraOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              /* Center Initial Circle when Local Camera is Off */
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-955 dark:from-[#0a0a0c] dark:to-[#121217] flex items-center justify-center transition-all duration-300 pointer-events-none">
                <div className={`rounded-full bg-violet-100 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center font-extrabold text-violet-600 dark:text-violet-400 select-none shadow-md animate-pulse ${
                  !swapped 
                    ? "w-12 h-12 lg:w-16 lg:h-16 text-xl lg:text-2xl" 
                    : "w-16 h-16 lg:w-24 lg:h-24 text-2xl lg:text-4xl"
                }`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            {/* Top-Right Red Status Indicators for Local User */}
            <div className={`absolute flex z-10 pointer-events-none ${!swapped ? "top-2 right-2 gap-1" : "top-4 right-4 gap-2"}`}>
              {!micOn && (
                <div className={`rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg border border-red-500/20 ${
                  !swapped ? "w-6 h-6" : "w-8 h-8"
                }`} title="Muted">
                  <MicOff size={!swapped ? 10 : 14} />
                </div>
              )}
              {!cameraOn && (
                <div className={`rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg border border-red-500/20 ${
                  !swapped ? "w-6 h-6" : "w-8 h-8"
                }`} title="Camera Off">
                  <VideoOff size={!swapped ? 10 : 14} />
                </div>
              )}
            </div>

            <div className={`absolute bg-black/70 font-semibold backdrop-blur-md border border-white/5 text-white select-none pointer-events-none ${
              !swapped 
                ? "left-2 bottom-2 px-2 py-1 rounded-lg text-[9px]" 
                : "left-4 bottom-4 px-3 py-1.5 rounded-xl text-xs"
            }`}>
              {displayName} {!swapped ? "(You)" : " (You - Main)"}
            </div>
          </div>

          {/* Controls Bar (Floating over video) */}
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2.5 sm:gap-6 z-30 bg-black/65 dark:bg-black/75 backdrop-blur-xl px-3 py-3 sm:px-8 sm:py-5 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl transition-all duration-300 max-w-[calc(100vw-1rem)]">
            <button
              onClick={() => toggleTrack("audio")}
              className={`h-12 w-12 sm:h-16 sm:w-16 rounded-[1.1rem] sm:rounded-[1.5rem] border transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 cursor-pointer shrink-0 ${
                micOn
                  ? "bg-white/90 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-355 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-955 dark:hover:text-white"
                  : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20"
              }`}
              title={micOn ? "Mute Mic" : "Unmute Mic"}
            >
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>

            <button
              onClick={() => toggleTrack("video")}
              className={`h-12 w-12 sm:h-16 sm:w-16 rounded-[1.1rem] sm:rounded-[1.5rem] border transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 cursor-pointer shrink-0 ${
                cameraOn
                  ? "bg-white/90 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-355 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-955 dark:hover:text-white"
                  : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20"
              }`}
              title={cameraOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>

            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`h-12 w-12 sm:h-16 sm:w-16 rounded-[1.1rem] sm:rounded-[1.5rem] border transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 relative cursor-pointer shrink-0 ${
                chatOpen
                  ? "bg-violet-100 dark:bg-violet-600/10 border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-600/20"
                  : "bg-white/90 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-355 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-955 dark:hover:text-white"
              }`}
              title="Toggle Chat & Panel"
            >
              <MessageSquare size={22} />
              {messages.filter(m => !m.self && !m.system).length > 0 && !chatOpen && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={leaveRoom}
              className="h-12 w-12 sm:h-16 sm:w-16 rounded-[1.1rem] sm:rounded-[1.5rem] bg-red-600 hover:bg-red-500 text-white transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              title="Leave Call"
            >
              <PhoneOff size={22} />
            </button>
          </div>
        </div>

        {/* Sidebar panel for Chat (Floating overlay) */}
        <div
          className={`absolute left-3 right-3 top-20 bottom-20 sm:left-auto sm:right-4 sm:top-24 sm:bottom-24 sm:w-96 bg-white/95 dark:bg-zinc-955/90 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl flex flex-col transition-all duration-300 ease-in-out z-40 shadow-2xl ${
            chatOpen
              ? "translate-x-0 opacity-100 pointer-events-auto"
              : "translate-y-4 sm:translate-y-0 sm:translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none"
          }`}
        >
          {chatOpen && (
            <div className="h-full flex flex-col min-w-0 w-full rounded-2xl">
              {/* Sidebar Header */}
              <div className="h-14 min-h-14 border-b border-zinc-200 dark:border-white/5 px-4 flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <MessageSquare size={16} className="text-violet-600 dark:text-violet-400" />
                  Room Chat
                </span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                  title="Close Chat"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-thin">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-[200px] flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 gap-2">
                      <MessageSquare size={28} />
                      <p className="text-xs font-semibold">No messages yet</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-500 text-center max-w-[200px]">
                        Say hello to other participants in this meeting room.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      if (msg.system) {
                        return (
                          <div key={index} className="flex justify-center my-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-550 bg-zinc-100 dark:bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-white/5 flex items-center gap-1">
                              <Info size={10} />
                              {msg.text}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={index}
                          className={`flex flex-col max-w-[85%] ${
                            msg.self ? "ml-auto items-end" : "mr-auto items-start"
                          }`}
                        >
                          <span className="text-[10px] font-semibold text-zinc-500 mb-1 px-1">
                            {msg.self ? "You" : msg.sender}
                          </span>
                          <div
                            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                              msg.self
                                ? "bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-600 dark:to-indigo-600 text-white rounded-tr-none shadow-md"
                                : "bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none"
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">{msg.time}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="h-20 border-t border-zinc-200 dark:border-white/5 px-4 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-b-2xl"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white dark:bg-black/40 border border-zinc-300 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm outline-none focus:border-violet-500/50 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="h-[44px] w-[44px] rounded-2xl bg-violet-600 hover:bg-violet-700 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-all flex items-center justify-center shrink-0 shadow-md active:scale-95 cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallRoom;
