import socket from '../socket.js';

export default function ResultScreen({ voteResult, roomState, isHost, myId, role }) {
  if (!voteResult) return null;

  const { tie, eliminatedPlayer, wasImpostor, wasInfiltre, gameOver, winner, secretWord, secretWordB, impostorName, voteTally, lastChanceCorrect } = voteResult;

  const handleNewGame = () => {
    socket.emit('new-game', { roomId: roomState.roomId });
  };

  const handleContinue = () => {
    socket.emit('continue-game', { roomId: roomState.roomId });
  };

  // Determine the result display
  let resultIcon, resultTitle, resultTitleClass, resultCardClass;

  if (tie) {
    resultIcon = '⚖️';
    resultTitle = 'Égalité !';
    resultTitleClass = '';
    resultCardClass = '';
  } else if (gameOver && winner === 'civils') {
    resultIcon = '🎉';
    resultTitle = 'Les Civils gagnent !';
    resultTitleClass = 'result-card__title--civils';
    resultCardClass = 'result-card--civils';
  } else if (gameOver && winner === 'imposteur') {
    resultIcon = '😈';
    resultTitle = 'Mr White gagne !';
    resultTitleClass = 'result-card__title--imposteur';
    resultCardClass = 'result-card--imposteur';
  } else if (gameOver && winner === 'infiltre') {
    resultIcon = '🕵️';
    resultTitle = 'L\'Imposteur gagne !';
    resultTitleClass = 'result-card__title--infiltre';
    resultCardClass = 'result-card--infiltre';
  } else {
    // Not game over — a player was eliminated
    resultIcon = '💀';
    resultTitle = `${eliminatedPlayer?.name} est éliminé(e)`;
    resultTitleClass = '';
    resultCardClass = '';
  }

  // Build tally display
  const tallyEntries = voteTally
    ? Object.entries(voteTally).map(([playerId, count]) => {
        const player = roomState.players.find(p => p.id === playerId);
        return { name: player?.name || '?', count };
      }).sort((a, b) => b.count - a.count)
    : [];

  return (
    <>
      <div className="flex-center w-full mb-lg">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <span className="section-title__icon">📊</span>
          Résultat
        </h2>
      </div>

      <div className={`result-card ${resultCardClass}`}>
        <span className="result-card__icon">{resultIcon}</span>
        <h3 className={`result-card__title ${resultTitleClass}`}>{resultTitle}</h3>

        {tie && (
          <p className="result-card__detail">
            Personne n'est éliminé. Un nouveau tour va commencer !
          </p>
        )}

        {!tie && eliminatedPlayer && !gameOver && (
          <p className="result-card__detail">
            <strong>{eliminatedPlayer.name}</strong> n'était {wasInfiltre ? 'que l\'imposteur' : 'pas Mr White'}. La partie continue !
          </p>
        )}

        {gameOver && winner === 'civils' && (
          <p className="result-card__detail">
            {lastChanceCorrect === false && (
              <>Mr White <strong>{impostorName}</strong> n'a pas trouvé le mot !<br /></>
            )}
            {lastChanceCorrect === undefined && (
              <>Mr White <strong>{impostorName}</strong> a été démasqué !<br /></>
            )}
            <span className="result-card__word">{secretWord}</span>
            {secretWordB && (
              <>
                <br />
                <span className="result-card__word-secondary">Mot imposteur : {secretWordB}</span>
              </>
            )}
          </p>
        )}

        {gameOver && winner === 'imposteur' && (
          <p className="result-card__detail">
            {lastChanceCorrect ? (
              <>Mr White <strong>{impostorName}</strong> a deviné le mot ! 🎯<br /></>
            ) : (
              <>Mr White <strong>{impostorName}</strong> a réussi à survivre !<br /></>
            )}
            Le mot secret était :
            <br />
            <span className="result-card__word">{secretWord}</span>
            {secretWordB && (
              <>
                <br />
                <span className="result-card__word-secondary">Mot imposteur : {secretWordB}</span>
              </>
            )}
          </p>
        )}

        {gameOver && winner === 'infiltre' && (
          <p className="result-card__detail">
            L'imposteur <strong>{impostorName}</strong> a survécu !
            <br />
            <span className="result-card__word">{secretWord}</span>
            {secretWordB && (
              <>
                <br />
                <span className="result-card__word-secondary">Mot imposteur : {secretWordB}</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* Vote Tally */}
      {tallyEntries.length > 0 && (
        <div className="glass-card mb-lg">
          <div className="section-title mb-md">
            <span className="section-title__icon">📊</span>
            Détail des votes
          </div>
          <ul className="vote-tally">
            {tallyEntries.map((entry, i) => (
              <li key={i} className="vote-tally__item">
                <span className="vote-tally__name">{entry.name}</span>
                <span className="vote-tally__count">
                  {entry.count} vote{entry.count > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {isHost && (
        <div className="btn-group">
          {!gameOver && !tie && (
            <button className="btn btn--primary btn--lg" onClick={handleContinue}>
              ▶️ Tour suivant
            </button>
          )}
          {(gameOver || tie) && !gameOver && (
            <button className="btn btn--primary btn--lg" onClick={handleContinue}>
              ▶️ Tour suivant
            </button>
          )}
          <button className="btn btn--secondary btn--lg" onClick={handleNewGame}>
            🔄 Nouvelle partie
          </button>
        </div>
      )}

      {!isHost && (
        <div className="turn-indicator">
          <p className="turn-indicator__label">
            {gameOver ? 'En attente d\'une nouvelle partie' : 'En attente du prochain tour'}
            <span className="waiting-dots"></span>
          </p>
        </div>
      )}
    </>
  );
}
