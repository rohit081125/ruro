import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Link,
  ArrowRight,
  ShieldCheck,
  Monitor,
  ChevronDown,
  KeyRound,
  LogOut,
  UserCircle,
  X,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";

/**
 * RURO - Professional Video Interface Lobby
 * Theme: Graphite & Electric Violet with Light/Dark Mode
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const getSavedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const VideoCall = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(getSavedUser());
  const [formData, setFormData] = useState({ roomCode: "" });
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  const [editName, setEditName] = useState(user?.fullName || "");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const userEmail = user?.email || "";
  const userName = user?.fullName || "Account";

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const notify = (msg, type = "info") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus({ msg: "", type: "" }), 5000);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const changeName = async () => {
    if (!editName.trim()) return notify("Name cannot be empty.", "error");
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/change-name`,
        { fullName: editName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      notify(res.data.message || "Name updated successfully.", "success");
      const updatedUser = { ...user, fullName: editName.trim() };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setSettingsModalOpen(false);
      setAccountMenuOpen(false);
    } catch (error) {
      notify(error.response?.data?.message || "Could not update name.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/change-password`,
        passwordForm,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      notify(res.data.message || "Password changed successfully.", "success");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setSettingsModalOpen(false);
      setAccountMenuOpen(false);
    } catch (error) {
      notify(error.response?.data?.message || "Could not change password.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const createRoom = async () => {
    if (!userName.trim()) return notify("Identity session expired. Please log in again.", "error");

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/rooms/create`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const code = res.data.roomCode;
      notify("Meeting created. Opening secure room.", "success");
      
      setTimeout(() => {
        navigate(`/call/${code}?name=${encodeURIComponent(userName)}`);
      }, 800);
    } catch {
      notify("Infrastructure offline. Verify Spring Boot connection.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!userName.trim()) return notify("Identity session expired. Please log in again.", "error");
    if (!formData.roomCode.trim()) {
      return notify("Valid Room Code is mandatory.", "error");
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/rooms/check/${formData.roomCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.exists) {
        navigate(`/call/${formData.roomCode}?name=${encodeURIComponent(userName)}`);
      } else {
        notify("Access denied. Room code not recognized.", "error");
      }
    } catch {
      notify("Network handshake failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0c] text-zinc-800 dark:text-[#e4e4e7] selection:bg-violet-500/30 font-sans transition-colors duration-300">
      {/* Navigation Header */}
      <nav className="border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-[#0a0a0c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <BrandLogo size="md" />
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-500">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14}/> End-to-End Encrypted</span>
            <span className="flex items-center gap-1.5"><Monitor size={14}/> HD Resolution</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-550 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors shrink-0"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-violet-600" />}
            </button>

            {/* Account dropdown */}
            <div className="relative">
              <button
                onClick={() => setAccountMenuOpen((open) => !open)}
                className="h-10 max-w-[260px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-950 dark:hover:text-white transition-colors"
              >
                <UserCircle size={17} className="text-violet-500 dark:text-violet-400 shrink-0" />
                <span className="truncate">{userName}</span>
                <ChevronDown size={15} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111115] shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-transparent">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-600 font-bold">
                      Signed in
                    </p>
                    <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-300 truncate">{userEmail}</p>
                  </div>

                  <button
                    onClick={() => {
                      setEditName(user?.fullName || "");
                      setSettingsModalOpen(true);
                      setAccountMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-950 dark:hover:text-white flex items-center gap-3 transition-colors text-left"
                  >
                    <Settings size={16} className="text-violet-500 dark:text-violet-400" />
                    Account Settings
                  </button>

                  <button
                    onClick={logout}
                    className="w-full px-4 py-3 text-sm text-red-500 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition-colors text-left"
                  >
                    <LogOut size={16} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        {/* Hero Section */}
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Precision Video <br /> 
            <span className="text-zinc-400 dark:text-zinc-500">for Modern Teams.</span>
          </h1>
          <p className="max-w-xl mx-auto text-zinc-600 dark:text-zinc-400 text-lg">
            A high-fidelity communication interface designed for clarity and security. 
            Zero friction, enterprise-grade stability.
          </p>
        </div>

        {/* Action Controls */}
        <div className="max-w-4xl mx-auto">
          {/* Identity Display Info (Read-only on lobby page) */}
          <div className="mb-12 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-sm">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Logged in as</p>
                <p className="text-md font-bold text-zinc-850 dark:text-zinc-200">{userName}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditName(user?.fullName || "");
                setSettingsModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all bg-white dark:bg-transparent"
            >
              Change Name
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Section */}
            <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-6 group-hover:scale-110 transition-transform">
                  <Video size={24} />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-white">Initiate Session</h2>
                <p className="text-zinc-500 dark:text-zinc-500 mb-8 leading-relaxed">
                  Generate a unique encryption key and start a new private call session instantly.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={createRoom}
                  disabled={isLoading}
                  className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? "Provisioning..." : "Create Meeting"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            {/* Join Section */}
            <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-100/10 border border-zinc-200 dark:border-zinc-100/20 flex items-center justify-center text-zinc-600 dark:text-zinc-100 mb-6 group-hover:scale-110 transition-transform">
                  <Link size={24} />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-white">Access Room</h2>
                <p className="text-zinc-500 dark:text-zinc-500 mb-8 leading-relaxed">
                  Enter an existing invitation code to securely tunnel into an ongoing conference.
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  name="roomCode"
                  placeholder="CODE-XYZ-123"
                  value={formData.roomCode}
                  onChange={(e) => setFormData(prev => ({...prev, roomCode: e.target.value.toUpperCase()}))}
                  className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 px-4 py-4 rounded-xl text-center font-mono tracking-[0.2em] text-zinc-800 dark:text-white focus:border-zinc-300 dark:focus:border-zinc-500 outline-none transition-all"
                />
                <button
                  onClick={joinRoom}
                  disabled={isLoading}
                  className="w-full py-4 bg-zinc-800 dark:bg-zinc-800 hover:bg-zinc-700 dark:hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors border border-zinc-700 cursor-pointer"
                >
                  Join Session
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Bar */}
        {status.msg && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full border shadow-2xl backdrop-blur-xl animate-bounce-short flex items-center gap-3 text-sm font-medium transition-all duration-300
            ${status.type === "error" ? "bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"}`}>
            <div className={`w-2 h-2 rounded-full ${status.type === "error" ? "bg-red-500" : "bg-violet-600 dark:bg-violet-500"}`} />
            {status.msg}
          </div>
        )}
      </main>

      {/* Subtle background element */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-violet-600/2 dark:bg-violet-600/5 blur-[120px] pointer-events-none -z-10" />

      {/* Unified Settings Modal */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-[80] bg-black/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 shadow-2xl text-zinc-800 dark:text-zinc-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Account Settings</h2>
                <p className="text-sm text-zinc-500 mt-1 truncate">{userEmail}</p>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
              
              {/* Section 1: Profile Details */}
              <div className="pb-6 border-b border-zinc-100 dark:border-white/5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-3">Profile Info</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold">Full Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your full name"
                      className="mt-1 w-full h-[50px] bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 px-4 rounded-xl outline-none focus:border-violet-500/50 text-zinc-800 dark:text-white transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                    />
                  </div>
                  <button
                    onClick={changeName}
                    disabled={isLoading}
                    className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {isLoading ? "Updating Profile..." : "Update Profile Name"}
                  </button>
                </div>
              </div>

              {/* Section 2: Change Password */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-3">Change Password</h3>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: event.target.value,
                      })
                    }
                    placeholder="Current password"
                    className="w-full h-[50px] bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 px-4 rounded-xl outline-none focus:border-violet-500/50 text-zinc-800 dark:text-white transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                  />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: event.target.value,
                      })
                    }
                    placeholder="New password"
                    className="w-full h-[50px] bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 px-4 rounded-xl outline-none focus:border-violet-500/50 text-zinc-800 dark:text-white transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                  />
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: event.target.value,
                      })
                    }
                    placeholder="Confirm new password"
                    className="w-full h-[50px] bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 px-4 rounded-xl outline-none focus:border-violet-500/50 text-zinc-800 dark:text-white transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                  />
                  <button
                    onClick={changePassword}
                    disabled={isLoading}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer text-sm border border-zinc-700"
                  >
                    {isLoading ? "Updating Password..." : "Update Password"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VideoCall;
