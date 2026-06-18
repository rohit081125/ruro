import { useEffect, useRef, useState } from "react";
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
  ChevronRight,
  ChevronLeft,
  Info,
  Sun,
  Moon,
  X,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8080";

const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

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

  const sendSignal = (message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(`${roomCode}::${JSON.stringify(message)}`);
    }
  };

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
    }
  }, [isPeerActive, cameraOn]);

  useEffect(() => {
    if (isPeerActive && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [isPeerActive, remoteCameraOn]);

  useEffect(() => {
    let cancelled = false;

    const createPeer = () => {
      const peer = new RTCPeerConnection({ iceServers });
      peerRef.current = peer;

      localStreamRef.current?.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current);
      });

      peer.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
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
        if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          setStatus("Peer disconnected");
          setIsPeerActive(false);
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
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        }
      };

      socket.onerror = () => setStatus("Signaling connection failed");
      socket.onclose = () => setStatus("Disconnected");
    };

    start();

    return () => {
      cancelled = true;
      socketRef.current?.close();
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [navigate, roomCode, displayName]);

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
    <div className="h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-800 dark:text-[#e4e4e7] flex flex-col overflow-hidden font-sans relative transition-colors duration-300">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-violet-600/2 dark:bg-violet-600/5 blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-indigo-600/2 dark:bg-indigo-600/5 blur-[150px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="h-16 min-h-16 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl px-6 flex items-center justify-between z-30 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" />
          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest hidden sm:block">
            Secure Session
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors shrink-0 cursor-pointer"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-violet-600" />}
          </button>

          <div className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${isPeerActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="font-semibold">Room Code: {roomCode}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-all text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 text-xs font-medium shadow-sm cursor-pointer"
          >
            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {isCopied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Section: Video Feeds */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 relative min-w-0 justify-center overflow-hidden">
          
          <div className="relative w-full h-full max-w-3xl mx-auto flex items-center justify-center min-h-0 animate-fade-in">
            
            {/* Remote Video Container */}
            <div
              onClick={swapped ? () => setSwapped(false) : undefined}
              className={`${
                !swapped
                  ? "w-full h-full lg:h-auto max-h-[calc(100vh-220px)] lg:max-h-none aspect-[3/4] sm:aspect-video lg:aspect-square lg:max-w-[560px] rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 overflow-hidden shadow-2xl relative transition-all duration-300 flex-1 lg:flex-none"
                  : "absolute bottom-4 right-4 lg:bottom-6 lg:right-6 w-28 h-36 sm:w-36 sm:h-48 lg:w-44 lg:h-44 rounded-2xl border-2 border-white/10 lg:border-white/20 bg-white dark:bg-zinc-950/60 overflow-hidden shadow-2xl z-10 cursor-pointer transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-violet-500/50"
              }`}
            >
              {isPeerActive && remoteCameraOn ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Center Initial Circle when Remote Camera is Off or Peer is Offline */
                <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center transition-all duration-300 pointer-events-none">
                  {isPeerActive ? (
                    <div className={`rounded-full bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-extrabold text-indigo-600 dark:text-indigo-400 select-none shadow-md animate-pulse ${
                      swapped 
                        ? "w-12 h-12 lg:w-16 lg:h-16 text-xl lg:text-2xl" 
                        : "w-16 h-16 lg:w-24 lg:h-24 text-2xl lg:text-4xl"
                    }`}>
                      {(remoteDisplayName || "Participant").charAt(0).toUpperCase()}
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
                  ? "w-full h-full lg:h-auto max-h-[calc(100vh-220px)] lg:max-h-none aspect-[3/4] sm:aspect-video lg:aspect-square lg:max-w-[560px] rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 overflow-hidden shadow-2xl relative transition-all duration-300 flex-1 lg:flex-none"
                  : "absolute bottom-4 right-4 lg:bottom-6 lg:right-6 w-28 h-36 sm:w-36 sm:h-48 lg:w-44 lg:h-44 rounded-2xl border-2 border-white/10 lg:border-white/20 bg-white dark:bg-zinc-950/60 overflow-hidden shadow-2xl z-10 cursor-pointer transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-violet-500/50"
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
                <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center transition-all duration-300 pointer-events-none">
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

          </div>

          {/* Controls Bar */}
          <div className="h-24 min-h-24 flex items-center justify-center gap-4 z-20">
            <button
              onClick={() => toggleTrack("audio")}
              className={`h-14 w-14 rounded-2xl border transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 cursor-pointer ${
                micOn
                  ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-950 dark:hover:text-white"
                  : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20"
              }`}
              title={micOn ? "Mute Mic" : "Unmute Mic"}
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
              onClick={() => toggleTrack("video")}
              className={`h-14 w-14 rounded-2xl border transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 cursor-pointer ${
                cameraOn
                  ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-950 dark:hover:text-white"
                  : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20"
              }`}
              title={cameraOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`h-14 w-14 rounded-2xl border transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 relative cursor-pointer ${
                chatOpen
                  ? "bg-violet-100 dark:bg-violet-600/10 border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-600/20"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-950 dark:hover:text-white"
              }`}
              title="Toggle Chat & Panel"
            >
              <MessageSquare size={20} />
              {messages.filter(m => !m.self && !m.system).length > 0 && !chatOpen && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={leaveRoom}
              className="h-14 w-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              title="Leave Call"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>

        {/* Sidebar panel for Chat */}
        <div
          className={`absolute lg:relative right-0 top-0 h-full border-l border-zinc-200 dark:border-white/5 bg-white/95 dark:bg-[#111115]/95 backdrop-blur-2xl flex flex-col transition-all duration-300 ease-in-out z-40 lg:z-20 ${
            chatOpen
              ? "w-full sm:w-96 translate-x-0 opacity-100 border-l"
              : "w-full sm:w-96 lg:w-0 translate-x-full lg:translate-x-0 lg:opacity-0 lg:border-l-0 overflow-hidden pointer-events-none lg:pointer-events-auto"
          }`}
        >
          {chatOpen && (
            <div className="h-full flex flex-col min-w-0 w-full sm:w-96 sm:min-w-[384px]">
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
                    <div className="h-[200px] flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-650 gap-2">
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
                className="h-20 border-t border-zinc-200 dark:border-white/5 px-4 flex items-center gap-2 bg-zinc-50 dark:bg-[#111115]"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white dark:bg-black/40 border border-zinc-300 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm outline-none focus:border-violet-500/50 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-750 text-zinc-900 dark:text-white"
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
