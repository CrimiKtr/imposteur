import { useState } from 'react';
import CopyLink from './CopyLink.jsx';
import PlayerList from './PlayerList.jsx';

export default function Lobby({ roomState, roomId, isHost, myId, onStartGame }) {
  const playerCount = roomState.players.length;
  const canStart = isHost && playerCount >= 3;

  return (
    <>
      <div className="logo">
        <span className="logo__icon">🕵️</span>
        <h1 className="logo__title">L'Imposteur</h1>
      </div>

      <div className="glass-card">
        <div className="flex-between mb-lg">
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            <span className="section-title__icon">📋</span>
            Salon
          </h2>
          <span className="status-badge status-badge--waiting">
            <span className="status-badge__dot"></span>
            En attente
          </span>
        </div>

        <div className="text-center mb-lg">
          <div className="room-code">{roomId.toUpperCase()}</div>
        </div>

        <CopyLink roomId={roomId} />

        <div className="section-title">
          <span className="section-title__icon">👥</span>
          Joueurs ({playerCount}/12)
        </div>

        <PlayerList players={roomState.players} myId={myId} />

        <div style={{ marginTop: 'var(--space-xl)' }}>
          {isHost ? (
            <button
              id="start-game-btn"
              className="btn btn--primary btn--full btn--lg"
              onClick={onStartGame}
              disabled={!canStart}
            >
              {playerCount < 3
                ? `⏳ En attente (${playerCount}/3 min.)`
                : '🚀 Lancer la partie'
              }
            </button>
          ) : (
            <div className="turn-indicator">
              <p className="turn-indicator__label">En attente du lancement</p>
              <p className="text-secondary mt-md" style={{ fontSize: 'var(--font-size-sm)' }}>
                L'hôte va bientôt lancer la partie<span className="waiting-dots"></span>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
