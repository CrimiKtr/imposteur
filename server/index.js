import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import GameManager from './gameManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

// Serve static React build in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

const gm = new GameManager();

// ─── Helper: send room state to all players in a room ───
function broadcastRoomState(room) {
  const payload = {
    roomId: room.id,
    players: room.players.filter(p => p.connected || room.phase !== 'lobby').map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || '🐱',
      isHost: p.isHost,
      connected: p.connected,
      eliminated: room.eliminatedPlayers.includes(p.id),
    })),
    phase: room.phase,
    hostId: room.hostId,
    round: room.round,
  };
  io.to(room.id).emit('room-update', payload);
}

function getPlayerRole(room, playerId) {
  if (playerId === room.impostorId) {
    return { role: 'imposteur', secretWord: null };
  }
  return { role: 'civil', secretWord: room.secretWord };
}

// ─── Socket.IO Events ───
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Create Room ──
  socket.on('create-room', ({ playerName, avatar }, callback) => {
    const room = gm.createRoom(socket.id, playerName.trim(), avatar);
    socket.join(room.id);
    console.log(`[ROOM] ${playerName} created room ${room.id}`);
    callback({ success: true, roomId: room.id, playerName: playerName.trim() });
    broadcastRoomState(room);
  });

  // ── Join Room ──
  socket.on('join-room', ({ roomId, playerName, avatar }, callback) => {
    const normalizedId = roomId.toUpperCase().trim();
    const result = gm.joinRoom(normalizedId, socket.id, playerName.trim(), avatar);
    if (!result.success) {
      callback({ success: false, error: result.error });
      return;
    }
    socket.join(normalizedId);
    const room = gm.getRoom(normalizedId);
    console.log(`[ROOM] ${result.playerName} joined room ${normalizedId}`);
    callback({ success: true, roomId: normalizedId, playerName: result.playerName });
    broadcastRoomState(room);
  });

  // ── Start Game ──
  socket.on('start-game', ({ roomId }) => {
    const result = gm.startGame(roomId, socket.id);
    if (!result.success) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    const room = gm.getRoom(roomId);
    console.log(`[GAME] Room ${roomId} started — word: ${room.secretWord}, impostor: ${room.impostorId}`);

    // Send role to each player individually
    for (const player of room.players) {
      if (!player.connected) continue;
      const roleInfo = getPlayerRole(room, player.id);
      io.to(player.id).emit('game-started', {
        ...roleInfo,
        playerOrder: room.playerOrder.map(id => {
          const p = room.players.find(pl => pl.id === id);
          return { id, name: p?.name || '?', avatar: p?.avatar || '🐱' };
        }),
      });
    }

    // Send first turn
    broadcastRoomState(room);
    emitTurnUpdate(room);
  });

  // ── Submit Description ──
  socket.on('submit-description', ({ roomId, word }) => {
    if (!word || !word.trim()) {
      socket.emit('error-msg', { message: 'Veuillez entrer un mot.' });
      return;
    }

    const result = gm.submitDescription(roomId, socket.id, word);
    if (!result.success) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    const room = gm.getRoom(roomId);

    if (result.allDone) {
      // Move to voting phase
      io.to(roomId).emit('vote-phase', {
        descriptions: room.descriptions.map(d => ({
          playerName: d.playerName,
          playerId: d.playerId,
          playerAvatar: d.playerAvatar || '🐱',
          word: d.word,
        })),
      });
      broadcastRoomState(room);
    } else {
      emitTurnUpdate(room);
    }
  });

  // ── Submit Vote ──
  socket.on('submit-vote', ({ roomId, votedPlayerId }) => {
    const result = gm.submitVote(roomId, socket.id, votedPlayerId);
    if (!result.success) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    const room = gm.getRoom(roomId);

    if (!result.allVoted) {
      io.to(roomId).emit('vote-update', {
        voteCount: result.voteCount,
        total: result.total,
      });
      return;
    }

    // All voted — send result
    io.to(roomId).emit('vote-result', {
      tie: result.tie,
      eliminatedPlayer: result.eliminatedPlayer,
      wasImpostor: result.wasImpostor,
      gameOver: result.gameOver,
      winner: result.winner,
      secretWord: result.secretWord || null,
      impostorName: result.impostorName || null,
      voteTally: result.voteTally,
    });
    broadcastRoomState(room);
  });

  // ── Continue Game (after elimination, not game over) ──
  socket.on('continue-game', ({ roomId }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;

    gm.continueGame(roomId);
    const updatedRoom = gm.getRoom(roomId);

    // Re-send roles (same word, same impostor)
    for (const player of updatedRoom.players) {
      if (!player.connected || updatedRoom.eliminatedPlayers.includes(player.id)) continue;
      const roleInfo = getPlayerRole(updatedRoom, player.id);
      io.to(player.id).emit('game-started', {
        ...roleInfo,
        playerOrder: updatedRoom.playerOrder.map(id => {
          const p = updatedRoom.players.find(pl => pl.id === id);
          return { id, name: p?.name || '?', avatar: p?.avatar || '🐱' };
        }),
      });
    }

    broadcastRoomState(updatedRoom);
    emitTurnUpdate(updatedRoom);
  });

  // ── New Game (back to lobby) ──
  socket.on('new-game', ({ roomId }) => {
    const room = gm.getRoom(roomId);
    if (!room) return;

    gm.newGame(roomId);
    const updatedRoom = gm.getRoom(roomId);
    io.to(roomId).emit('back-to-lobby');
    broadcastRoomState(updatedRoom);
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const results = gm.handleDisconnect(socket.id);

    for (const result of results) {
      if (result.deleted) continue;
      const room = result.room;

      if (result.impostorLeft) {
        io.to(room.id).emit('vote-result', {
          tie: false,
          eliminatedPlayer: { id: room.impostorId, name: result.playerName },
          wasImpostor: true,
          gameOver: true,
          winner: 'civils',
          secretWord: room.secretWord,
          impostorName: result.playerName,
          voteTally: {},
          disconnected: true,
        });
      } else if (result.tooFewPlayers) {
        const impostorObj = room.players.find(p => p.id === room.impostorId);
        io.to(room.id).emit('vote-result', {
          tie: false,
          eliminatedPlayer: null,
          wasImpostor: false,
          gameOver: true,
          winner: 'imposteur',
          secretWord: room.secretWord,
          impostorName: impostorObj?.name,
          voteTally: {},
          disconnected: true,
        });
      } else {
        io.to(room.id).emit('player-disconnected', { playerName: result.playerName });
      }

      broadcastRoomState(room);
    }
  });
});

function emitTurnUpdate(room) {
  const currentPlayerId = room.playerOrder[room.currentTurnIndex];
  const currentPlayer = room.players.find(p => p.id === currentPlayerId);

  io.to(room.id).emit('turn-update', {
    currentPlayerId,
    currentPlayerName: currentPlayer?.name || '?',
    descriptions: room.descriptions.map(d => ({
      playerName: d.playerName,
      playerId: d.playerId,
      playerAvatar: d.playerAvatar || '🐱',
      word: d.word,
    })),
    turnIndex: room.currentTurnIndex,
    totalTurns: room.playerOrder.length,
  });
}

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`🕵️ L'Imposteur server running on port ${PORT}`);
});
