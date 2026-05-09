import React, { useEffect, useRef, useState } from "react";

import {
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Copy,
  ShieldCheck,
  Maximize2,
  MessageCircle,
  Send,
  X,
} from "lucide-react";

function CallRoom() {
  const { roomCode } = useParams();

  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  const name =
    searchParams.get("name") || "User";

  const [isMuted, setIsMuted] =
    useState(false);

  const [isCameraOff, setIsCameraOff] =
    useState(false);

  const [remoteMuted, setRemoteMuted] =
    useState(false);

  const [remoteCameraOff, setRemoteCameraOff] =
    useState(false);

  const [remoteName, setRemoteName] =
    useState("Remote User");

  const [status, setStatus] =
    useState("Waiting for participant...");

  const [connected, setConnected] =
    useState(false);

  const [roomFull, setRoomFull] =
    useState(false);

  const [seconds, setSeconds] =
    useState(0);

  const [chatOpen, setChatOpen] =
    useState(false);

  const [messageInput, setMessageInput] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const localVideoRef = useRef(null);

  const remoteVideoRef = useRef(null);

  const localContainerRef = useRef(null);

  const remoteContainerRef = useRef(null);

  const socketRef = useRef(null);

  const peerRef = useRef(null);

  const localStreamRef = useRef(null);

  const pendingCandidatesRef = useRef([]);

  const startedRef = useRef(false);

  const joinedSuccessfullyRef =
    useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startEverything();
    }

    return () => cleanup();
  }, []);

  useEffect(() => {
    let interval;

    if (connected) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [connected]);

  const formatTime = () => {
    const hrs = String(
      Math.floor(seconds / 3600)
    ).padStart(2, "0");

    const mins = String(
      Math.floor((seconds % 3600) / 60)
    ).padStart(2, "0");

    const secs = String(seconds % 60).padStart(
      2,
      "0"
    );

    return `${hrs}:${mins}:${secs}`;
  };

  const sendSignal = (data) => {
    if (
      socketRef.current?.readyState ===
      WebSocket.OPEN
    ) {
      socketRef.current.send(
        `${roomCode}::${JSON.stringify(data)}`
      );
    }
  };

  const startEverything = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject =
          stream;
      }

      socketRef.current = new WebSocket(
        "ws://localhost:8080/signal"
      );

      socketRef.current.onopen = () => {
        socketRef.current.send(
          `JOIN:${roomCode}`
        );

        sendSignal({
          type: "user-info",
          name,
        });
      };

      socketRef.current.onmessage = async (
        event
      ) => {
        const data = event.data;

        // ROOM FULL
        if (data === "ROOM_FULL") {
          setRoomFull(true);
          return;
        }

        joinedSuccessfullyRef.current = true;

        // FIRST USER
        if (data === "EXISTING_USER") {
          setStatus(
            "Waiting for participant..."
          );
          return;
        }

        // SECOND USER
        if (data === "NEW_USER_JOINED") {
          setStatus("Connecting...");

          createPeer();

          sendSignal({
            type: "user-info",
            name,
          });

          try {
            const offer =
              await peerRef.current.createOffer();

            await peerRef.current.setLocalDescription(
              offer
            );

            sendSignal({
              type: "offer",
              offer,
            });
          } catch (error) {
            console.error(error);
          }

          return;
        }

        let msg;

        try {
          msg = JSON.parse(data);
        } catch {
          return;
        }

        // USER INFO
        if (msg.type === "user-info") {
          setRemoteName(
            msg.name || "Remote User"
          );
        }

        // CHAT MESSAGE
        if (msg.type === "chat-message") {
          setMessages((prev) => [
            ...prev,
            {
              sender: msg.sender,
              text: msg.text,
              own: false,
            },
          ]);
        }

        // MIC STATUS
        if (msg.type === "mic-status") {
          setRemoteMuted(msg.muted);
        }

        // CAMERA STATUS
        if (msg.type === "camera-status") {
          setRemoteCameraOff(
            msg.cameraOff
          );
        }

        // OFFER
        if (msg.type === "offer") {
          setStatus("Incoming connection...");

          createPeer();

          try {
            await peerRef.current.setRemoteDescription(
              new RTCSessionDescription(
                msg.offer
              )
            );

            await addPendingCandidates();

            const answer =
              await peerRef.current.createAnswer();

            await peerRef.current.setLocalDescription(
              answer
            );

            sendSignal({
              type: "answer",
              answer,
            });
          } catch (error) {
            console.error(error);
          }

          return;
        }

        // ANSWER
        if (msg.type === "answer") {
          try {
            await peerRef.current.setRemoteDescription(
              new RTCSessionDescription(
                msg.answer
              )
            );

            await addPendingCandidates();

            setConnected(true);

            setStatus("Connected");
          } catch (error) {
            console.error(error);
          }

          return;
        }

        // ICE
        if (msg.type === "candidate") {
          try {
            if (
              peerRef.current &&
              peerRef.current.remoteDescription
            ) {
              await peerRef.current.addIceCandidate(
                new RTCIceCandidate(
                  msg.candidate
                )
              );
            } else {
              pendingCandidatesRef.current.push(
                msg.candidate
              );
            }
          } catch (error) {
            console.error(error);
          }

          return;
        }

        // USER LEFT
        if (msg.type === "user-left") {
          setConnected(false);

          setStatus(
            "Participant disconnected"
          );

          setRemoteMuted(false);

          setRemoteCameraOff(false);

          setRemoteName("Remote User");

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject =
              null;
          }

          peerRef.current?.close();

          peerRef.current = null;
        }
      };
    } catch (error) {
      console.error(error);

      setStatus(
        "Camera/Microphone permission denied"
      );
    }
  };

  const createPeer = () => {
    if (peerRef.current) return;

    peerRef.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    localStreamRef.current
      .getTracks()
      .forEach((track) => {
        peerRef.current.addTrack(
          track,
          localStreamRef.current
        );
      });

    peerRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject =
          event.streams[0];
      }

      setConnected(true);

      setStatus("Connected");
    };

    peerRef.current.onicecandidate = (
      event
    ) => {
      if (event.candidate) {
        sendSignal({
          type: "candidate",
          candidate: event.candidate,
        });
      }
    };

    peerRef.current.onconnectionstatechange =
      () => {
        const state =
          peerRef.current.connectionState;

        if (
          state === "disconnected" ||
          state === "failed" ||
          state === "closed"
        ) {
          setConnected(false);

          setStatus(
            "Participant disconnected"
          );

          setRemoteMuted(false);

          setRemoteCameraOff(false);

          setRemoteName("Remote User");

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject =
              null;
          }

          peerRef.current?.close();

          peerRef.current = null;
        }
      };
  };

  const addPendingCandidates = async () => {
    for (const candidate of pendingCandidatesRef.current) {
      await peerRef.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    }

    pendingCandidatesRef.current = [];
  };

  const toggleMute = () => {
    const audioTrack =
      localStreamRef.current?.getAudioTracks()[0];

    if (!audioTrack) return;

    const newMuted = !isMuted;

    audioTrack.enabled = !newMuted;

    setIsMuted(newMuted);

    sendSignal({
      type: "mic-status",
      muted: newMuted,
    });
  };

  const toggleCamera = () => {
    const videoTrack =
      localStreamRef.current?.getVideoTracks()[0];

    if (!videoTrack) return;

    const newCameraOff =
      !isCameraOff;

    videoTrack.enabled =
      !newCameraOff;

    setIsCameraOff(
      newCameraOff
    );

    sendSignal({
      type: "camera-status",
      cameraOff: newCameraOff,
    });
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;

    const newMsg = {
      sender: name,
      text: messageInput,
      own: true,
    };

    setMessages((prev) => [...prev, newMsg]);

    sendSignal({
      type: "chat-message",
      sender: name,
      text: messageInput,
    });

    setMessageInput("");
  };

  const cleanup = () => {
    if (joinedSuccessfullyRef.current) {
      try {
        sendSignal({
          type: "user-left",
        });
      } catch {}
    }

    localStreamRef.current
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    peerRef.current?.close();

    socketRef.current?.close();
  };

  const endCall = () => {
    cleanup();

    navigate("/");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(
      roomCode
    );

    setStatus("Room code copied");
  };

  const fullscreenContainer = (ref) => {
    if (!document.fullscreenElement) {
      ref.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // ROOM FULL
  if (roomFull) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="bg-white/5 border border-red-500/20 rounded-[35px] p-10 text-center max-w-lg w-full mx-5">
          <h1 className="text-4xl font-bold mb-5">
            Call Full
          </h1>

          <p className="text-slate-400 mb-8">
            This room already has two users.
          </p>

          <button
            onClick={() => navigate("/")}
            className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 transition"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-black text-white relative">

      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-black to-slate-900" />

      <div className="relative z-10 h-full flex flex-col p-4">

        {/* TOP */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck
                size={18}
                className="text-emerald-400"
              />

              <span className="text-sm text-emerald-300">
                Secure Call
              </span>
            </div>

            <h1 className="text-2xl font-bold">
              {name}
            </h1>

            <p className="text-sm text-slate-400">
              {status}
            </p>
          </div>

          <div className="flex items-center gap-3">

            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
              <p className="text-xs text-slate-400">
                TIME
              </p>

              <h2 className="text-lg font-bold text-emerald-300">
                {formatTime()}
              </h2>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4">

              <div>
                <p className="text-xs text-slate-400">
                  ROOM
                </p>

                <h2 className="text-lg font-bold tracking-widest text-indigo-300">
                  {roomCode}
                </h2>
              </div>

              <button
                onClick={copyCode}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <Copy size={18} />
              </button>

            </div>

          </div>

        </div>

        {/* MAIN */}
        <div className="flex-1 flex gap-4 min-h-0">

          {/* LEFT SIDE */}
          <div className="flex-1 grid md:grid-cols-2 gap-4 min-h-0">

            {/* REMOTE */}
            <div
              ref={remoteContainerRef}
              className="relative rounded-[30px] overflow-hidden bg-white/5 border border-white/10"
            >

              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover bg-black"
              />

              {!connected && (
                <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">

                  <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-5" />

                  <h2 className="text-xl font-bold mb-2">
                    Waiting for participant
                  </h2>

                </div>
              )}

              {remoteCameraOff &&
                connected && (
                  <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">

                    <div className="w-28 h-28 rounded-full bg-cyan-500 flex items-center justify-center text-5xl font-bold">
                      {remoteName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                  </div>
                )}

              {connected && (
                <div className="absolute bottom-5 left-5 bg-black/50 rounded-2xl px-5 py-3">
                  <p className="font-semibold">
                    {remoteName}
                  </p>
                </div>
              )}

              {remoteMuted &&
                connected && (
                  <div className="absolute top-5 right-5 bg-red-500 p-3 rounded-full">
                    <MicOff size={20} />
                  </div>
                )}

              <button
                onClick={() =>
                  fullscreenContainer(
                    remoteContainerRef
                  )
                }
                className="absolute top-5 left-5 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
              >
                <Maximize2 size={18} />
              </button>

            </div>

            {/* LOCAL */}
            <div
              ref={localContainerRef}
              className="relative rounded-[30px] overflow-hidden bg-white/5 border border-white/10"
            >

              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover bg-black"
              />

              {isCameraOff && (
                <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">

                  <div className="w-28 h-28 rounded-full bg-indigo-500 flex items-center justify-center text-5xl font-bold">
                    {name.charAt(0).toUpperCase()}
                  </div>

                </div>
              )}

              <div className="absolute bottom-5 left-5 bg-black/50 rounded-2xl px-5 py-3">
                <p className="font-semibold">
                  You
                </p>

                <p className="text-xs text-slate-400">
                  {name}
                </p>
              </div>

              {isMuted && (
                <div className="absolute top-5 right-5 bg-red-500 p-3 rounded-full">
                  <MicOff size={20} />
                </div>
              )}

              <button
                onClick={() =>
                  fullscreenContainer(
                    localContainerRef
                  )
                }
                className="absolute top-5 left-5 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
              >
                <Maximize2 size={18} />
              </button>

            </div>

          </div>

          {/* CHAT */}
          {chatOpen && (
            <div className="w-[350px] bg-white/5 border border-white/10 rounded-[30px] flex flex-col overflow-hidden backdrop-blur-xl">

              <div className="flex justify-between items-center p-5 border-b border-white/10">

                <h2 className="text-xl font-bold">
                  Chat
                </h2>

                <button
                  onClick={() =>
                    setChatOpen(false)
                  }
                  className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center"
                >
                  <X size={20} />
                </button>

              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {messages.map(
                  (msg, index) => (
                    <div
                      key={index}
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.own
                          ? "ml-auto bg-indigo-500"
                          : "bg-white/10"
                      }`}
                    >
                      <p className="text-xs mb-1 text-slate-300">
                        {msg.sender}
                      </p>

                      <p>
                        {msg.text}
                      </p>
                    </div>
                  )
                )}

              </div>

              <div className="p-4 border-t border-white/10 flex gap-3">

                <input
                  type="text"
                  placeholder="Type message..."
                  value={messageInput}
                  onChange={(e) =>
                    setMessageInput(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 outline-none"
                />

                <button
                  onClick={sendMessage}
                  className="w-12 h-12 rounded-2xl bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center"
                >
                  <Send size={18} />
                </button>

              </div>

            </div>
          )}

        </div>

        {/* CONTROLS */}
        <div className="flex justify-center pt-5">

          <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-full px-8 py-4 flex items-center gap-5">

            <button
              onClick={toggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition ${
                isMuted
                  ? "bg-red-500"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isMuted ? (
                <MicOff size={26} />
              ) : (
                <Mic size={26} />
              )}
            </button>

            <button
              onClick={toggleCamera}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition ${
                isCameraOff
                  ? "bg-red-500"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isCameraOff ? (
                <VideoOff size={26} />
              ) : (
                <Video size={26} />
              )}
            </button>

            <button
              onClick={() =>
                setChatOpen(!chatOpen)
              }
              className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            >
              <MessageCircle size={26} />
            </button>

            <button
              onClick={endCall}
              className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
            >
              <PhoneOff size={34} />
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

export default CallRoom;