import { BrowserRouter, Routes, Route } from "react-router-dom";

import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import VideoCall from "./pages/VideoCall";
import CallRoom from "./pages/CallRoom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />

        <Route path="/home" element={<Dashboard />} />

        <Route path="/meetings" element={<VideoCall />} />

        <Route path="/call/:roomCode" element={<CallRoom />} />

        <Route path="/room/:roomCode" element={<CallRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
