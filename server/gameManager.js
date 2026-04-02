import { getRandomWord } from './words.js';

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class GameManager {
  constructor() {
    /** @type {Map<string, object>} */
    this.rooms = new Map();
  }

  createRoom(hostSocketId, hostName, avatar) {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (this.rooms.has(roomId));

    const room = {
      id: roomId,
      hostId: hostSocketId,
      players: [
        { id: hostSocketId, name: hostName, avatar: avatar || '🐱', isHost: true, connected: true },
      ],
      phase: 'lobby', // lobby | playing | voting | result
      secretWord: null,
      impostorId: null,
      playerOrder: [],
      currentTurnIndex: 0,
      descriptions: [],
      votes: new Map(),
      eliminatedPlayers: [],
      round: 0,
      usedWords: [],
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  joinRoom(roomId, socketId, playerName, avatar) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Salon introuvable.' };
    if (room.phase !== 'lobby') return { success: false, error: 'La partie a déjà commencé.' };
    if (room.players.find(p => p.id === socketId)) return { success: false, error: 'Déjà dans le salon.' };
    if (room.players.length >= 12) return { success: false, error: 'Le salon est plein (12 joueurs max).' };

    // Ensure unique name
    let finalName = playerName;
    const names = room.players.map(p => p.name);
    let counter = 2;
    while (names.includes(finalName)) {
      finalName = `${playerName}${counter}`;
      counter++;
    }

    room.players.push({ id: socketId, name: finalName, avatar: avatar || '🐱', isHost: false, connected: true });
    return { success: true, playerName: finalName };
  }

  startGame(roomId, requesterId) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Salon introuvable.' };
    if (room.hostId !== requesterId) return { success: false, error: 'Seul l\'hôte peut lancer la partie.' };

    const activePlayers = room.players.filter(p => p.connected && !room.eliminatedPlayers.includes(p.id));
    if (activePlayers.length < 3) return { success: false, error: 'Il faut au minimum 3 joueurs.' };

    // Pick word and impostor
    const word = getRandomWord(room.usedWords);
    room.usedWords.push(word);
    room.secretWord = word;

    const impostorIndex = Math.floor(Math.random() * activePlayers.length);
    room.impostorId = activePlayers[impostorIndex].id;

    // Randomize play order
    room.playerOrder = shuffleArray(activePlayers.map(p => p.id));
    room.currentTurnIndex = 0;
    room.descriptions = [];
    room.votes = new Map();
    room.phase = 'playing';
    room.round++;

    return { success: true };
  }

  newGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    room.phase = 'lobby';
    room.secretWord = null;
    room.impostorId = null;
    room.playerOrder = [];
    room.currentTurnIndex = 0;
    room.descriptions = [];
    room.votes = new Map();
    room.eliminatedPlayers = [];
    room.round = 0;
    room.usedWords = [];

    // Reset all players
    room.players = room.players.filter(p => p.connected);
    return { success: true };
  }

  submitDescription(roomId, playerId, word) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'playing') return { success: false, error: 'Phase incorrecte.' };

    const currentPlayerId = room.playerOrder[room.currentTurnIndex];
    if (currentPlayerId !== playerId) return { success: false, error: 'Ce n\'est pas votre tour.' };

    // Check word is not the secret word (case insensitive)
    if (word.toLowerCase().trim() === room.secretWord.toLowerCase().trim()) {
      return { success: false, error: 'Vous ne pouvez pas utiliser le mot secret !' };
    }

    const playerObj = room.players.find(p => p.id === playerId);
    room.descriptions.push({
      playerId,
      playerName: playerObj ? playerObj.name : 'Inconnu',
      playerAvatar: playerObj?.avatar || '🐱',
      word: word.trim(),
    });

    room.currentTurnIndex++;

    // Check if all players have described
    if (room.currentTurnIndex >= room.playerOrder.length) {
      room.phase = 'voting';
      return { success: true, allDone: true };
    }

    return { success: true, allDone: false };
  }

  submitVote(roomId, voterId, votedId) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'voting') return { success: false, error: 'Phase incorrecte.' };
    if (voterId === votedId) return { success: false, error: 'Vous ne pouvez pas voter pour vous-même.' };
    if (room.eliminatedPlayers.includes(voterId)) return { success: false, error: 'Vous êtes éliminé.' };

    room.votes.set(voterId, votedId);

    // Active voters count
    const activePlayerIds = room.playerOrder;
    const allVoted = activePlayerIds.every(id => room.votes.has(id));

    if (!allVoted) {
      return { success: true, allVoted: false, voteCount: room.votes.size, total: activePlayerIds.length };
    }

    // Tally votes
    const tally = new Map();
    for (const vid of room.votes.values()) {
      tally.set(vid, (tally.get(vid) || 0) + 1);
    }

    // Find max votes
    let maxVotes = 0;
    let eliminated = null;
    let tie = false;

    for (const [pid, count] of tally) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = pid;
        tie = false;
      } else if (count === maxVotes) {
        tie = true;
      }
    }

    // If tie, no one is eliminated — go back to description
    if (tie) {
      room.phase = 'result';
      return {
        success: true,
        allVoted: true,
        tie: true,
        eliminatedPlayer: null,
        wasImpostor: false,
        gameOver: false,
        winner: null,
        voteTally: Object.fromEntries(tally),
      };
    }

    // Eliminate the player
    room.eliminatedPlayers.push(eliminated);
    const eliminatedObj = room.players.find(p => p.id === eliminated);
    const wasImpostor = eliminated === room.impostorId;

    room.phase = 'result';

    if (wasImpostor) {
      return {
        success: true,
        allVoted: true,
        tie: false,
        eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
        wasImpostor: true,
        gameOver: true,
        winner: 'civils',
        secretWord: room.secretWord,
        impostorName: eliminatedObj?.name,
        voteTally: Object.fromEntries(tally),
      };
    }

    // Check if impostor wins (2 or fewer players remaining)
    const remainingPlayers = room.playerOrder.filter(id => !room.eliminatedPlayers.includes(id));
    if (remainingPlayers.length <= 2) {
      const impostorObj = room.players.find(p => p.id === room.impostorId);
      return {
        success: true,
        allVoted: true,
        tie: false,
        eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
        wasImpostor: false,
        gameOver: true,
        winner: 'imposteur',
        secretWord: room.secretWord,
        impostorName: impostorObj?.name,
        voteTally: Object.fromEntries(tally),
      };
    }

    // Game continues — next round
    return {
      success: true,
      allVoted: true,
      tie: false,
      eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
      wasImpostor: false,
      gameOver: false,
      winner: null,
      voteTally: Object.fromEntries(tally),
    };
  }

  continueGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    const remainingPlayers = room.playerOrder.filter(id => !room.eliminatedPlayers.includes(id));
    room.playerOrder = shuffleArray(remainingPlayers);
    room.currentTurnIndex = 0;
    room.descriptions = [];
    room.votes = new Map();
    room.phase = 'playing';
    room.round++;

    return { success: true };
  }

  handleDisconnect(socketId) {
    const results = [];

    for (const [roomId, room] of this.rooms) {
      const playerIndex = room.players.findIndex(p => p.id === socketId);
      if (playerIndex === -1) continue;

      const player = room.players[playerIndex];
      player.connected = false;

      // In lobby, remove the player entirely
      if (room.phase === 'lobby') {
        room.players.splice(playerIndex, 1);

        // If host left, assign new host
        if (room.hostId === socketId && room.players.length > 0) {
          room.players[0].isHost = true;
          room.hostId = room.players[0].id;
        }

        // If no players left, delete the room
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
          results.push({ roomId, deleted: true });
        } else {
          results.push({ roomId, deleted: false, playerName: player.name, room });
        }
      } else {
        // During game, mark as eliminated
        if (!room.eliminatedPlayers.includes(socketId)) {
          room.eliminatedPlayers.push(socketId);
        }

        // Check critical conditions
        if (socketId === room.impostorId) {
          room.phase = 'result';
          results.push({
            roomId, deleted: false, playerName: player.name, room,
            impostorLeft: true,
          });
        } else {
          const remaining = room.playerOrder.filter(id =>
            !room.eliminatedPlayers.includes(id) && room.players.find(p => p.id === id)?.connected
          );
          if (remaining.length <= 2) {
            room.phase = 'result';
            results.push({
              roomId, deleted: false, playerName: player.name, room,
              tooFewPlayers: true,
            });
          } else {
            results.push({ roomId, deleted: false, playerName: player.name, room });
          }
        }
      }
    }

    return results;
  }

  getRoomForSocket(socketId) {
    for (const [, room] of this.rooms) {
      if (room.players.find(p => p.id === socketId)) {
        return room;
      }
    }
    return null;
  }
}

export default GameManager;
