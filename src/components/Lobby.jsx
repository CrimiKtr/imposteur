import { useState } from 'react';
import CopyLink from './CopyLink.jsx';
import PlayerList from './PlayerList.jsx';

export default function Lobby({ roomState, roomId, isHost, myId, onStartGame }) {
  const [impostorCount, setImpostorCount] = useState(1);
  const [undercoverCount, setUndercoverCount] = useState(0);

  const playerCount = roomState.players.length;

  // Max special roles: must leave at least 2 civils
  const maxSpecialRoles = Math.max(0, playerCount - 2);
  const maxImpostors = Math.min(1, maxSpecialRoles);
  const maxUndercovers = Math.max(0, maxSpecialRoles - impostorCount);

  const canStart = isHost && playerCount >= 3 && (impostorCount + undercoverCount) > 0;

  const handleStart = () => {
    onStartGame({ impostorCount, undercoverCount });
  };

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

        {/* ── Host Settings ── */}
        {isHost && (
          <div className="lobby-settings">
            <div className="section-title mt-lg">
              <span className="section-title__icon">⚙️</span>
              Paramètres
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">🔴 Imposteurs</span>
                <span className="setting-hint">Ne connaît pas le mot</span>
              </div>
              <div className="stepper">
                <button
                  className="stepper__btn"
                  onClick={() => setImpostorCount(Math.max(0, impostorCount - 1))}
                  disabled={impostorCount <= 0}
                  type="button"
                >−</button>
                <span className="stepper__value">{impostorCount}</span>
                <button
                  className="stepper__btn"
                  onClick={() => setImpostorCount(Math.min(maxImpostors, impostorCount + 1))}
                  disabled={impostorCount >= maxImpostors}
                  type="button"
                >+</button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">🟡 Infiltrés</span>
                <span className="setting-hint">Reçoit un mot proche</span>
              </div>
              <div className="stepper">
                <button
                  className="stepper__btn"
                  onClick={() => setUndercoverCount(Math.max(0, undercoverCount - 1))}
                  disabled={undercoverCount <= 0}
                  type="button"
                >−</button>
                <span className="stepper__value">{undercoverCount}</span>
                <button
                  className="stepper__btn"
                  onClick={() => setUndercoverCount(Math.min(maxUndercovers, undercoverCount + 1))}
                  disabled={undercoverCount >= maxUndercovers}
                  type="button"
                >+</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'var(--space-xl)' }}>
          {isHost ? (
            <button
              id="start-game-btn"
              className="btn btn--primary btn--full btn--lg"
              onClick={handleStart}
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
