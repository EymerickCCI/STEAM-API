import express from 'express';
import cors from 'cors';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const databasePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'apidatabase.db');
const database = new DatabaseSync(databasePath);
const scrypt = promisify(scryptCallback);
const app = express();
const port = 8080;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
database.exec('PRAGMA foreign_keys = ON');

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const JWT_ISSUER = 'steamrestback';
const JWT_TTL_SECONDS = 60 * 60;
const base64url = (value) => Buffer.from(value).toString('base64url');

function creerJeton(utilisateurId, role) {
    const maintenant = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
        sub: String(utilisateurId), role, iss: JWT_ISSUER,
        iat: maintenant, exp: maintenant + JWT_TTL_SECONDS
    }));
    const contenu = `${header}.${payload}`;
    const signature = createHmac('sha256', JWT_SECRET).update(contenu).digest('base64url');
    return `${contenu}.${signature}`;
}

function authentifier(req, res, next) {
    const entete = req.get('Authorization') || '';
    const correspondance = entete.match(/^Bearer ([\w.-]+)$/);
    if (!correspondance) return res.status(401).json({ error: 'Authentification requise : Bearer token manquant' });
    const parties = correspondance[1].split('.');
    if (parties.length !== 3) return res.status(401).json({ error: 'Token invalide' });
    try {
        const [header, payload, signature] = parties;
        const contenu = `${header}.${payload}`;
        const signatureAttendue = createHmac('sha256', JWT_SECRET).update(contenu).digest();
        const signatureRecue = Buffer.from(signature, 'base64url');
        if (signatureAttendue.length !== signatureRecue.length || !timingSafeEqual(signatureAttendue, signatureRecue)) {
            return res.status(401).json({ error: 'Token invalide' });
        }
        const enteteToken = JSON.parse(Buffer.from(header, 'base64url').toString());
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (enteteToken.alg !== 'HS256' || claims.iss !== JWT_ISSUER ||
            !claims.sub || !['utilisateur', 'administrateur'].includes(claims.role) ||
            !Number.isInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
            return res.status(401).json({ error: 'Token invalide ou expiré' });
        }
        req.auth = { utilisateurId: Number(claims.sub), role: claims.role };
        next();
    } catch {
        res.status(401).json({ error: 'Token invalide' });
    }
}

function autoriserUtilisateur(req, res, next) {
    if (Number(req.params.id ?? req.params.idUser) !== req.auth.utilisateurId) {
        return res.status(403).json({ error: 'Accès interdit : cette ressource appartient à un autre utilisateur' });
    }
    next();
}

function autoriserAdministrateur(req, res, next) {
    if (req.auth.role !== 'administrateur') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    next();
}

const colonnesUtilisateur = database.prepare('PRAGMA table_info(Utilisateurs)').all();
if (!colonnesUtilisateur.some((colonne) => colonne.name === 'MotDePasseHash')) {
    database.exec('ALTER TABLE Utilisateurs ADD COLUMN MotDePasseHash TEXT');
}
if (!colonnesUtilisateur.some((colonne) => colonne.name === 'Role')) {
    database.exec("ALTER TABLE Utilisateurs ADD COLUMN Role TEXT NOT NULL DEFAULT 'utilisateur' CHECK (Role IN ('utilisateur', 'administrateur'))");
}

async function hasherMotDePasse(motDePasse) {
    const sel = randomBytes(16);
    const derive = await scrypt(motDePasse, sel, 64);
    return `${sel.toString('hex')}:${derive.toString('hex')}`;
}

async function verifierMotDePasse(motDePasse, hashStocke) {
    if (!hashStocke) return false;
    const [selHex, deriveHex] = hashStocke.split(':');
    if (!selHex || !deriveHex) return false;
    const deriveAttendu = Buffer.from(deriveHex, 'hex');
    const deriveRecu = await scrypt(motDePasse, Buffer.from(selHex, 'hex'), deriveAttendu.length);
    return deriveAttendu.length === deriveRecu.length && timingSafeEqual(deriveAttendu, deriveRecu);
}

app.get('/jeux', (req, res) => {
    const jeux = database.prepare(`
        SELECT JeuID AS jeuId, Titre AS titre, Developpeur AS developpeur,
               Editeur AS editeur, DateSortie AS dateSortie, Image AS image, Prix AS prix
        FROM Jeux
    `).all();
    res.json(jeux);
});

app.post('/jeux', authentifier, autoriserAdministrateur, (req, res) => {
    const { titre, developpeur, editeur, dateSortie, image, prix } = req.body;
    if ([titre, developpeur, editeur, image].some((valeur) => typeof valeur !== 'string' || !valeur.trim()) ||
        typeof prix !== 'number' || !Number.isFinite(prix) || prix < 0 ||
        (dateSortie !== undefined && dateSortie !== null && dateSortie !== '' && typeof dateSortie !== 'string')) {
        return res.status(400).json({ error: 'titre, developpeur, editeur, image et un prix positif ou nul sont requis' });
    }
    const result = database.prepare(`
        INSERT INTO Jeux (Titre, Developpeur, Editeur, DateSortie, Image, Prix)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(titre.trim(), developpeur.trim(), editeur.trim(), dateSortie || null, image.trim(), prix);
    const jeu = database.prepare(`
        SELECT JeuID AS jeuId, Titre AS titre, Developpeur AS developpeur,
               Editeur AS editeur, DateSortie AS dateSortie, Image AS image, Prix AS prix
        FROM Jeux WHERE JeuID = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(jeu);
});

app.get('/jeux/:id', (req, res) => {
    const jeu = database.prepare(`
        SELECT JeuID AS jeuId, Titre AS titre, Developpeur AS developpeur,
               Editeur AS editeur, DateSortie AS dateSortie, Image AS image, Prix AS prix
        FROM Jeux WHERE JeuID = ?
    `).get(req.params.id);
    if (!jeu) return res.status(404).json({ error: 'Jeu non trouvé' });
    res.json(jeu);
});

app.get('/utilisateurs', authentifier, (req, res) => {
    const utilisateurs = database.prepare(`
        SELECT UtilisateurID AS utilisateurId, NomUtilisateur AS nomUtilisateur,
               DateInscription AS dateInscription FROM Utilisateurs
    `).all();
    res.json(utilisateurs);
});

app.post('/utilisateurs', async (req, res) => {
    const nomUtilisateur = req.body.nomUtilisateur ?? req.body.user ?? req.body.username;
    const email = req.body.email;
    const motDePasse = req.body.motDePasse ?? req.body.password;
    if (typeof nomUtilisateur !== 'string' || !nomUtilisateur.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof motDePasse !== 'string' || motDePasse.length < 8) {
        return res.status(400).json({ error: 'nomUtilisateur, email et motDePasse (8 caractères minimum) sont requis' });
    }

    try {
        const hash = await hasherMotDePasse(motDePasse);
        const creation = database.prepare(`
            INSERT INTO Utilisateurs (NomUtilisateur, Email, MotDePasseHash) VALUES (?, ?, ?)
        `).run(nomUtilisateur.trim(), email.trim().toLowerCase(), hash);
        const utilisateur = database.prepare(`
            SELECT UtilisateurID AS utilisateurId, NomUtilisateur AS nomUtilisateur,
                   Email AS email, DateInscription AS dateInscription, Role AS role
            FROM Utilisateurs WHERE UtilisateurID = ?
        `).get(creation.lastInsertRowid);
        res.status(201).json(utilisateur);
    } catch (error) {
        if (/UNIQUE constraint failed/.test(error.message)) {
            return res.status(409).json({ error: 'Ce nom d’utilisateur ou cet email est déjà utilisé' });
        }
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la création du compte' });
    }
});

app.post('/sessions', async (req, res) => {
    const identifiant = req.body.identifiant ?? req.body.nomUtilisateur ?? req.body.user ?? req.body.username ?? req.body.email;
    const motDePasse = req.body.motDePasse ?? req.body.password;
    if (typeof identifiant !== 'string' || !identifiant.trim() || typeof motDePasse !== 'string' || !motDePasse) {
        return res.status(400).json({ error: 'identifiant et motDePasse sont requis' });
    }
    const utilisateur = database.prepare(`
        SELECT UtilisateurID AS utilisateurId, NomUtilisateur AS nomUtilisateur,
               Email AS email, DateInscription AS dateInscription, Role AS role,
               MotDePasseHash AS motDePasseHash
        FROM Utilisateurs WHERE NomUtilisateur = ? COLLATE NOCASE OR Email = ? COLLATE NOCASE
    `).get(identifiant.trim(), identifiant.trim());
    if (!utilisateur || !(await verifierMotDePasse(motDePasse, utilisateur.motDePasseHash))) {
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }
    delete utilisateur.motDePasseHash;
    res.status(200).json({ message: 'Connexion réussie', token: creerJeton(utilisateur.utilisateurId, utilisateur.role), tokenType: 'Bearer', expiresIn: JWT_TTL_SECONDS, utilisateur });
});

app.get('/utilisateurs/:id', authentifier, autoriserUtilisateur, (req, res) => {
    const utilisateur = database.prepare(`
        SELECT UtilisateurID AS utilisateurId, NomUtilisateur AS nomUtilisateur,
               Email AS email, DateInscription AS dateInscription, Role AS role
        FROM Utilisateurs WHERE UtilisateurID = ?
    `).get(req.params.id);
    if (!utilisateur) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(utilisateur);
});

const SELECT_BIBLIOTHEQUE = `
    SELECT rowid AS bibliothequeId, UtilisateurID AS utilisateurId, JeuID AS jeuId,
           HeuresJeu AS heuresJeu, EstInstalle AS estInstalle
    FROM BibliothequeJeux
`;

const toBibliotheque = (ligne) => ({ ...ligne, estInstalle: Boolean(ligne.estInstalle) });

app.get('/utilisateurs/:idUser/bibliothequejeux', authentifier, autoriserUtilisateur, (req, res) => {
    const utilisateur = database.prepare('SELECT UtilisateurID FROM Utilisateurs WHERE UtilisateurID = ?').get(req.params.idUser);
    if (!utilisateur) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const jeux = database.prepare(`${SELECT_BIBLIOTHEQUE} WHERE UtilisateurID = ?`).all(req.params.idUser);
    res.json(jeux.map(toBibliotheque));
});

app.delete('/utilisateurs/:idUser/bibliothequejeux/:jeuId', authentifier, autoriserUtilisateur, (req, res) => {
    const jeu = database.prepare(`${SELECT_BIBLIOTHEQUE} WHERE UtilisateurID = ? AND JeuID = ?`)
        .get(req.params.idUser, req.params.jeuId);
    if (!jeu) return res.status(404).json({ error: 'Jeu introuvable dans la bibliothèque' });
    database.prepare('DELETE FROM BibliothequeJeux WHERE UtilisateurID = ? AND JeuID = ?')
        .run(req.params.idUser, req.params.jeuId);
    res.status(200).json(toBibliotheque(jeu));
});

app.put('/utilisateurs/:idUser/bibliothequejeux/:jeuId', authentifier, autoriserUtilisateur, (req, res) => {
    const { estInstalle } = req.body;
    if (typeof estInstalle !== 'boolean') {
        return res.status(400).json({ error: 'Le champ estInstalle doit être un booléen' });
    }
    const result = database.prepare(`
        UPDATE BibliothequeJeux SET EstInstalle = ? WHERE UtilisateurID = ? AND JeuID = ?
    `).run(estInstalle ? 1 : 0, req.params.idUser, req.params.jeuId);
    if (result.changes === 0) return res.status(404).json({ error: 'Jeu introuvable dans la bibliothèque' });
    const jeu = database.prepare(`${SELECT_BIBLIOTHEQUE} WHERE UtilisateurID = ? AND JeuID = ?`)
        .get(req.params.idUser, req.params.jeuId);
    res.json(toBibliotheque(jeu));
});

app.post('/achats', authentifier, (req, res) => {
    const jeuId = req.body.JeuID ?? req.body.jeuId;
    const utilisateurId = req.body.UtilisateurID ?? req.body.utilisateurId;
    if (!Number.isInteger(Number(jeuId)) || !Number.isInteger(Number(utilisateurId)) || jeuId === undefined || utilisateurId === undefined) {
        return res.status(400).json({ error: 'JeuID et UtilisateurID sont requis et doivent être des entiers' });
    }
    const jeuIdNum = Number(jeuId);
    const utilisateurIdNum = Number(utilisateurId);
    if (utilisateurIdNum !== req.auth.utilisateurId) {
        return res.status(403).json({ error: 'Vous ne pouvez acheter que pour votre propre compte' });
    }
    if (!database.prepare('SELECT JeuID FROM Jeux WHERE JeuID = ?').get(jeuIdNum)) {
        return res.status(404).json({ error: 'Jeu non trouvé' });
    }
    if (!database.prepare('SELECT UtilisateurID FROM Utilisateurs WHERE UtilisateurID = ?').get(utilisateurIdNum)) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    try {
        database.exec('BEGIN');
        const achat = database.prepare('INSERT INTO Achats (UtilisateurID, JeuID) VALUES (?, ?)')
            .run(utilisateurIdNum, jeuIdNum);
        database.prepare('INSERT INTO BibliothequeJeux (UtilisateurID, JeuID) VALUES (?, ?)')
            .run(utilisateurIdNum, jeuIdNum);
        database.exec('COMMIT');
        res.status(201).json({ achatId: Number(achat.lastInsertRowid), utilisateurId: utilisateurIdNum, jeuId: jeuIdNum });
    } catch (error) {
        database.exec('ROLLBACK');
        if (/UNIQUE constraint failed/.test(error.message)) {
            return res.status(409).json({ error: 'Ce jeu est déjà dans la bibliothèque de cet utilisateur' });
        }
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’achat' });
    }
});

app.listen(port, () => console.log(`L'API Steam écoute sur le port ${port}`));
