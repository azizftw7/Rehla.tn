# REHLA.TN

Application web pour préparer un déplacement en Tunisie : carte interactive des hébergements, restaurants, activités, événements, transports et guides locaux, favoris, avis et partage de déplacement pour trouver des co-voyageurs. Pas de réservation ni de paiement.

- `client/` : front-end React + Vite
- `server/` : API REST Node.js + Express + MongoDB (Mongoose)
- `doc/` : documents du projet (cas d'utilisation, diagrammes de classes)

## Back-end (`server/`)

### Prérequis

- Node.js 22 ou plus récent (`node -v`)
- Une base MongoDB : en local (MongoDB Community Server) **ou** sur MongoDB Atlas (offre gratuite)

### 1. Installer

```powershell
cd server
npm install
```

### 2. Configurer `.env`

```powershell
Copy-Item .env.example .env
```

Puis compléter `server/.env` :

| Variable             | Rôle                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `PORT`               | Port de l'API (5000 par défaut, le front appelle `http://localhost:5000/api`)              |
| `MONGODB_URI`        | Chaîne de connexion MongoDB (voir ci-dessous)                                              |
| `JWT_SECRET`         | Longue chaîne aléatoire qui signe les tokens                                               |
| `JWT_EXPIRES_IN`     | Durée de validité d'un token (ex. `7d`)                                                    |
| `CLIENT_URL`         | URL du front autorisée par CORS (`http://localhost:5173` avec Vite)                        |
| `SEED_DEMO_PASSWORD` | Mot de passe des comptes de démo créés par le seed (8 caractères minimum, développement)  |

Générer un `JWT_SECRET` :

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Le fichier `.env` n'est jamais commité (il est dans `.gitignore`).

### 3. MongoDB : local ou Atlas

**En local** : installer MongoDB Community Server (le service Windows « MongoDB » démarre automatiquement), puis :

```
MONGODB_URI=mongodb://127.0.0.1:27017/rehla
```

**Sur Atlas** :

1. Créer un cluster gratuit sur https://cloud.mongodb.com.
2. _Database Access_ : créer un utilisateur de base de données avec un mot de passe.
3. _Network Access_ : ajouter votre adresse IP (bouton « Add current IP address »). Sans cette étape la connexion échoue avec un délai dépassé. Pour la CI ou une IP qui change, `0.0.0.0/0` fonctionne mais ouvre l'accès à tous : à réserver au développement.
4. _Connect > Drivers_ : copier la chaîne `mongodb+srv://…`, remplacer `<password>` et ajouter le nom de la base avant le `?` :

```
MONGODB_URI=mongodb+srv://utilisateur:motdepasse@cluster0.xxxxx.mongodb.net/rehla?retryWrites=true&w=majority
```

Si le mot de passe contient des caractères spéciaux (`@`, `:`, `/`…), les encoder (ex. `@` → `%40`).

### 4. Remplir la base de démo

```powershell
npm run seed
```

⚠️ Le seed **vide toutes les collections** de la base indiquée puis crée : 3 destinations (Djerba, Tozeur, Sidi Bou Saïd), 15 services (tous types), des offres, des avis, des transports et les comptes ci-dessous. Il refuse de s'exécuter si `NODE_ENV=production`.

Comptes de démo (**développement uniquement**) — le mot de passe de chacun est la valeur de `SEED_DEMO_PASSWORD` de votre `.env` :

| Rôle        | E-mail                       |
| ----------- | ---------------------------- |
| admin       | `admin@demo.rehla.tn`        |
| prestataire | `prestataire1@demo.rehla.tn` |
| prestataire | `prestataire2@demo.rehla.tn` |
| voyageur    | `voyageur1@demo.rehla.tn`    |
| voyageur    | `voyageur2@demo.rehla.tn`    |
| voyageur    | `voyageur3@demo.rehla.tn`    |

Les établissements, prestataires et guides du seed sont fictifs ; les horaires et tarifs de transport sont indicatifs.

### 5. Démarrer

```powershell
npm run dev     # redémarre à chaque modification (node --watch)
npm start       # sans rechargement
```

Vérifier : http://localhost:5000/api/health doit répondre `{"status":"ok","database":"connectée"}`.

### 6. Tester et vérifier le code

```powershell
npm test        # Vitest + Supertest sur une base MongoDB en mémoire (aucune vraie base utilisée)
npm run lint    # ESLint
npm run format  # Prettier
```

Au tout premier `npm test`, mongodb-memory-server télécharge un binaire MongoDB (une seule fois).

### Conventions de l'API

- Préfixe `/api`, JSON partout.
- Erreurs : `{ "message": "...", "details": [{ "field": "...", "message": "..." }] }` avec le code HTTP adapté (400, 401, 403, 404, 409, 500, 503).
- Listes paginées : `?page=1&limit=20` → `{ items, total, page, pages }`.
- Coordonnées en GeoJSON `[longitude, latitude]` (Leaflet attend `[latitude, longitude]` : penser à inverser côté front).

## Front-end (`client/`)

React 19 + Vite, react-router-dom, icônes lucide-react. Le design (couleurs, espacements, rayons, ombres, thèmes clair et sombre) vient de `client/src/styles/tokens.css`.

```powershell
cd client
npm install
npm run dev      # http://localhost:5173
npm run build    # version de production dans client/dist
npm run lint     # ESLint
npm test         # Vitest + Testing Library
```

Le front appelle l'API sur `http://localhost:5000/api` par défaut. Pour une autre adresse, copier `client/.env.example` en `client/.env` et modifier `VITE_API_URL` (puis relancer `npm run dev`).

## Lancer le back et le front ensemble

Ouvrir **deux terminaux** PowerShell :

```powershell
# Terminal 1 — API (http://localhost:5000/api)
cd server
npm run seed     # la première fois, ou pour remettre les données de démo
npm run dev
```

```powershell
# Terminal 2 — site (http://localhost:5173)
cd client
npm run dev
```

Puis ouvrir http://localhost:5173. Les destinations de la section « Où partir cet automne ? » viennent de l'API : si elle n'est pas démarrée, la page affiche un message d'erreur avec un bouton « Réessayer ».

`CLIENT_URL` dans `server/.env` doit valoir `http://localhost:5173` (valeur par défaut), sinon le navigateur bloque les appels (CORS).

## Intégration continue

À chaque pull request, GitHub Actions lance `npm ci`, `npm run lint` et `npm test` dans `server/`, puis `npm ci`, `npm run lint`, `npm test` et `npm run build` dans `client/`.
