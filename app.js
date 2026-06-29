const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();
const db = require('./database');

// ── Sécurité : Headers HTTP ──────────────────────────────────────────
app.use(helmet());

// ── Sécurité : Rate limiting (100 req / 15 min par IP) ───────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de requêtes, veuillez réessayer plus tard" }
});
app.use('/events', limiter);

app.use(cors());

// ── Sécurité : Taille max du payload (10 kb) ─────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Sécurité : Forcer Content-Type application/json sur les mutations ─
const enforceJson = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (!req.is('application/json')) {
            return res.status(415).json({ error: "Content-Type doit être application/json" });
        }
    }
    next();
};
app.use('/events', enforceJson);

app.use(express.static('public')); // Sert le front depuis /public

// ── Helpers de sanitisation ───────────────────────────────────────────
/**
 * Supprime les balises HTML pour prévenir les injections XSS stockées.
 * - Les balises script/style sont supprimées avec leur contenu.
 * - Les autres balises sont supprimées en conservant leur texte intérieur.
 * @param {string} str
 * @returns {string}
 */
const stripTags = (str) => {
    if (typeof str !== 'string') return str;
    // Supprimer script et style avec leur contenu
    let safe = str.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Supprimer toutes les autres balises HTML (texte conservé)
    safe = safe.replace(/<[^>]*>/g, '');
    return safe.trim();
};

/**
 * Sanitise les champs texte d'un événement.
 */
const sanitizeEvent = (body) => ({
    ...body,
    title: body.title ? stripTags(body.title) : body.title,
    description: body.description ? stripTags(body.description) : body.description,
    categorie: body.categorie ? stripTags(body.categorie) : body.categorie,
    lieu: body.lieu ? stripTags(body.lieu) : body.lieu,
});

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de gestion d\'événements !');
});

app.get('/events', (req, res) => {
    const events = db.prepare('SELECT * FROM events').all();
    res.json(events);
});

// POST /events : Créer un nouvel événement
app.post('/events', (req, res) => {
    const newEvent = sanitizeEvent(req.body);

    // --- LOGIQUE MÉTIER (À tester via CI/CD !) ---

    // 1. Validation basique
    if (!newEvent.title || !newEvent.date || !newEvent.participants || !newEvent.categorie || !newEvent.lieu) {
        return res.status(400).json({ error: "Tous les champs sont obligatoires" });
    }


    // validation catégorie 
    const validCategories = ['Music', 'Art', 'Tech', 'Sports', 'Education'];
    if (!validCategories.includes(newEvent.categorie)) {
        return res.status(400).json({ error: "Catégorie invalide. Les catégories valides sont : " + validCategories.join(', ') });
    }

    // 2. Validation logique : pas d'événement dans le passé
    const eventDate = new Date(newEvent.date);
    const today = new Date();
    // On retire l'heure pour comparer uniquement les jours
    today.setHours(0, 0, 0, 0);

    if (eventDate < today) {
        return res.status(400).json({
            error: "La date ne peut pas être dans le passé"
        });
    }

    // 2b. Validation participants
    if (newEvent.participants !== undefined && newEvent.participants !== null) {
        const cap = Number(newEvent.participants);
        if (!Number.isInteger(cap) || cap < 1) {
            return res.status(400).json({ error: "La capacité doit être un entier positif" });
        } if (!Number.isInteger(cap) || cap > 50) {
            return res.status(400).json({ error: "La capacité doit etre inférieure a 50" });
        }
    }

    // 3. Insertion en base de données
    const stmt = db.prepare('INSERT INTO events (title, date, description, participants, categorie, lieu) VALUES (?, ?, ?, ?, ?, ?)');
    const result = stmt.run(
        newEvent.title,
        newEvent.date,
        newEvent.description ?? null,
        newEvent.participants ?? null,
        newEvent.categorie ?? null,
        newEvent.lieu ?? null
    );

    res.status(201).json({
        id: result.lastInsertRowid,
        title: newEvent.title,
        date: newEvent.date,
        description: newEvent.description ?? null,
        participants: newEvent.participants ?? null,
        categorie: newEvent.categorie ?? null,
        lieu: newEvent.lieu ?? null
    });
});

// PUT /events/:id : Mettre à jour un événement
app.put('/events/:id', (req, res) => {
    const { id } = req.params;
    const { title, date, description, participants, categorie, lieu } = sanitizeEvent(req.body);

    if (!title || !date) {
        return res.status(400).json({ error: "Le titre et la date sont obligatoires" });
    }

    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
        return res.status(400).json({ error: "La date ne peut pas être dans le passé" });
    }

    if (participants !== undefined && participants !== null) {
        const cap = Number(participants);
        if (!Number.isInteger(cap) || cap < 1) {
            return res.status(400).json({ error: "La capacité doit être un entier positif" });
        }
    }

    const result = db.prepare(
        'UPDATE events SET title = ?, date = ?, description = ?, participants = ?, categorie = ?, lieu = ? WHERE id = ?'
    ).run(title, date, description ?? null, participants ?? null, categorie ?? null, lieu ?? null, id);

    if (result.changes === 0) {
        return res.status(404).json({ error: "Événement introuvable" });
    }

    res.status(200).json({ id: Number(id), title, date, description: description ?? null, participants: participants ?? null, categorie: categorie ?? null, lieu: lieu ?? null });
});

// DELETE /events/:id : Supprimer un événement
app.delete('/events/:id', (req, res) => {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM events WHERE id = ?').run(id);

    if (result.changes === 0) {
        return res.status(404).json({ error: "Événement introuvable" });
    }

    res.status(204).json({ message: `Événement #${id} supprimé` });
});

app.get('/help', (req, res) => {
    res.status(200).json({
        endpoints: {
            "GET /events": "Récupérer tous les événements",
            "POST /events": "Créer un nouvel événement (title, date, description?, participants?, categorie?, lieu?)",
            "PUT /events/:id": "Mettre à jour un événement (title, date, description?, participants?, categorie?, lieu?)",
            "DELETE /events/:id": "Supprimer un événement"
        }
    });
});



// Export de l'app (nécessaire pour les tests unitaires sans lancer le serveur)

// ── Observabilité : Route /health ────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Export de l'app (nécessaire pour les tests unitaires sans lancer le serveur)
module.exports = app;
