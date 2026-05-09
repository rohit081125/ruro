import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function VideoCall() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const createRoom = async () => {
    if (!name.trim()) {
      setMessage("Please enter your name first.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:8080/api/rooms/create");
      const code = res.data.roomCode;

      setCreatedCode(code);
      setMessage(`${name}, your room is ready. Opening call room...`);

      navigate(`/call/${code}?name=${encodeURIComponent(name)}`);
    } catch (error) {
      setMessage("Backend is not running. Start Spring Boot first.");
    }
  };

  const joinRoom = async () => {
    if (!name.trim()) {
      setMessage("Please enter your name first.");
      return;
    }

    if (!roomCode.trim()) {
      setMessage("Please enter a room code.");
      return;
    }

    try {
      const res = await axios.get(
        `http://localhost:8080/api/rooms/check/${roomCode}`
      );

      if (res.data.exists) {
        setMessage(`Welcome ${name}, joining room ${roomCode}...`);
        navigate(`/call/${roomCode}?name=${encodeURIComponent(name)}`);
      } else {
        setMessage("Room not found. Please check the code.");
      }
    } catch (error) {
      setMessage("Something went wrong. Check backend server.");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdCode);
    setMessage("Room code copied.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-block mb-5 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm">
            Secure Room Based Video Calling
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Video calls made simple.
          </h1>

          <p className="mt-5 text-lg text-slate-300">
            Enter your name, create a private room, or join using a shared room code.
          </p>
        </div>

        <div className="max-w-xl mx-auto mb-8">
          <input
            type="text"
            placeholder="Enter Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400 text-white placeholder:text-slate-400 shadow-xl"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-5">
              <span className="text-2xl">➕</span>
            </div>

            <h2 className="text-3xl font-bold mb-3">Create Room</h2>
            <p className="text-slate-300 mb-6">
              Generate a private room code and share it with another person.
            </p>

            <button
              onClick={createRoom}
              className="w-full py-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 transition font-bold shadow-lg shadow-indigo-500/30"
            >
              Create New Room
            </button>

            {createdCode && (
              <div className="mt-7 p-5 rounded-2xl bg-slate-950/60 border border-white/20">
                <p className="text-sm text-slate-400 mb-2">Generated Room Code</p>

                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-3xl font-bold tracking-widest text-indigo-300">
                    {createdCode}
                  </h3>

                  <button
                    onClick={copyCode}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-5">
              <span className="text-2xl">🔗</span>
            </div>

            <h2 className="text-3xl font-bold mb-3">Join Room</h2>
            <p className="text-slate-300 mb-6">
              Enter the room code shared by your friend to join the call.
            </p>

            <input
              type="text"
              placeholder="Enter Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-5 py-4 rounded-xl bg-slate-950/60 border border-white/20 outline-none focus:ring-2 focus:ring-emerald-400 text-white placeholder:text-slate-500 tracking-widest mb-5"
            />

            <button
              onClick={joinRoom}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition font-bold shadow-lg shadow-emerald-500/30"
            >
              Join Existing Room
            </button>
          </div>
        </div>

        {message && (
          <div className="max-w-3xl mx-auto mt-8 text-center text-sm text-slate-200 bg-white/10 border border-white/20 rounded-xl p-4">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoCall;