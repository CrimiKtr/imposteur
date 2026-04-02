export default function PlayerList({ players, myId, onSelect, selectedId }) {
  return (
    <ul className="player-list">
      {players.map((player, i) => {
        const isSelf = player.id === myId;
        const isClickable = !!onSelect && !isSelf && !player.eliminated;

        return (
          <li
            key={player.id}
            className={`player-item
              ${isSelf ? 'player-item--self' : ''}
              ${player.eliminated ? 'player-item--eliminated' : ''}
              ${isClickable ? 'player-item--clickable' : ''}
              ${selectedId === player.id ? 'player-item--selected' : ''}
            `}
            onClick={() => isClickable && onSelect(player.id)}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="player-avatar" title={player.name}>
              {player.avatar || player.name.charAt(0).toUpperCase()}
            </div>
            <span className="player-name">{player.name}</span>
            {player.isHost && (
              <span className="player-badge player-badge--host">Hôte</span>
            )}
            {isSelf && (
              <span className="player-badge player-badge--you">Toi</span>
            )}
            {player.eliminated && (
              <span className="player-badge player-badge--eliminated">Éliminé</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
