// Banque de mots secrets en français
const words = [
  // Animaux
  'Chat', 'Chien', 'Éléphant', 'Papillon', 'Dauphin', 'Perroquet', 'Tortue', 'Pingouin',
  'Caméléon', 'Hibou', 'Requin', 'Flamant', 'Koala', 'Panda', 'Aigle',
  // Nourriture
  'Pizza', 'Croissant', 'Sushi', 'Chocolat', 'Fromage', 'Crêpe', 'Hamburger',
  'Glace', 'Baguette', 'Macaron', 'Tiramisu', 'Raclette',
  // Objets
  'Parapluie', 'Guitare', 'Télescope', 'Boussole', 'Skateboard', 'Horloge',
  'Bougie', 'Miroir', 'Jumelles', 'Saxophone', 'Microscope', 'Hamac',
  // Lieux
  'Pyramide', 'Volcan', 'Phare', 'Igloo', 'Château', 'Laboratoire',
  'Aquarium', 'Bibliothèque', 'Cathédrale', 'Grotte', 'Stade', 'Casino',
  // Métiers
  'Astronaute', 'Détective', 'Boulanger', 'Magicien', 'Pompier', 'Plombier',
  'Archéologue', 'Chirurgien', 'Photographe', 'Pilote',
  // Nature
  'Tornado', 'Aurore boréale', 'Arc-en-ciel', 'Oasis', 'Cascade', 'Geyser',
  'Iceberg', 'Corail', 'Météorite', 'Stalactite',
  // Transport
  'Sous-marin', 'Montgolfière', 'Hélicoptère', 'Téléphérique', 'Trottinette',
  'Catamaran', 'Fusée', 'Locomotive',
  // Divertissement
  'Karaoké', 'Cirque', 'Bowling', 'Escape game', 'Feu d\'artifice',
  'Concert', 'Trampoline', 'Laser game',
];

export function getRandomWord(excludeWords = []) {
  const available = words.filter(w => !excludeWords.includes(w));
  if (available.length === 0) return words[Math.floor(Math.random() * words.length)];
  return available[Math.floor(Math.random() * available.length)];
}

export default words;
