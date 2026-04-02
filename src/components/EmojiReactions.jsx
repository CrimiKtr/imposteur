import { useState, useCallback } from 'react';
import socket from '../socket.js';

const EMOJIS = ['🤨', '😂', '🔥', '🤐'];

export default function EmojiReactions({ roomId }) {
  const [cooldown, setCooldown] = useState(false);

  const handleReaction = useCallback((emoji) => {
    if (cooldown) return;

    socket.emit('send-reaction', { roomId, emoji });
    setCooldown(true);

    setTimeout(() => {
      setCooldown(false);
    }, 2000);
  }, [cooldown, roomId]);

  return (
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
  );
}
