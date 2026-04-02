import { useState } from 'react';
import socket from '../socket.js';

export default function VotePhase({ descriptions, roomState, myId, voteUpdate }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);

  const activePlayers = roomState.players.filter(p => !p.eliminated && p.id !== myId);

  const handleVote = () => {
    if (!selectedId || hasVoted) return;
    socket.emit('submit-vote', { roomId: roomState.roomId, votedPlayerId: selectedId });
    setHasVoted(true);
  };

  return (
    <>
      <div className="flex-between w-full mb-lg">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <span className="section-title__icon">🗳️</span>
          Phase de Vote
        </h2>
      </div>

      {/* Descriptions recap */}
      <div className="glass-card mb-lg">
        <div className="section-title mb-md">
          <span className="section-title__icon">💬</span>
          Récapitulatif des indices
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
      </div>

      {/* Voting */}
      <div className="glass-card">
        {!hasVoted ? (
          <>
            <div className="section-title mb-md">
              <span className="section-title__icon">🎯</span>
              Qui est l'imposteur ?
            </div>
            <ul className="player-list mb-lg">
              {activePlayers.map((player) => (
                <li
                  key={player.id}
                  className={`player-item player-item--clickable ${selectedId === player.id ? 'player-item--selected' : ''}`}
                  onClick={() => setSelectedId(player.id)}
                >
                  <div className="player-avatar">
                    {player.avatar || player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="player-name">{player.name}</span>
                  {selectedId === player.id && (
                    <span style={{ fontSize: '1.2rem' }}>🎯</span>
                  )}
                </li>
              ))}
            </ul>
            <button
              id="vote-btn"
              className="btn btn--danger btn--full btn--lg"
              onClick={handleVote}
              disabled={!selectedId}
            >
              🗳️ Voter pour éliminer
            </button>
          </>
        ) : (
          <div className="text-center" style={{ padding: 'var(--space-xl) 0' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>✅</p>
            <p style={{ fontWeight: 700, color: 'var(--accent-green)', marginBottom: 'var(--space-sm)' }}>
              Vote enregistré !
            </p>
            <p className="text-secondary">
              En attente des autres joueurs<span className="waiting-dots"></span>
            </p>
            {voteUpdate && (
              <div className="vote-info mt-lg">
                <span className="vote-count">{voteUpdate.voteCount}</span>
                <span className="text-secondary"> / {voteUpdate.total} votes</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
