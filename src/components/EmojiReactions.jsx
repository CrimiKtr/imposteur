import { useState, useEffect, useCallback, useRef } from 'react';
import socket from '../socket.js';

const EMOJIS = ['🤨', '😂', '🔥', '🤐'];

export default function EmojiReactions({ roomId }) {
  const [cooldown, setCooldown] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const nextId = useRef(0);

  const handleReaction = useCallback((emoji) => {
    if (cooldown) return;

    socket.emit('send-reaction', { roomId, emoji });
    setCooldown(true);

    setTimeout(() => {
      setCooldown(false);
    }, 2000);
  }, [cooldown, roomId]);

  // Listen for reactions from all players and display them floating on screen
  useEffect(() => {
    const onPlayerReaction = (data) => {
      const id = nextId.current++;
      const reaction = {
        id,
        emoji: data.emoji,
        playerName: data.playerName,
        // Random horizontal position (10% to 90%)
        left: 10 + Math.random() * 80,
      };

      setFloatingReactions(prev => [...prev, reaction]);

      // Remove after animation completes (2.5s)
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 2500);
    };

    socket.on('player-reaction', onPlayerReaction);
    return () => {
      socket.off('player-reaction', onPlayerReaction);
    };
  }, []);

  return (
    <>
      {/* Floating emoji reactions overlay */}
      <div className="emoji-overlay" aria-hidden="true">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="emoji-float"
            style={{ left: `${r.left}%` }}
          >
            <span className="emoji-float__emoji">{r.emoji}</span>
            <span className="emoji-float__name">{r.playerName}</span>
          </div>
        ))}
      </div>

      {/* Bottom emoji bar */}
      <div className="emoji-bar">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className={`emoji-bar__btn ${cooldown ? 'emoji-bar__btn--cooldown' : ''}`}
            onClick={() => handleReaction(emoji)}
            disabled={cooldown}
            type="button"
            title={cooldown ? 'Attends 2s...' : 'Envoyer'}
          >
            <span className="emoji-bar__emoji">{emoji}</span>
          </button>
        ))}
      </div>
    </>
  );
}
