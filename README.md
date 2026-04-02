# 🕵️ L'Imposteur — Jeu Multijoueur en Ligne

Un jeu de société multijoueur en temps réel où les civils tentent de démasquer l'imposteur qui ne connaît pas le mot secret.

## 🚀 Déploiement sur Render (Gratuit)

### Méthode 1 : One-click Deploy (Recommandé)

1. **Pousse le code sur GitHub** :
   ```bash
   cd imposteur
   git init
   git add .
   git commit -m "Initial commit - L'Imposteur"
   git remote add origin https://github.com/TON-USER/imposteur.git
   git push -u origin main
   ```

2. **Rends-toi sur [Render](https://render.com)** et connecte-toi avec GitHub.

3. **Crée un nouveau "Web Service"** :
   - Connecte ton repo GitHub
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `node server/index.js`
   - **Environment** : Node
   - **Plan** : Free

4. **Attends le déploiement** (2-3 min) → tu obtiens ton lien `https://imposteur-xxxx.onrender.com` 🎉

### Méthode 2 : Via render.yaml (Blueprint)

1. Pousse le code sur GitHub
2. Sur Render, va dans **Blueprints** → **New Blueprint Instance**
3. Sélectionne ton repo → Render détecte automatiquement le `render.yaml`
4. Clique **Apply** → Déploiement automatique !

## 🎮 Développement Local

```bash
# Installe les dépendances
npm install

# Terminal 1 : Serveur backend
npm run server

# Terminal 2 : Client frontend (dev mode avec HMR)
npm run dev
```

- Frontend : http://localhost:5173
- Backend : http://localhost:3001

## 📋 Règles du Jeu

1. **Créer/Rejoindre** : Un joueur crée une partie et partage le lien
2. **Minimum 3 joueurs** pour lancer
3. **Distribution** : Les civils reçoivent le mot secret, l'imposteur voit "Tu es l'Imposteur"
4. **Description** : Tour par tour, chaque joueur donne un indice en un mot
5. **Vote** : Tout le monde vote pour éliminer le suspect
6. **Victoire** :
   - 🟢 **Civils gagnent** si l'imposteur est éliminé
   - 🔴 **Imposteur gagne** s'il survit jusqu'à ce qu'il ne reste que 2 joueurs

## 🏗️ Stack Technique

| Composant | Technologie |
|-----------|------------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Temps réel | Socket.IO |
| Style | Vanilla CSS (dark theme) |
| Déploiement | Render (free tier) |
