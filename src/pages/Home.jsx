import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket.js';

const AVATARS = [
  { id: 'cat', emoji: '🐱', label: 'Chat' },
  { id: 'dog', emoji: '🐶', label: 'Chien' },
  { id: 'fox', emoji: '🦊', label: 'Renard' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'monkey', emoji: '🐵', label: 'Singe' },
  { id: 'lion', emoji: '🦁', label: 'Lion' },
  { id: 'frog', emoji: '🐸', label: 'Grenouille' },
  { id: 'penguin', emoji: '🐧', label: 'Pingouin' },
  { id: 'octopus', emoji: '🐙', label: 'Pieuvre' },
  { id: 'unicorn', emoji: '🦄', label: 'Licorne' },
  { id: 'dragon', emoji: '🐲', label: 'Dragon' },
  { id: 'owl', emoji: '🦉', label: 'Hibou' },
  { id: 'wolf', emoji: '🐺', label: 'Loup' },
  { id: 'tiger', emoji: '🐯', label: 'Tigre' },
  { id: 'rabbit', emoji: '🐰', label: 'Lapin' },
  { id: 'alien', emoji: '👽', label: 'Alien' },
  { id: 'robot', emoji: '🤖', label: 'Robot' },
  { id: 'ghost', emoji: '👻', label: 'Fantôme' },
];

export { AVATARS };

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('cat');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Pre-fill room code if redirected from an invitation link
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingRoom');
    if (pending) {
      setJoinCode(pending.toUpperCase());
      sessionStorage.removeItem('pendingRoom');
    }
  }, []);

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  const getAvatarEmoji = () => {
    return AVATARS.find(a => a.id === selectedAvatar)?.emoji || '🐱';
  };

  const handleCreate = () => {
    const name = playerName.trim();
    if (!name) return showError('Entre ton pseudo !');
    if (name.length > 20) return showError('Pseudo trop long (20 max)');
    setLoading(true);

    const avatar = getAvatarEmoji();
    socket.emit('create-room', { playerName: name, avatar }, (res) => {
      setLoading(false);
      if (res.success) {
        sessionStorage.setItem('playerName', res.playerName);
        sessionStorage.setItem('playerAvatar', avatar);
        navigate(`/game/${res.roomId}`);
      } else {
        showError(res.error || 'Erreur de création.');
      }
    });
  };

  const handleJoin = () => {
    const name = playerName.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) return showError('Entre ton pseudo !');
    if (!code) return showError('Entre le code du salon !');
    setLoading(true);

    const avatar = getAvatarEmoji();
    socket.emit('join-room', { roomId: code, playerName: name, avatar }, (res) => {
      setLoading(false);
      if (res.success) {
        sessionStorage.setItem('playerName', res.playerName);
        sessionStorage.setItem('playerAvatar', avatar);
        navigate(`/game/${res.roomId}`);
      } else {
        showError(res.error || 'Impossible de rejoindre.');
      }
    });
  };

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') action();
  };

  return (
    <div className="page-container">
      <div className="logo">
        <span className="logo__icon">🕵️</span>
        <h1 className="logo__title">L'Imposteur</h1>
        <p className="logo__subtitle">Jeu multijoueur en ligne</p>
      </div>

      <div className="glass-card glass-card--glow">
        <div className="form-group">
          <label className="form-label" htmlFor="pseudo-input">Ton pseudo</label>
          <input
            id="pseudo-input"
            className="form-input"
            type="text"
            placeholder="Ex: Alex, Luna, Max..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleCreate)}
            maxLength={20}
            autoComplete="off"
          />
        </div>

        {/* Avatar Picker */}
        <div className="form-group">
          <label className="form-label">Choisis ton personnage</label>
          <div className="avatar-picker">
            {AVATARS.map((av) => (
              <button
                key={av.id}
                className={`avatar-picker__item ${selectedAvatar === av.id ? 'avatar-picker__item--selected' : ''}`}
                onClick={() => setSelectedAvatar(av.id)}
                title={av.label}
                type="button"
              >
                <span className="avatar-picker__emoji">{av.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          id="create-btn"
          className="btn btn--primary btn--full btn--lg"
          onClick={handleCreate}
          disabled={loading}
        >
          🎮 Créer une partie
        </button>

        <div className="divider">
          <span className="divider__text">ou rejoindre</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="code-input">Code du salon</label>
          <input
            id="code-input"
            className="form-input"
            type="text"
            placeholder="Ex: ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => handleKeyDown(e, handleJoin)}
            maxLength={6}
            autoComplete="off"
            style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'monospace' }}
          />
        </div>

        <button
          id="join-btn"
          className="btn btn--secondary btn--full"
          onClick={handleJoin}
          disabled={loading}
        >
          🚪 Rejoindre la partie
        </button>
      </div>

      <p className="text-muted mt-lg text-center" style={{ fontSize: 'var(--font-size-xs)' }}>
        Minimum 3 joueurs • 1 imposteur • Trouvez-le !
      </p>

      {error && <div className="toast">{error}</div>}
    </div>
  );
}
