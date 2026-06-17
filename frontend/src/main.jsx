import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { BrowserRouter, Routes, Route } from "react-router-dom";

import AuthPage from "./pages/AuthPage";
import VideoCall from "./pages/VideoCall";
import CallRoom from "./pages/CallRoom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Auth Page */}
        <Route path="/" element={<AuthPage />} />

        {/* Video Call Home */}
        <Route path="/home" element={<VideoCall />} />

        {/* Call Room */}
        <Route path="/call/:roomCode" element={<CallRoom />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);