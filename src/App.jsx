import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:roomId" element={<Game />} />
        </Routes>

        <footer className="credits">
          <p className="credits__text">
            Fait par <strong className="credits__author">INCE Toli</strong> 😉
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
