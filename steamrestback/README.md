# API Steam (backend)

## Lancer le serveur

L'application comporte deux serveurs à lancer dans deux terminaux.

Dans le premier terminal, depuis `steamrestback` :

```bash
npm install
npm run dev
```

Dans le second terminal, depuis `steamrestfront` :

```bash
npm install
npm run dev
```

Le front est servi par Vite (généralement `http://localhost:5173`) et l'API écoute sur `http://localhost:8080`. L'API utilise SQLite via `apidatabase.db`.

## Endpoints disponibles

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/jeux` | Liste tous les jeux |
| GET | `/jeux/:id` | Détail d'un jeu |
| POST | `/jeux` | Ajoute un jeu au catalogue (JWT administrateur requis) |
| GET | `/utilisateurs` | Liste les profils (JWT requis) |
| GET | `/utilisateurs/:id` | Détail du compte connecté (JWT requis, propriétaire seulement) |
| POST | `/utilisateurs` | Crée un compte (inscription) |
| POST | `/sessions` | Vérifie les identifiants et renvoie un JWT |
| GET | `/utilisateurs/:idUser/bibliothequejeux` | Liste la bibliothèque du compte connecté (JWT requis) |
| DELETE | `/utilisateurs/:idUser/bibliothequejeux/:jeuId` | Retire un jeu de sa bibliothèque (JWT requis) |
| PUT | `/utilisateurs/:idUser/bibliothequejeux/:jeuId` | Change son état d'installation (JWT requis) |
| POST | `/achats` | Enregistre l'achat du compte connecté (JWT requis) |

Pour l'installation, envoyer par exemple `{"estInstalle": true}` au PUT (ou `false` pour désinstaller). Pour un achat, le corps attendu est `{"JeuID": 1, "UtilisateurID": 2}`. Les identifiants en minuscules employés par l'interface (`jeuId`, `utilisateurId`) sont aussi acceptés.

Pour créer un compte, envoyer `{"nomUtilisateur":"alice","email":"alice@example.com","motDePasse":"unMotDePasseLong"}` à `POST /utilisateurs`. Le mot de passe doit faire au moins huit caractères. Pour se connecter, envoyer `{"identifiant":"alice","motDePasse":"unMotDePasseLong"}` à `POST /sessions` ; l'identifiant peut être le nom d'utilisateur ou l'email. Le mot de passe est stocké sous forme de dérivé scrypt salé, jamais en clair. Les routes de connexion ne peuvent pas authentifier les anciens comptes de démonstration tant qu'ils n'ont pas de mot de passe enregistré.

La réponse de connexion contient un JWT valable une heure. Pour appeler une route protégée, envoyer l'en-tête `Authorization: Bearer <token>`. Les utilisateurs ne peuvent agir que sur leur propre identifiant. Le catalogue (`GET /jeux` et `GET /jeux/:id`), l'inscription et la connexion restent publics. L'interface fournit ces formulaires sous le lien **CONNEXION / INSCRIPTION** et conserve le jeton dans la session de l'onglet.

Pour garder les jetons valides après un redémarrage du backend, définir une clé stable `JWT_SECRET` avant de lancer le serveur. En PowerShell : `$env:JWT_SECRET = 'une-cle-aleatoire-longue-et-secrete'; npm run dev`. Sans variable, le backend crée une clé temporaire à chaque démarrage.

## Rôles

Chaque compte possède un rôle `utilisateur` ou `administrateur`. L'inscription attribue toujours le rôle `utilisateur`. Seul un administrateur peut appeler `POST /jeux` pour ajouter un titre au catalogue global. Le formulaire d'ajout apparaît dans le magasin après connexion avec un compte administrateur ; l'API contrôle aussi le rôle, donc masquer le formulaire ne constitue pas la protection.

Pour promouvoir un compte existant, exécuter dans un outil SQLite sur `apidatabase.db` :

```sql
UPDATE Utilisateurs SET Role = 'administrateur' WHERE Email = 'admin@example.com';
```

Remplacer l'email par celui du compte à promouvoir, puis se déconnecter et se reconnecter pour recevoir un JWT contenant le nouveau rôle. Les comptes déjà présents dans la base reçoivent automatiquement le rôle `utilisateur` lors de la migration.

La création d'achat et l'ajout à la bibliothèque sont exécutés dans une transaction : les deux opérations réussissent ensemble ou sont annulées ensemble. Les routes renvoient notamment `400` pour un corps invalide, `404` si la ressource est absente et `409` si le jeu est déjà dans la bibliothèque.

## Exemples d'endpoints utiles à ajouter

- `POST /utilisateurs` : créer un compte. Cela permettrait de gérer l'inscription depuis l'application sans modifier la base manuellement.
- `GET /jeux?recherche=zelda` : chercher et filtrer le catalogue, pour retrouver un titre plus facilement à mesure que la liste grandit.
- `GET /utilisateurs/:id/achats` : consulter l'historique d'achat avec les dates, utile pour le suivi et le support.
- `GET /sante` : vérifier que le serveur et la base répondent, utile au démarrage et au diagnostic.

## Pistes d'amélioration de l'architecture

Le projet peut être séparé en routes (déclaration HTTP), contrôleurs (lecture des paramètres et réponses), services (règles métier comme l'achat) et accès aux données (requêtes SQLite). Cette séparation évite que `index.js` concentre toutes les responsabilités et facilite la recherche d'un comportement.

Il serait utile de centraliser la validation des paramètres et la gestion des erreurs, puis d'utiliser des réponses cohérentes (`400`, `404`, `409`, `500`). Les requêtes préparées déjà utilisées protègent les valeurs SQL. Les règles de données peuvent être renforcées avec des clés étrangères activées, contraintes explicites et migrations versionnées au lieu de recréer le schéma par script.

Enfin, documenter le contrat avec OpenAPI, configurer l'URL autorisée et le port par variables d'environnement, puis ajouter des tests automatisés pour les cas nominaux et les erreurs rendraient le projet plus facile à reprendre et à faire évoluer.
