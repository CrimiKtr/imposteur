import { useState } from 'react';
import socket from '../socket.js';
import PlayerList from './PlayerList.jsx';

export default function GamePlay({ role, secretWord, playerOrder, turnData, descriptions, myId, roomId, roomState, reactions }) {
  const [word, setWord] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isMyTurn = turnData?.currentPlayerId === myId;
  const progress = turnData ? (turnData.turnIndex / turnData.totalTurns) * 100 : 0;

  const handleSubmit = () => {
    const trimmed = word.trim();
    if (!trimmed) return;
    if (trimmed.includes(' ')) return; // single word only

    socket.emit('submit-description', { roomId, word: trimmed });
    setWord('');
    setSubmitted(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Determine display: anonymous for civil/infiltré, explicit for imposteur
  const isImpostor = role === 'imposteur';

  return (
    <>
      <div className="flex-between w-full mb-lg">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <span className="section-title__icon">🎮</span>
          Manche {roomState?.round || 1}
        </h2>
        <span className="status-badge status-badge--playing">
          <span className="status-badge__dot"></span>
          En jeu
        </span>
      </div>

      {/* Role Card — Anonymous for civil/infiltré */}
      {isImpostor ? (
        <div className="role-card role-card--imposteur">
          <p className="role-card__label">Ton rôle</p>
          <p className="role-card__role role-card__role--imposteur">⚪ Mr White</p>
          <p className="role-card__word role-card__word--danger">Tu es Mr White !</p>
        </div>
      ) : (
        <div className="role-card role-card--secret">
          <p className="role-card__label">Ton mot secret</p>
          <p className="role-card__word">{secretWord}</p>
          <p className="role-card__anonymous-hint">
            🤫 Décris ton mot sans le dire
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="progress-bar">
        <div className="progress-bar__fill" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Turn Indicator */}
      {turnData && (
        <div className="turn-indicator">
          <p className="turn-indicator__label">
            Tour {turnData.turnIndex + 1} / {turnData.totalTurns}
          </p>
          <p className={`turn-indicator__name ${isMyTurn ? 'turn-indicator__self' : ''}`}>
            {isMyTurn ? '🎯 C\'est à toi !' : `${turnData.currentPlayerName} réfléchit...`}
          </p>
        </div>
      )}

      <div className="glass-card">
        {/* Descriptions already submitted */}
        {descriptions.length > 0 && (
          <>
            <div className="section-title mb-md">
              <span className="section-title__icon">💬</span>
              Indices donnés
            </div>
            <ul className="descriptions-list">
              {descriptions.map((d, i) => (
                <li key={i} className="description-item" style={{ animationDelay: `${i * 0.05}s` }}>
                  <span className="description-item__avatar">{d.playerAvatar || '🐱'}</span>
                  <span className="description-item__name">{d.playerName}</span>
                  <span className="description-item__word">{d.word}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Input for current turn */}
        {isMyTurn && !submitted ? (
          <div>
            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="form-label" htmlFor="word-input">
                {isImpostor
                  ? 'Donne un indice (sans te trahir !)'
                  : 'Décris le mot secret en un mot'
                }
              </label>
              <input
                id="word-input"
                className="form-input"
                type="text"
                placeholder="Tape un mot unique..."
                value={word}
                onChange={(e) => setWord(e.target.value.replace(/\s/g, ''))}
                onKeyDown={handleKeyDown}
                maxLength={30}
                autoComplete="off"
                autoFocus
              />
            </div>
            <button
              id="submit-word-btn"
              className="btn btn--primary btn--full"
              onClick={handleSubmit}
              disabled={!word.trim()}
            >
              ✅ Valider mon indice
            </button>
          </div>
        ) : !isMyTurn && turnData ? (
          <div className="text-center text-secondary" style={{ padding: 'var(--space-md) 0' }}>
            <p>⏳ En attente de <strong style={{ color: 'var(--accent-cyan-light)' }}>{turnData.currentPlayerName}</strong><span className="waiting-dots"></span></p>
          </div>
        ) : null}
      </div>
    </>
  );
}
