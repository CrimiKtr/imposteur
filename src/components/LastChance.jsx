import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';

export default function LastChance({ eliminatedPlayer, roomId, myId, onResult }) {
  const isImpostor = eliminatedPlayer?.id === myId;
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(20);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-submit empty guess when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && isImpostor && !submitted) {
      handleSubmit(true);
    }
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (timeout = false) => {
    if (submitted) return;
    setSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);

    socket.emit('last-chance-guess', {
      roomId,
      guess: timeout ? '' : guess.trim(),
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const timerProgress = (timeLeft / 20) * 100;
  const timerColor = timeLeft <= 5 ? 'var(--accent-red)' : timeLeft <= 10 ? 'var(--accent-amber)' : 'var(--accent-green)';

  return (
    <>
      <div className="flex-center w-full mb-lg">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <span className="section-title__icon">⏰</span>
          Dernière Chance
        </h2>
      </div>

      <div className="last-chance-card">
        {/* Timer */}
        <div className="last-chance-timer">
          <div className="last-chance-timer__circle" style={{ '--progress': timerProgress, '--timer-color': timerColor }}>
            <span className="last-chance-timer__value" style={{ color: timerColor }}>
              {timeLeft}
            </span>
          </div>
        </div>

        {isImpostor ? (
          <>
            <h3 className="last-chance-title">
              Tu as été démasqué ! 😱
            </h3>
            <p className="last-chance-subtitle">
              Devine le mot des Civils pour gagner malgré tout !
            </p>

            {!submitted ? (
              <div className="last-chance-input-group">
                <input
                  id="last-chance-input"
                  className="form-input last-chance-input"
                  type="text"
                  placeholder="Le mot des Civils est..."
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={50}
                  autoComplete="off"
                  autoFocus
                  disabled={timeLeft === 0}
                />
                <button
                  className="btn btn--danger btn--full btn--lg"
                  onClick={() => handleSubmit(false)}
                  disabled={!guess.trim() || timeLeft === 0}
                >
                  🎯 Deviner le mot !
                </button>
              </div>
            ) : (
              <div className="text-center mt-lg">
                <p style={{ fontSize: '2rem' }}>⏳</p>
                <p className="text-secondary">Vérification en cours<span className="waiting-dots"></span></p>
              </div>
            )}
          </>
        ) : (
          <>
            <h3 className="last-chance-title">
              {eliminatedPlayer?.name} a une dernière chance ! 😰
            </h3>
            <p className="last-chance-subtitle">
              Mr White tente de deviner le mot des Civils...
            </p>
            <div className="last-chance-waiting">
              <span style={{ fontSize: '3rem' }}>🕵️</span>
              <p className="text-secondary mt-md">
                En attente de sa réponse<span className="waiting-dots"></span>
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
