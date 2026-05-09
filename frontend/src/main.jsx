import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import VideoCall from "./pages/VideoCall";
import CallRoom from "./pages/CallRoom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VideoCall />} />
        <Route path="/call/:roomCode" element={<CallRoom />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);