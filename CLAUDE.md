# Rehla.tn — notes pour Claude

Réponds en français.

## Projet

Application web (projet étudiant en Scrum, 3 sprints) pour préparer un déplacement en Tunisie. Le voyageur choisit une destination et voit sur une carte (Leaflet) les hébergements, restaurants, activités, événements, transports et guides. Favoris, avis, partage volontaire de déplacement (co-voyageurs). Les prestataires publient leurs services ; l'administrateur gère les comptes et modère. **Ni réservation ni paiement.**

- `client/` : front-end React 19 + Vite (voir « Front-end » plus bas).
- `server/` : back-end Node.js + Express 5 + MongoDB (Mongoose).
- `doc/` : diagrammes de cas d'utilisation et de classes par sprint (à lire avant chaque story).

## Méthode de travail

- Une story à la fois, dans l'ordre du backlog. Une branche par story (`tech-1-fondations`, `us1-1-inscription-voyageur`…), créée **depuis la branche précédente** tant qu'elle n'est pas fusionnée. Après chaque fusion sur `main`, rebaser la branche suivante sur `main`.
- Après chaque story : tests + lint, commit, résumé, puis **attendre l'accord** de l'utilisateur avant la suivante.
- **Ne jamais pousser sur GitHub sans demande explicite.** Préparer le titre et la description de PR avec `Closes #N` (TECH-1 n'a pas d'issue : écrire « Réalise TECH-1 », sans `Closes`).
- Chaque PR vise la branche précédente (ou `main` si elle est fusionnée) ; un partenaire relit avant fusion.
- Pas de ligne `Co-Authored-By` dans les commits, ni de mention « Generated with Claude Code » dans les PR.
- À la fin de chaque phase : lister les routes créées avec un exemple de requête pour chacune.

## Commandes (dans `server/`, compatibles PowerShell — aucune commande Unix dans les scripts npm)

- `npm run dev` (node --watch) · `npm start` · `npm run seed` · `npm test` · `npm run lint` · `npm run format`

## Choix techniques

- Node ≥ 22, ES modules, Express 5 (les erreurs async remontent seules au middleware d'erreurs ; `req.query` est en lecture seule → les données validées vont dans `req.validated`).
- Mongoose 9 (hooks `pre` en `async function` sans `next`), dotenv, bcryptjs (pas bcrypt), jsonwebtoken, cors limité à `CLIENT_URL`, helmet, morgan, express-rate-limit sur `/api/auth`.
- Validation : zod 4 (`src/config/zod.js` active la locale fr) avec messages personnalisés en français.
- Tests : Vitest + Supertest + mongodb-memory-server (un serveur pour toute la suite via `tests/globalSetup.js`, une base par fichier via `tests/setup.js`, collections vidées après chaque test). `JWT_SECRET` de test généré aléatoirement dans `vitest.config.js`.
- ESLint flat config + Prettier (single quotes, 100 colonnes, LF).
- Arborescence : `server/src/{app.js, server.js, config/, models/, routes/, controllers/, middlewares/, validators/, utils/}`, `server/seed/`, `server/tests/`. `app.js` n'ouvre pas de port (importé par Supertest), `server.js` connecte MongoDB puis écoute.

## Conventions d'API

- Préfixe `/api`, JSON partout.
- Erreurs : `{ message, details: [{ field, message }] }` via `ApiError` (`src/utils/ApiError.js`) et `errorHandler` (traduit aussi erreurs Mongoose, doublons 11000, JSON mal formé, base indisponible → 503). Pas de stack trace en production.
- Messages simples en français pour l'utilisateur (« Cette adresse e-mail est déjà utilisée. »). Connexion : message générique « E-mail ou mot de passe incorrect. »
- Jamais de mot de passe dans une réponse (`select: false` + `toJSON` qui le retire).
- Listes paginées : `?page=1&limit=20` → `{ items, total, page, pages }` (`src/utils/pagination.js`).
- Coordonnées GeoJSON `Point` `[longitude, latitude]` + index 2dsphere.
- TripShare : ne jamais exposer l'e-mail ni le téléphone (`TRIP_SHARE_PUBLIC_USER_FIELDS`).

## Sécurité

- Aucun mot de passe ni aucune clé dans le dépôt ; `.env` jamais commité, `server/.env.example` à jour.
- Les comptes de démo du seed utilisent `SEED_DEMO_PASSWORD` (lu dans `.env`). Noms d'établissements du seed : fictifs.

## Definition of Done

- Chaque critère d'acceptation couvert par des tests qui passent ; lint propre.
- Erreurs (donnée manquante, service indisponible) → message clair.

## Front-end (`client/`)

- React 19 + Vite, react-router-dom (`BrowserRouter` dans `main.jsx`, routes dans `App.jsx`), icônes lucide-react via le composant `Icon`.
- Commandes (dans `client/`) : `npm run dev` (port 5173) · `npm run build` · `npm run lint` · `npm test` (Vitest + Testing Library, jsdom).
- URL de l'API : `VITE_API_URL` (voir `client/.env.example`, défaut `http://localhost:5000/api`), appels via `src/lib/api.js`.
- Style du code : pas de point-virgule, guillemets simples (comme le gabarit Vite).

### Design (à respecter)

- **Toutes** les couleurs, espacements, rayons et ombres viennent de `src/styles/tokens.css` (`var(--bleu)`, `var(--space-4)`…). Jamais de couleur en dur ; seule exception : `public/favicon.svg` (#0B5CAD). Pour une transparence : `color-mix(in srgb, var(--x) 10%, transparent)`.
- Ne pas modifier `tokens.css` (fourni par l'équipe design). Styles de base dans `src/styles/global.css`.
- Thème : attribut `data-theme` sur `<html>`, hook `useTheme` (choix mémorisé dans `localStorage`, clé `rehla-theme` ; thème du système par défaut) ; le script de `index.html` applique le thème avant l'affichage.
- Polices : Alexandria (titres, `--font-display`) et Readex Pro (texte, `--font-sans`), chargées dans `index.html`.
- Style « Sidi Bou Saïd » : classe utilitaire `.arche` (haut en demi-cercle), coins arrondis, ombres douces, survol des cartes = léger soulèvement + ombre, transitions `var(--duree-base)` (220 ms), `prefers-reduced-motion` respecté.
- Accessibilité : contraste AA, focus visible (`var(--focus-ring)`), textes alternatifs, navigation au clavier.
- Mobile d'abord. Les variables ne marchent pas dans les media queries : écrire 768px (= `--bp-md`) / 1024px (= `--bp-lg`) avec un commentaire.
- Composants réutilisables dans `src/components/` (Button, NavBar, Footer, SearchBar, DestinationCard, Icon, Logo, ArchScene, Layout) ; pages dans `src/pages/`.
