import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket.js';
import Lobby from '../components/Lobby.jsx';
import GamePlay from '../components/GamePlay.jsx';
import VotePhase from '../components/VotePhase.jsx';
import ResultScreen from '../components/ResultScreen.jsx';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // Room state
  const [roomState, setRoomState] = useState(null);
  const [phase, setPhase] = useState('lobby'); // lobby | playing | voting | result

  // Game state
  const [role, setRole] = useState(null); // 'civil' | 'imposteur'
  const [secretWord, setSecretWord] = useState(null);
  const [playerOrder, setPlayerOrder] = useState([]);

  // Turn state
  const [turnData, setTurnData] = useState(null);

  // Vote state
  const [descriptions, setDescriptions] = useState([]);
  const [voteUpdate, setVoteUpdate] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

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

    const onBackToLobby = () => {
      setPhase('lobby');
      setRole(null);
      setSecretWord(null);
      setPlayerOrder([]);
      setTurnData(null);
      setDescriptions([]);
      setVoteResult(null);
      setVoteUpdate(null);
    };

    const onErrorMsg = (data) => {
      showError(data.message);
    };

    const onPlayerDisconnected = (data) => {
      showNotification(`${data.playerName} s'est déconnecté`);
    };

    socket.on('room-update', onRoomUpdate);
    socket.on('game-started', onGameStarted);
    socket.on('turn-update', onTurnUpdate);
    socket.on('vote-phase', onVotePhase);
    socket.on('vote-update', onVoteUpdate);
    socket.on('vote-result', onVoteResultHandler);
    socket.on('back-to-lobby', onBackToLobby);
    socket.on('error-msg', onErrorMsg);
    socket.on('player-disconnected', onPlayerDisconnected);

    return () => {
      socket.off('room-update', onRoomUpdate);
      socket.off('game-started', onGameStarted);
      socket.off('turn-update', onTurnUpdate);
      socket.off('vote-phase', onVotePhase);
      socket.off('vote-update', onVoteUpdate);
      socket.off('vote-result', onVoteResultHandler);
      socket.off('back-to-lobby', onBackToLobby);
      socket.off('error-msg', onErrorMsg);
      socket.off('player-disconnected', onPlayerDisconnected);
    };
  }, [showError, showNotification]);

  // Pending room join (from direct link navigation)
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingRoom');
    if (pending) {
      sessionStorage.removeItem('pendingRoom');
    }
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

  return (
    <div className="page-container">
      {phase === 'lobby' && (
        <Lobby
          roomState={roomState}
          roomId={roomId}
          isHost={isHost}
          myId={socket.id}
          onStartGame={() => socket.emit('start-game', { roomId: roomState.roomId })}
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
        />
      )}

      {phase === 'voting' && (
        <VotePhase
          descriptions={descriptions}
          roomState={roomState}
          myId={socket.id}
          voteUpdate={voteUpdate}
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

      {error && <div className="toast">{error}</div>}
      {notification && <div className="toast toast--success">{notification}</div>}
    </div>
  );
}
