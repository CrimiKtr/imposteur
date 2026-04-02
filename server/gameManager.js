import { getRandomWordPair } from './words.js';

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

/**
 * Normalize string for comparison: lowercase, remove accents
 */
function normalizeString(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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
      phase: 'lobby', // lobby | playing | voting | last-chance | result
      secretWordA: null,      // Word for Civils
      secretWordB: null,      // Word for Infiltrés (close word)
      // Legacy compat
      secretWord: null,
      impostorIds: [],         // Array of impostor socket IDs (0 or 1)
      undercoverIds: [],       // Array of undercover/infiltré socket IDs
      playerOrder: [],
      currentTurnIndex: 0,
      descriptions: [],
      votes: new Map(),
      eliminatedPlayers: [],
      round: 0,
      usedWords: [],
      // Settings (chosen by host)
      settings: {
        impostorCount: 1,
        undercoverCount: 0,
      },
      // Last Chance tracking
      lastChance: null, // { playerId, timerEnd } or null
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

  startGame(roomId, requesterId, settings = {}) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Salon introuvable.' };
    if (room.hostId !== requesterId) return { success: false, error: 'Seul l\'hôte peut lancer la partie.' };

    const activePlayers = room.players.filter(p => p.connected && !room.eliminatedPlayers.includes(p.id));

    // Apply settings
    const impostorCount = Math.min(settings.impostorCount ?? 1, 1); // max 1
    const undercoverCount = Math.max(settings.undercoverCount ?? 0, 0);

    // Validate: total special roles < active players
    const totalSpecial = impostorCount + undercoverCount;
    if (totalSpecial >= activePlayers.length) {
      return { success: false, error: 'Trop de rôles spéciaux pour le nombre de joueurs.' };
    }

    // Need at least 3 players
    if (activePlayers.length < 3) return { success: false, error: 'Il faut au minimum 3 joueurs.' };

    // Need at least 1 special role
    if (impostorCount === 0 && undercoverCount === 0) {
      return { success: false, error: 'Il faut au moins 1 Imposteur ou 1 Infiltré.' };
    }

    room.settings = { impostorCount, undercoverCount };

    // Pick word pair
    const pair = getRandomWordPair(room.usedWords);
    room.usedWords.push(pair.wordA);
    room.secretWordA = pair.wordA;
    room.secretWordB = pair.wordB;
    room.secretWord = pair.wordA; // legacy compat

    // Shuffle players and assign roles
    const shuffled = shuffleArray(activePlayers.map(p => p.id));

    // Assign impostors
    room.impostorIds = shuffled.slice(0, impostorCount);

    // Assign infiltrés
    room.undercoverIds = shuffled.slice(impostorCount, impostorCount + undercoverCount);

    // Legacy compat: single impostor ID
    room.impostorId = room.impostorIds.length > 0 ? room.impostorIds[0] : null;

    // Randomize play order
    room.playerOrder = shuffleArray(activePlayers.map(p => p.id));
    room.currentTurnIndex = 0;
    room.descriptions = [];
    room.votes = new Map();
    room.phase = 'playing';
    room.round++;
    room.lastChance = null;

    return { success: true };
  }

  getPlayerRole(room, playerId) {
    if (room.impostorIds.includes(playerId)) {
      return { role: 'imposteur', secretWord: null };
    }
    if (room.undercoverIds.includes(playerId)) {
      // Infiltré gets wordB but doesn't know they're infiltré
      return { role: 'infiltre', secretWord: room.secretWordB };
    }
    // Civil gets wordA
    return { role: 'civil', secretWord: room.secretWordA };
  }

  newGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    room.phase = 'lobby';
    room.secretWordA = null;
    room.secretWordB = null;
    room.secretWord = null;
    room.impostorIds = [];
    room.undercoverIds = [];
    room.impostorId = null;
    room.playerOrder = [];
    room.currentTurnIndex = 0;
    room.descriptions = [];
    room.votes = new Map();
    room.eliminatedPlayers = [];
    room.round = 0;
    room.usedWords = [];
    room.lastChance = null;

    // Reset all players
    room.players = room.players.filter(p => p.connected);
    return { success: true };
  }

  submitDescription(roomId, playerId, word) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'playing') return { success: false, error: 'Phase incorrecte.' };

    const currentPlayerId = room.playerOrder[room.currentTurnIndex];
    if (currentPlayerId !== playerId) return { success: false, error: 'Ce n\'est pas votre tour.' };

    // Check word is not the secret word (case insensitive) — check both words
    const normalizedWord = normalizeString(word);
    if (normalizedWord === normalizeString(room.secretWordA) || normalizedWord === normalizeString(room.secretWordB)) {
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
        wasInfiltre: false,
        gameOver: false,
        winner: null,
        voteTally: Object.fromEntries(tally),
      };
    }

    // Eliminate the player
    room.eliminatedPlayers.push(eliminated);
    const eliminatedObj = room.players.find(p => p.id === eliminated);
    const wasImpostor = room.impostorIds.includes(eliminated);
    const wasInfiltre = room.undercoverIds.includes(eliminated);

    // If an impostor was eliminated, trigger Last Chance phase
    if (wasImpostor) {
      room.phase = 'last-chance';
      room.lastChance = {
        playerId: eliminated,
        playerName: eliminatedObj?.name,
        timerEnd: Date.now() + 20000, // 20 seconds
      };
      return {
        success: true,
        allVoted: true,
        tie: false,
        eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
        wasImpostor: true,
        wasInfiltre: false,
        gameOver: false, // not yet — waiting for last chance
        winner: null,
        triggerLastChance: true,
        voteTally: Object.fromEntries(tally),
      };
    }

    room.phase = 'result';

    // Check if impostor wins (2 or fewer players remaining, or no more civils/infiltrés to vote)
    const remainingPlayers = room.playerOrder.filter(id => !room.eliminatedPlayers.includes(id));

    // If no impostors in game (0 impostor mode), check if the infiltré was eliminated
    if (room.impostorIds.length === 0) {
      // Infiltré vs Civils mode
      const remainingInfiltres = room.undercoverIds.filter(id => !room.eliminatedPlayers.includes(id));

      if (remainingInfiltres.length === 0) {
        // All infiltrés eliminated — civils win
        return {
          success: true,
          allVoted: true,
          tie: false,
          eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
          wasImpostor: false,
          wasInfiltre: true,
          gameOver: true,
          winner: 'civils',
          secretWord: room.secretWordA,
          secretWordB: room.secretWordB,
          impostorName: eliminatedObj?.name,
          voteTally: Object.fromEntries(tally),
        };
      }

      if (remainingPlayers.length <= 2) {
        // Too few players — infiltrés win
        const infiltreObj = room.players.find(p => room.undercoverIds.includes(p.id));
        return {
          success: true,
          allVoted: true,
          tie: false,
          eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
          wasImpostor: false,
          wasInfiltre: false,
          gameOver: true,
          winner: 'infiltre',
          secretWord: room.secretWordA,
          secretWordB: room.secretWordB,
          impostorName: infiltreObj?.name,
          voteTally: Object.fromEntries(tally),
        };
      }

      // Game continues
      return {
        success: true,
        allVoted: true,
        tie: false,
        eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
        wasImpostor: false,
        wasInfiltre: false,
        gameOver: false,
        winner: null,
        voteTally: Object.fromEntries(tally),
      };
    }

    // Normal mode with impostor
    if (remainingPlayers.length <= 2) {
      const impostorObj = room.players.find(p => room.impostorIds.includes(p.id));
      return {
        success: true,
        allVoted: true,
        tie: false,
        eliminatedPlayer: { id: eliminated, name: eliminatedObj?.name },
        wasImpostor: false,
        wasInfiltre,
        gameOver: true,
        winner: 'imposteur',
        secretWord: room.secretWordA,
        secretWordB: room.secretWordB,
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
      wasInfiltre,
      gameOver: false,
      winner: null,
      voteTally: Object.fromEntries(tally),
    };
  }

  /**
   * Check the impostor's last chance guess
   * @returns {{ success: boolean, correct: boolean }}
   */
  checkLastChanceGuess(roomId, playerId, guess) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'last-chance') return { success: false, error: 'Phase incorrecte.' };
    if (!room.lastChance || room.lastChance.playerId !== playerId) {
      return { success: false, error: 'Ce n\'est pas votre dernière chance.' };
    }

    const normalizedGuess = normalizeString(guess);
    const normalizedWordA = normalizeString(room.secretWordA);

    const correct = normalizedGuess === normalizedWordA;

    room.phase = 'result';

    if (correct) {
      // Impostor guessed correctly — impostor wins!
      return {
        success: true,
        correct: true,
        winner: 'imposteur',
        secretWord: room.secretWordA,
        secretWordB: room.secretWordB,
        impostorName: room.lastChance.playerName,
      };
    }

    // Impostor failed — civils win
    return {
      success: true,
      correct: false,
      winner: 'civils',
      secretWord: room.secretWordA,
      secretWordB: room.secretWordB,
      impostorName: room.lastChance.playerName,
    };
  }

  /**
   * Handle last chance timeout (impostor didn't guess in time)
   */
  lastChanceTimeout(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'last-chance') return null;

    room.phase = 'result';
    return {
      correct: false,
      winner: 'civils',
      secretWord: room.secretWordA,
      secretWordB: room.secretWordB,
      impostorName: room.lastChance?.playerName,
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
    room.lastChance = null;

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
        const isImpostor = room.impostorIds.includes(socketId);
        if (isImpostor) {
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
