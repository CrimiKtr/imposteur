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

// ─── Emoji reaction cooldown tracking ───
const reactionCooldowns = new Map(); // socketId -> lastReactionTimestamp

// ─── Last chance timers ───
const lastChanceTimers = new Map(); // roomId -> timeout

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
    settings: room.settings,
  };
  io.to(room.id).emit('room-update', payload);
}

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
  socket.on('start-game', ({ roomId, settings }) => {
    const result = gm.startGame(roomId, socket.id, settings || {});
    if (!result.success) {
      socket.emit('error-msg', { message: result.error });
      return;
    }

    const room = gm.getRoom(roomId);
    console.log(`[GAME] Room ${roomId} started — wordA: ${room.secretWordA}, wordB: ${room.secretWordB}, impostors: ${room.impostorIds.length}, infiltrés: ${room.undercoverIds.length}`);

    // Send role to each player individually
    for (const player of room.players) {
      if (!player.connected) continue;
      const roleInfo = gm.getPlayerRole(room, player.id);
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

    // Check if Last Chance is triggered
    if (result.triggerLastChance) {
      // Emit last-chance phase to all players
      io.to(roomId).emit('last-chance-phase', {
        eliminatedPlayer: result.eliminatedPlayer,
        voteTally: result.voteTally,
      });
      broadcastRoomState(room);

      // Set server-side safety timer (22s to account for network latency)
      const timer = setTimeout(() => {
        const currentRoom = gm.getRoom(roomId);
        if (currentRoom && currentRoom.phase === 'last-chance') {
          const timeoutResult = gm.lastChanceTimeout(roomId);
          if (timeoutResult) {
            io.to(roomId).emit('last-chance-result', {
              correct: false,
              winner: timeoutResult.winner,
              secretWord: timeoutResult.secretWord,
              secretWordB: timeoutResult.secretWordB,
              impostorName: timeoutResult.impostorName,
              timeout: true,
            });
            broadcastRoomState(gm.getRoom(roomId));
          }
        }
        lastChanceTimers.delete(roomId);
      }, 22000);

      lastChanceTimers.set(roomId, timer);
      return;
    }

    // All voted — send result (no last chance)
    io.to(roomId).emit('vote-result', {
      tie: result.tie,
      eliminatedPlayer: result.eliminatedPlayer,
      wasImpostor: result.wasImpostor,
      wasInfiltre: result.wasInfiltre || false,
      gameOver: result.gameOver,
      winner: result.winner,
      secretWord: result.secretWord || null,
      secretWordB: result.secretWordB || null,
      impostorName: result.impostorName || null,
      voteTally: result.voteTally,
    });
    broadcastRoomState(room);
  });

  // ── Last Chance Guess ──
  socket.on('last-chance-guess', ({ roomId, guess }) => {
    const result = gm.checkLastChanceGuess(roomId, socket.id, guess);
    if (!result.success) {
      socket.emit('error-msg', { message: result.error || 'Erreur.' });
      return;
    }

    // Clear the safety timer
    if (lastChanceTimers.has(roomId)) {
      clearTimeout(lastChanceTimers.get(roomId));
      lastChanceTimers.delete(roomId);
    }

    // Broadcast result to all players
    io.to(roomId).emit('last-chance-result', {
      correct: result.correct,
      winner: result.winner,
      secretWord: result.secretWord,
      secretWordB: result.secretWordB,
      impostorName: result.impostorName,
      timeout: false,
    });

    const room = gm.getRoom(roomId);
    broadcastRoomState(room);
  });

  // ── Continue Game (after elimination, not game over) ──
  socket.on('continue-game', ({ roomId }) => {
    const room = gm.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;

    gm.continueGame(roomId);
    const updatedRoom = gm.getRoom(roomId);

    // Re-send roles (same word, same roles)
    for (const player of updatedRoom.players) {
      if (!player.connected || updatedRoom.eliminatedPlayers.includes(player.id)) continue;
      const roleInfo = gm.getPlayerRole(updatedRoom, player.id);
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

    // Clear any last chance timer
    if (lastChanceTimers.has(roomId)) {
      clearTimeout(lastChanceTimers.get(roomId));
      lastChanceTimers.delete(roomId);
    }

    gm.newGame(roomId);
    const updatedRoom = gm.getRoom(roomId);
    io.to(roomId).emit('back-to-lobby');
    broadcastRoomState(updatedRoom);
  });

  // ── Emoji Reactions ──
  socket.on('send-reaction', ({ roomId, emoji }) => {
    const allowedEmojis = ['🤨', '😂', '🔥', '🤐'];
    if (!allowedEmojis.includes(emoji)) return;

    // Check cooldown (2 seconds)
    const now = Date.now();
    const lastTime = reactionCooldowns.get(socket.id) || 0;
    if (now - lastTime < 2000) {
      socket.emit('error-msg', { message: 'Attends 2 secondes entre chaque réaction !' });
      return;
    }
    reactionCooldowns.set(socket.id, now);

    const room = gm.getRoom(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Broadcast reaction to all players in the room
    io.to(roomId).emit('player-reaction', {
      playerId: socket.id,
      playerName: player.name,
      emoji,
    });
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    reactionCooldowns.delete(socket.id);

    const results = gm.handleDisconnect(socket.id);

    for (const result of results) {
      if (result.deleted) continue;
      const room = result.room;

      if (result.impostorLeft) {
        // Clear any last chance timer
        if (lastChanceTimers.has(room.id)) {
          clearTimeout(lastChanceTimers.get(room.id));
          lastChanceTimers.delete(room.id);
        }

        io.to(room.id).emit('vote-result', {
          tie: false,
          eliminatedPlayer: { id: room.impostorIds[0], name: result.playerName },
          wasImpostor: true,
          wasInfiltre: false,
          gameOver: true,
          winner: 'civils',
          secretWord: room.secretWordA,
          secretWordB: room.secretWordB,
          impostorName: result.playerName,
          voteTally: {},
          disconnected: true,
        });
      } else if (result.tooFewPlayers) {
        const impostorObj = room.players.find(p => room.impostorIds.includes(p.id));
        const infiltreObj = room.players.find(p => room.undercoverIds.includes(p.id));
        const winnerName = impostorObj?.name || infiltreObj?.name;
        const winner = room.impostorIds.length > 0 ? 'imposteur' : 'infiltre';
        
        io.to(room.id).emit('vote-result', {
          tie: false,
          eliminatedPlayer: null,
          wasImpostor: false,
          wasInfiltre: false,
          gameOver: true,
          winner,
          secretWord: room.secretWordA,
          secretWordB: room.secretWordB,
          impostorName: winnerName,
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

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`🕵️ L'Imposteur server running on port ${PORT}`);
});
