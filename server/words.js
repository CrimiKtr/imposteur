// Banque de couples de mots proches (Mot A / Mot B)
// Civils reçoivent Mot A, Infiltrés reçoivent Mot B
const wordPairs = [
  // ── Cuisine & Malbouffe ──
  ['Kebab', 'Tacos'],
  ['Frite', 'Chips'],
  ['Ketchup', 'Mayonnaise'],
  ['Pizza', 'Calzone'],
  ['Croissant', 'Pain au chocolat'],
  ['Sushi', 'Maki'],
  ['Burger', 'Hot-dog'],
  ['Crêpe', 'Gaufre'],
  ['Coca', 'Pepsi'],
  ['Nutella', 'Confiture'],
  ['Raclette', 'Fondue'],
  ['Glace', 'Sorbet'],

  // ── Culture Web & Tech ──
  ['TikTok', 'Instagram'],
  ['ChatGPT', 'Google'],
  ['iPhone', 'Android'],
  ['Netflix', 'Disney+'],
  ['YouTube', 'Twitch'],
  ['Twitter', 'Threads'],
  ['WhatsApp', 'Telegram'],
  ['Spotify', 'Deezer'],
  ['WiFi', 'Bluetooth'],
  ['PlayStation', 'Xbox'],
  ['Fortnite', 'Minecraft'],

  // ── Animaux Relous ──
  ['Pigeon', 'Mouette'],
  ['Rat', 'Hamster'],
  ['Moustique', 'Mouche'],
  ['Cafard', 'Araignée'],
  ['Chat', 'Chien'],
  ['Serpent', 'Lézard'],
  ['Guêpe', 'Abeille'],
  ['Requin', 'Dauphin'],
  ['Corbeau', 'Pie'],
  ['Poule', 'Canard'],

  // ── Vie Quotidienne ──
  ['Douche', 'Bain'],
  ['Travail', 'École'],
  ['RER', 'Métro'],
  ['Réveil', 'Alarme'],
  ['Canapé', 'Lit'],
  ['Escalier', 'Ascenseur'],
  ['Vélo', 'Trottinette'],
  ['Lunettes', 'Lentilles'],
  ['Sac à dos', 'Valise'],
  ['Parapluie', 'Capuche'],
  ['Chaussette', 'Chaussure'],
  ['Dentifrice', 'Savon'],

  // ── Soirée & Fête ──
  ['Bière', 'Vin'],
  ['Danse', 'Chant'],
  ['Mariage', 'Enterrement'],
  ['Karaoké', 'Bowling'],
  ['DJ', 'Guitariste'],
  ['Boîte de nuit', 'Bar'],
  ['Mojito', 'Margarita'],
  ['Pétard', 'Feu d\'artifice'],
  ['Selfie', 'Photo de groupe'],
  ['Samedi soir', 'Dimanche matin'],
];

/**
 * Get a random word pair, optionally excluding already-used pairs.
 * @param {string[]} excludeWordsA - List of wordA values already used.
 * @returns {{ wordA: string, wordB: string }}
 */
export function getRandomWordPair(excludeWordsA = []) {
  const available = wordPairs.filter(([a]) => !excludeWordsA.includes(a));
  const pool = available.length > 0 ? available : wordPairs;
  const pair = pool[Math.floor(Math.random() * pool.length)];
  return { wordA: pair[0], wordB: pair[1] };
}

/**
 * Legacy helper — returns a single random word (wordA from a pair).
 * @param {string[]} excludeWords
 * @returns {string}
 */
export function getRandomWord(excludeWords = []) {
  const { wordA } = getRandomWordPair(excludeWords);
  return wordA;
}

export default wordPairs;
