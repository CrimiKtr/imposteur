import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket.js';
import Lobby from '../components/Lobby.jsx';
import GamePlay from '../components/GamePlay.jsx';
import VotePhase from '../components/VotePhase.jsx';
import ResultScreen from '../components/ResultScreen.jsx';
import LastChance from '../components/LastChance.jsx';
import EmojiReactions from '../components/EmojiReactions.jsx';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // Room state
  const [roomState, setRoomState] = useState(null);
  const [phase, setPhase] = useState('lobby'); // lobby | playing | voting | last-chance | result

  // Game state
  const [role, setRole] = useState(null); // 'civil' | 'imposteur' | 'infiltre'
  const [secretWord, setSecretWord] = useState(null);
  const [playerOrder, setPlayerOrder] = useState([]);

  // Turn state
  const [turnData, setTurnData] = useState(null);

  // Vote state
  const [descriptions, setDescriptions] = useState([]);
  const [voteUpdate, setVoteUpdate] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  // Last Chance state
  const [lastChanceData, setLastChanceData] = useState(null);

  // Emoji reactions state
  const [reactions, setReactions] = useState({});
  const reactionTimers = useRef({});

  // UI state
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  }, []);

  const showNotification = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  // Auto-join if navigated directly via link
  useEffect(() => {
    const storedName = sessionStorage.getItem('playerName');
    if (!storedName) {
      // No name stored — redirect to home with the room code
      sessionStorage.setItem('pendingRoom', roomId);
      navigate('/');
      return;
    }

    // Check if already in the room (reconnect scenario)
    const handleRoomUpdate = (data) => {
      setRoomState(data);
      setPhase(data.phase);
    };

    socket.on('room-update', handleRoomUpdate);

    // Try to join the room if not already joined
    const myPlayer = roomState?.players?.find(p => p.id === socket.id);
    if (!myPlayer) {
      socket.emit('join-room', { roomId: roomId.toUpperCase(), playerName: storedName }, (res) => {
        if (!res.success) {
          // Might already be in the room from create
        }
      });
    }

    return () => {
      socket.off('room-update', handleRoomUpdate);
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket event listeners
  useEffect(() => {
    const onRoomUpdate = (data) => {
      setRoomState(data);
      setPhase(data.phase);
    };

    const onGameStarted = (data) => {
      setRole(data.role);
      setSecretWord(data.secretWord);
      setPlayerOrder(data.playerOrder);
      setVoteResult(null);
      setVoteUpdate(null);
      setDescriptions([]);
      setLastChanceData(null);
    };

    const onTurnUpdate = (data) => {
      setTurnData(data);
      setDescriptions(data.descriptions || []);
    };

    const onVotePhase = (data) => {
      setDescriptions(data.descriptions);
      setPhase('voting');
      setVoteUpdate(null);
    };

    const onVoteUpdate = (data) => {
      setVoteUpdate(data);
    };

    const onVoteResultHandler = (data) => {
      setVoteResult(data);
      setPhase('result');
    };

    const onLastChancePhase = (data) => {
      setLastChanceData(data);
      setPhase('last-chance');
    };

    const onLastChanceResult = (data) => {
      // Convert last chance result to a vote-result-like payload
      setVoteResult({
        tie: false,
        eliminatedPlayer: lastChanceData?.eliminatedPlayer,
        wasImpostor: true,
        wasInfiltre: false,
        gameOver: true,
        winner: data.winner,
        secretWord: data.secretWord,
        secretWordB: data.secretWordB,
        impostorName: data.impostorName,
        voteTally: lastChanceData?.voteTally || {},
        lastChanceCorrect: data.correct,
      });
      setPhase('result');
    };

    const onBackToLobby = () => {
      setPhase('lobby');
      setRole(null);
      setSecretWord(null);
      setPlayerOrder([]);
      setTurnData(null);
      setDescriptions([]);
      setVoteResult(null);
      setVoteUpdate(null);
      setLastChanceData(null);
      setReactions({});
    };

    const onErrorMsg = (data) => {
      showError(data.message);
    };

    const onPlayerDisconnected = (data) => {
      showNotification(`${data.playerName} s'est déconnecté`);
    };

    const onPlayerReaction = (data) => {
      const { playerId, emoji } = data;

      // Clear previous timer for this player
      if (reactionTimers.current[playerId]) {
        clearTimeout(reactionTimers.current[playerId]);
      }

      // Set reaction with a unique key for animation restart
      setReactions(prev => ({
        ...prev,
        [playerId]: { emoji, key: Date.now() },
      }));

      // Auto-clear after 2 seconds
      reactionTimers.current[playerId] = setTimeout(() => {
        setReactions(prev => {
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }, 2000);
    };

    socket.on('room-update', onRoomUpdate);
    socket.on('game-started', onGameStarted);
    socket.on('turn-update', onTurnUpdate);
    socket.on('vote-phase', onVotePhase);
    socket.on('vote-update', onVoteUpdate);
    socket.on('vote-result', onVoteResultHandler);
    socket.on('last-chance-phase', onLastChancePhase);
    socket.on('last-chance-result', onLastChanceResult);
    socket.on('back-to-lobby', onBackToLobby);
    socket.on('error-msg', onErrorMsg);
    socket.on('player-disconnected', onPlayerDisconnected);
    socket.on('player-reaction', onPlayerReaction);

    return () => {
      socket.off('room-update', onRoomUpdate);
      socket.off('game-started', onGameStarted);
      socket.off('turn-update', onTurnUpdate);
      socket.off('vote-phase', onVotePhase);
      socket.off('vote-update', onVoteUpdate);
      socket.off('vote-result', onVoteResultHandler);
      socket.off('last-chance-phase', onLastChancePhase);
      socket.off('last-chance-result', onLastChanceResult);
      socket.off('back-to-lobby', onBackToLobby);
      socket.off('error-msg', onErrorMsg);
      socket.off('player-disconnected', onPlayerDisconnected);
      socket.off('player-reaction', onPlayerReaction);
    };
  }, [showError, showNotification, lastChanceData]);

  // Pending room join (from direct link navigation)
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingRoom');
    if (pending) {
      sessionStorage.removeItem('pendingRoom');
    }
  }, []);

  // Cleanup reaction timers on unmount
  useEffect(() => {
    return () => {
      Object.values(reactionTimers.current).forEach(clearTimeout);
    };
  }, []);

  if (!roomState) {
    return (
      <div className="page-container">
        <div className="logo">
          <span className="logo__icon">🕵️</span>
          <h1 className="logo__title">L'Imposteur</h1>
        </div>
        <div className="glass-card text-center">
          <p className="text-secondary">Connexion au salon<span className="waiting-dots"></span></p>
        </div>
      </div>
    );
  }

  const isHost = roomState.hostId === socket.id;
  const myPlayer = roomState.players.find(p => p.id === socket.id);
  const showEmojiBar = phase === 'playing' || phase === 'voting';

  return (
    <div className="page-container">
      {phase === 'lobby' && (
        <Lobby
          roomState={roomState}
          roomId={roomId}
          isHost={isHost}
          myId={socket.id}
          onStartGame={(settings) => socket.emit('start-game', { roomId: roomState.roomId, settings })}
        />
      )}

      {phase === 'playing' && (
        <GamePlay
          role={role}
          secretWord={secretWord}
          playerOrder={playerOrder}
          turnData={turnData}
          descriptions={descriptions}
          myId={socket.id}
          roomId={roomState.roomId}
          roomState={roomState}
          reactions={reactions}
        />
      )}

      {phase === 'voting' && (
        <VotePhase
          descriptions={descriptions}
          roomState={roomState}
          myId={socket.id}
          voteUpdate={voteUpdate}
          reactions={reactions}
        />
      )}

      {phase === 'last-chance' && (
        <LastChance
          eliminatedPlayer={lastChanceData?.eliminatedPlayer}
          roomId={roomState.roomId}
          myId={socket.id}
        />
      )}

      {phase === 'result' && (
        <ResultScreen
          voteResult={voteResult}
          roomState={roomState}
          isHost={isHost}
          myId={socket.id}
          role={role}
        />
      )}

      {/* Floating emoji reaction bar */}
      {showEmojiBar && (
        <EmojiReactions roomId={roomState.roomId} />
      )}

      {error && <div className="toast">{error}</div>}
      {notification && <div className="toast toast--success">{notification}</div>}
    </div>
  );
}
