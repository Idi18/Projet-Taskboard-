// App TaskBoard : Express + PostgreSQL (APP-1 a APP-6)

const fs = require("fs");
const path = require("path");
const express = require("express");
const { Pool } = require("pg");
const { version } = require("./package.json");

// Config lue uniquement dans les variables d'env (APP-3)
const REQUIRED_ENV = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "APP_PORT"];
const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Variables d'environnement manquantes : ${missing.join(", ")}`);
  process.exit(1);
}

const config = {
  appPort: Number(process.env.APP_PORT),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
};

// Nom du pod (APP-6)
const podName = process.env.HOSTNAME || "inconnu";

const pool = new Pool({
  ...config.db,
  max: 5,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

// Sinon le process plante quand la base est coupee (T6)
pool.on("error", (err) => {
  console.error("Erreur connexion base :", err.message);
});

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

// En-tetes de securite
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  });
  next();
});

// Liveness : ne touche pas a la base (APP-4)
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Readiness : 200 si la base repond, 503 sinon (APP-5)
// timeout < 1s car la sonde k8s a un timeout de 1s par defaut
app.get("/readyz", async (req, res) => {
  try {
    await withTimeout(pool.query("SELECT 1"), 900);
    res.status(200).json({ status: "ready" });
  } catch (err) {
    res.status(503).json({ status: "base de données indisponible", detail: err.message });
  }
});

// Page d'accueil, le nom du pod est mis cote serveur
const indexTemplate = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

app.get("/", (req, res) => {
  const html = indexTemplate
    .replaceAll("{{POD_NAME}}", escapeHtml(podName))
    .replaceAll("{{VERSION}}", escapeHtml(version));
  res.set("Cache-Control", "no-store").type("html").send(html);
});

app.use(express.static(path.join(__dirname, "public"), { index: false }));

app.get("/api/info", (req, res) => {
  res.json({ pod: podName, version });
});

// API /api/tasks (APP-1, APP-2), requetes parametrees contre l'injection SQL

const COLUMNS = "id, titre, terminee, date_creation";

function parseId(raw) {
  return /^\d{1,9}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

function validateTitre(titre) {
  if (typeof titre !== "string") return "le champ 'titre' doit être une chaîne";
  const t = titre.trim();
  if (t.length === 0) return "le champ 'titre' ne peut pas être vide";
  if (t.length > 255) return "le champ 'titre' dépasse 255 caractères";
  return null;
}

app.get("/api/tasks", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM tasks ORDER BY id`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/tasks/:id", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "id invalide" });
  try {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM tasks WHERE id = $1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "tâche introuvable" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  const titre = req.body?.titre;
  const error = validateTitre(titre);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (titre) VALUES ($1) RETURNING ${COLUMNS}`,
      [titre.trim()]
    );
    res.status(201).location(`/api/tasks/${rows[0].id}`).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH/PUT : titre et/ou terminee
async function updateTask(req, res, next) {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "id invalide" });

  const body = req.body || {};
  const sets = [];
  const values = [];

  if (body.titre !== undefined) {
    const error = validateTitre(body.titre);
    if (error) return res.status(400).json({ error });
    values.push(body.titre.trim());
    sets.push(`titre = $${values.length}`);
  }
  if (body.terminee !== undefined) {
    if (typeof body.terminee !== "boolean") {
      return res.status(400).json({ error: "le champ 'terminee' doit être true ou false" });
    }
    values.push(body.terminee);
    sets.push(`terminee = $${values.length}`);
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: "rien à modifier (champs 'titre' ou 'terminee')" });
  }

  values.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING ${COLUMNS}`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "tâche introuvable" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}
app.patch("/api/tasks/:id", updateTask);
app.put("/api/tasks/:id", updateTask);

app.delete("/api/tasks/:id", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "id invalide" });
  try {
    const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    if (rowCount === 0) return res.status(404).json({ error: "tâche introuvable" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Erreurs

app.use((req, res) => {
  res.status(404).json({ error: "route introuvable" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON invalide" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "requête trop volumineuse" });
  }
  // le detail reste dans les logs, pas dans la reponse
  console.error(`[${req.method} ${req.originalUrl}]`, err.message);
  res.status(503).json({ error: "service temporairement indisponible" });
});

const server = app.listen(config.appPort, () => {
  console.log(
    `TaskBoard ${version} sur le port ${config.appPort} ` +
      `(pod ${podName}, base ${config.db.host}:${config.db.port}/${config.db.database})`
  );
});

// Arret propre sur SIGTERM pour ne pas couper les requetes en cours (T5, T9)
function shutdown(signal) {
  console.log(`${signal} recu, arret...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
