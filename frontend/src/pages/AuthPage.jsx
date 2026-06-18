import { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Fingerprint,
  Monitor,
  MessageSquare,
  Sun,
  Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";

/**
 * RURO Authentication Interface
 * Single Screen Professional Layout with Light/Dark Mode
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const AuthPage = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [forgotForm, setForgotForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [status, setStatus] = useState({
    type: "",
    msg: "",
  });

  useEffect(() => {
    if (localStorage.getItem("token")) {
      navigate("/meetings");
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

    setTimeout(() => {
      setStatus({ msg: "", type: "" });
    }, 3500);
  };

  const apiRequest = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  };

  const completeAuth = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    notify(data.message || "Authentication successful.", "success");

    const redirectTo = localStorage.getItem("redirectAfterLogin") || "/meetings";
    localStorage.removeItem("redirectAfterLogin");

    setTimeout(() => {
      navigate(redirectTo);
    }, 700);
  };

  const runAuthAction = async (action) => {
    try {
      setLoading(true);
      await action();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () =>
    runAuthAction(async () => {
      const data = await apiRequest("/api/auth/login", loginForm);
      completeAuth(data);
    });

  const handleCompleteSignup = () =>
    runAuthAction(async () => {
      const data = await apiRequest("/api/auth/signup/complete", signupForm);
      completeAuth(data);
    });

  const handleResetPassword = () =>
    runAuthAction(async () => {
      const data = await apiRequest("/api/auth/forgot/reset-password", forgotForm);
      notify(data.message || "Password reset complete.", "success");

      setTimeout(() => {
        setMode("login");
      }, 1000);
    });

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 dark:bg-[#0a0a0c] text-zinc-800 dark:text-[#e4e4e7] relative flex flex-col transition-colors duration-300">
      {/* Background Glow */}
      <div className="absolute top-[-300px] left-[-200px] w-[700px] h-[700px] bg-violet-600/5 dark:bg-violet-700/10 blur-[160px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-300px] right-[-200px] w-[700px] h-[700px] bg-violet-500/2 dark:bg-violet-500/5 blur-[160px] rounded-full pointer-events-none"></div>

      {/* NAVBAR */}
      <nav className="h-16 min-h-16 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-[#0a0a0c]/80 backdrop-blur-xl z-50">
        <div className="max-w-7xl h-full mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center">
            <BrandLogo size="md" />
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} />
                Secure Authentication
              </span>
              <span className="flex items-center gap-1.5">
                <Monitor size={14} />
                HD Communication
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors shrink-0"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-violet-600" />}
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <div className="flex-1 flex items-center justify-center px-6 py-6 overflow-hidden">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-10 items-center">
          {/* LEFT SIDE */}
          <div className="hidden lg:flex flex-col justify-center">
            <div className="max-w-xl">
              <h1 className="text-6xl font-bold leading-[1.05] tracking-tight text-zinc-950 dark:text-white">
                Secure Access
                <br />
                <span className="text-zinc-400 dark:text-zinc-600">
                  for Modern Communication.
                </span>
              </h1>

              <p className="mt-6 text-zinc-600 dark:text-zinc-400 text-lg leading-8">
                Authenticate instantly using secure credentials, and tunnel into encrypted high-definition communication rooms.
              </p>

              {/* Feature Cards */}
              <div className="mt-10 grid gap-4">
                <div className="p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 backdrop-blur-xl">
                  <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-4">
                    <MessageSquare size={22} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white">Integrated Chat</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-7">
                    Exchange messages instantly in-room during calls for seamless side discussions.
                  </p>
                </div>

                <div className="p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 backdrop-blur-xl">
                  <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-100/10 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 mb-4">
                    <Fingerprint size={22} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white">Secure Access</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-7">
                    Robust password encryption and protected media server connectivity.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AUTH CARD */}
          <div className="w-full max-w-[460px] mx-auto">
            <div className="rounded-[30px] border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/40 backdrop-blur-2xl p-7 shadow-2xl">
              {/* Tabs */}
              <div className="flex bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-2xl mb-7">
                <button
                  onClick={() => setMode("login")}
                  className={`w-1/2 h-[48px] rounded-xl font-semibold transition-all duration-305 ${
                    mode === "login"
                      ? "bg-white dark:bg-white text-black dark:text-black shadow-sm"
                      : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-850 dark:hover:text-white"
                  }`}
                >
                  Login
                </button>

                <button
                  onClick={() => setMode("signup")}
                  className={`w-1/2 h-[48px] rounded-xl font-semibold transition-all duration-305 ${
                    mode === "signup"
                      ? "bg-white dark:bg-white text-black dark:text-black shadow-sm"
                      : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-850 dark:hover:text-white"
                  }`}
                >
                  Signup
                </button>
              </div>

              {/* LOGIN */}
              {mode === "login" && (
                <div>
                  <h2 className="text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                    Welcome Back
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-500 mt-2 mb-7 text-sm leading-7">
                    Authenticate to continue your encrypted sessions.
                  </p>

                  {/* Email */}
                  <div className="mb-4">
                    <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                      Email Address
                    </label>
                    <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                      <Mail size={17} className="text-zinc-400 dark:text-zinc-500" />
                      <input
                        type="email"
                        value={loginForm.email}
                        onChange={(event) =>
                          setLoginForm({ ...loginForm, email: event.target.value })
                        }
                        placeholder="Enter your email"
                        className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                      Password
                    </label>
                    <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                      <Lock size={17} className="text-zinc-400 dark:text-zinc-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={loginForm.password}
                        onChange={(event) =>
                          setLoginForm({ ...loginForm, password: event.target.value })
                        }
                        placeholder="Enter password"
                        className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-white transition-all"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end mt-3 mb-6">
                    <button
                      onClick={() => setMode("forgot")}
                      className="text-sm text-violet-500 dark:text-violet-400 hover:underline transition-all"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full h-[56px] rounded-2xl bg-violet-600 hover:bg-violet-700 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {loading ? "Authenticating..." : "Authenticate"}
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}

              {/* SIGNUP */}
              {mode === "signup" && (
                <div>
                  <h2 className="text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                    Create Identity
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-500 mt-2 mb-7 text-sm leading-7">
                    Securely create your RURO account.
                  </p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                        Full Name
                      </label>
                      <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                        <Fingerprint size={17} className="text-zinc-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          value={signupForm.fullName}
                          onChange={(event) =>
                            setSignupForm({
                              ...signupForm,
                              fullName: event.target.value,
                            })
                          }
                          placeholder="Enter your full name"
                          className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                        Email Address
                      </label>
                      <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                        <Mail size={17} className="text-zinc-400 dark:text-zinc-500" />
                        <input
                          type="email"
                          value={signupForm.email}
                          onChange={(event) =>
                            setSignupForm({
                              ...signupForm,
                              email: event.target.value,
                            })
                          }
                          placeholder="Enter your email"
                          className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                        Password
                      </label>
                      <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                        <Lock size={17} className="text-zinc-400 dark:text-zinc-500" />
                        <input
                          type="password"
                          value={signupForm.password}
                          onChange={(event) =>
                            setSignupForm({
                              ...signupForm,
                              password: event.target.value,
                            })
                          }
                          placeholder="Create password (min 8 chars)"
                          className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                        Confirm Password
                      </label>
                      <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                        <Lock size={17} className="text-zinc-400 dark:text-zinc-500" />
                        <input
                          type="password"
                          value={signupForm.confirmPassword}
                          onChange={(event) =>
                            setSignupForm({
                              ...signupForm,
                              confirmPassword: event.target.value,
                            })
                          }
                          placeholder="Confirm password"
                          className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCompleteSignup}
                    disabled={loading}
                    className="w-full h-[56px] rounded-2xl bg-violet-600 hover:bg-violet-700 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-bold transition-all cursor-pointer"
                  >
                    {loading ? "Creating..." : "Create Account"}
                  </button>
                </div>
              )}

              {/* FORGOT PASSWORD */}
              {mode === "forgot" && (
                <div>
                  <h2 className="text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                    Reset Credentials
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-500 mt-2 mb-7 text-sm leading-7">
                    Directly update your account credentials.
                  </p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                        Email Address
                      </label>
                      <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                        <Mail size={17} className="text-zinc-400 dark:text-zinc-500" />
                        <input
                          type="email"
                          value={forgotForm.email}
                          onChange={(event) =>
                            setForgotForm({
                              ...forgotForm,
                              email: event.target.value,
                            })
                          }
                          placeholder="Enter your email"
                          className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                        New Password
                      </label>
                      <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                        <Lock size={17} className="text-zinc-400 dark:text-zinc-500" />
                        <input
                          type="password"
                          value={forgotForm.password}
                          onChange={(event) =>
                            setForgotForm({
                              ...forgotForm,
                              password: event.target.value,
                            })
                          }
                          placeholder="New password (min 8 chars)"
                          className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 font-bold ml-1">
                        Confirm New Password
                      </label>
                      <div className="mt-2 h-[54px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 px-4 flex items-center">
                        <Lock size={17} className="text-zinc-400 dark:text-zinc-500" />
                        <input
                          type="password"
                          value={forgotForm.confirmPassword}
                          onChange={(event) =>
                            setForgotForm({
                              ...forgotForm,
                              confirmPassword: event.target.value,
                            })
                          }
                          placeholder="Confirm new password"
                          className="w-full h-full bg-transparent outline-none px-3 text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="w-full h-[56px] rounded-2xl bg-violet-600 hover:bg-violet-700 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-bold transition-all cursor-pointer"
                  >
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>

                  <button
                    onClick={() => setMode("login")}
                    className="mt-5 w-full text-center text-sm text-violet-500 dark:text-violet-400 hover:underline transition-all cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICATION */}
      {status.msg && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full border shadow-2xl backdrop-blur-xl flex items-center gap-3 text-sm font-medium z-50 transition-all duration-300
          ${
            status.type === "error"
              ? "bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              status.type === "error" ? "bg-red-500" : "bg-violet-600 dark:bg-violet-500"
            }`}
          />
          {status.msg}
        </div>
      )}
    </div>
  );
};

export default AuthPage;
