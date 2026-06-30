# LIVRABLE — Pipeline CI/CD complète `api-events`

**Repo :** [DariusDreem/CICD-exam](https://github.com/DariusDreem/CICD-exam)  
**Branche de travail :** `NathanR`  
**App déployée :** https://cicd-exam.onrender.com  
**Health check :** https://cicd-exam.onrender.com/health  

> Le projet original (`SamiaSahla27/api-events`) ne donnait pas les droits d'écriture nécessaires pour pousser des branches et configurer les secrets/environnements. Le dépôt a donc été forké vers `DariusDreem/CICD-exam` où toutes les étapes ont été réalisées.

---

## Ce qui est automatisé (fichiers committés)

| Étape | Fichier(s) | Ce que ça fait |
|-------|-----------|----------------|
| **1 — CI avancée** | `.github/workflows/ci.yml` | Cache npm, service Postgres 16 (avec healthcheck), variables d'env au niveau job (`API_PASSWORD`, `DATABASE_URL`, `NODE_ENV`), script `check-env.sh` avant les tests, `npm test -- --coverage`, upload artefact `test-report` (7 jours, `if: always()`) |
| **2 — Docker + GHCR** | `Dockerfile`, `.github/workflows/build-publish.yml` | Build image Node 20 Alpine, conversion du nom en minuscules (GHCR l'exige), push sur GHCR avec tags `:latest` et `:<sha>` à chaque push sur `NathanR` ou `main` |
| **3 — DevSecOps** | `.github/dependabot.yml`, Trivy dans `build-publish.yml` | Mises à jour auto npm + github-actions (weekly), scan de vulnérabilités CRITICAL/HIGH après chaque build (`exit-code: 0`) |
| **4 — CD** | `.github/workflows/deploy.yml` | Deploy staging automatique via `RENDER_DEPLOY_HOOK`, deploy production bloqué jusqu'à approbation manuelle (Required reviewers) |
| **5 — /health** | `app.js`, `app.test.js` | Route `GET /health` → 200 + JSON (`status`, `timestamp`, `env`, `version`) ; 2 tests Supertest correspondants |
| **6 — check-env.sh** | `scripts/check-env.sh`, `ci.yml` | Vérifie avant les tests que `DATABASE_URL`, `API_PASSWORD` et `NODE_ENV` sont définis ; `exit 1` immédiat si l'une manque (`set -e`) |

---

## Actions manuelles réalisées dans GitHub

> Ces actions **ne peuvent pas être automatisées** par des fichiers committés.

### 1. Secrets (Settings → Secrets and variables → Actions)

| Nom | Valeur | Niveau |
|-----|--------|--------|
| `API_PASSWORD` | `JeSuisUnMotDePasse` | Repository secret |

> `DATABASE_URL` et `NODE_ENV` sont définis directement dans `ci.yml` au niveau du job, pas en secret.

### 2. Environnements (Settings → Environments)

**`staging`**
- Secret `RENDER_DEPLOY_HOOK` = URL du deploy hook Render (obtenu dans Render → Settings → Deploy Hook)

**`production`**
- **Required reviewers** activé avec `DariusDreem` comme reviewer obligatoire
- Le deploiement en production est bloqué jusqu'à approbation manuelle

### 3. GHCR — visibilité du package

Après le premier push de l'image sur GHCR, rendre le package public :  
GitHub → Profile → Packages → `cicd-exam` → Package Settings → Change visibility → Public

### 4. UptimeRobot (https://uptimerobot.com)

- Monitor type **HTTP(S)**
- URL surveillée : `https://cicd-exam.onrender.com/health`
- Intervalle : **5 minutes**
- Alerte email configurée

---

## Captures

> Placer les screenshots dans `docs/captures/` avec les noms indiqués ci-dessous.

### Capture 1 — Cache npm restauré dans la CI

![Cache npm restauré](docs/captures/01-ci-cache.png)

Emplacement : Actions → run CI → step "Set up Node.js" → log "Cache restored from key…"

---

### Capture 2 — Artefact `test-report` visible

![Artefact test-report](docs/captures/02-artefact.png)

Emplacement : Actions → run CI → onglet "Summary" → section "Artifacts" → `test-report`

---

### Capture 3 — Image GHCR avec 2 tags (`:latest` + `:<sha>`)

![GHCR package public](docs/captures/03-ghcr-tags.png)

Page principale du package : public, tags `:latest` et `:<sha>` visibles, commande `docker pull` affichée.

![GHCR versions](docs/captures/03-ghcr-versions.png)

Vue "Versions" : 1 tagged (`:latest` + SHA complet).

---

### Capture 4 — Rapport Trivy dans les logs

![Trivy scan](docs/captures/04-trivy.png)

![Trivy scan (suite)](docs/captures/04b-trivy-2.png)

Emplacement : Actions → run build-publish → step "Scan image Trivy" — logs de détection + tableau de synthèse.

![Trivy table complète](docs/captures/04c-trivy-table.png)

Vue complète du tableau : Alpine 3.23.4 — 2 vulnérabilités, tous les node-pkg à 0.

---

### Capture 5 — Secrets masqués dans GitHub

![Secrets masqués](docs/captures/05-secrets.png)

Emplacement : Settings → Secrets and variables → Actions → les valeurs sont masquées (●●●●●●)

---

### Capture 6 — Required reviewers sur l'environnement `production`

![Required reviewers](docs/captures/06-required-reviewers.png)

Emplacement : Settings → Environments → production → "Required reviewers" avec `DariusDreem`

---

### Capture 7 — Deploiement production bloqué + approbation + succès

![Deploy bloqué](docs/captures/07a-deploy-bloque.png)

Job en attente : "Waiting for review: production needs approval to start deploying changes."

![Modal d'approbation](docs/captures/07b-approbation.png)

Modal "Review pending deployments" → environnement `production` coché → "Approve and deploy".

![Deploy production réussi](docs/captures/07c-deploy-reussi.png)

Après approbation : tous les steps en vert, "Deploy to Production — succeeded in 4s".

---

### Capture 8 — Dashboard UptimeRobot (monitor en vert)

![UptimeRobot](docs/captures/08-uptimerobot.png)

Emplacement : https://uptimerobot.com/dashboard → monitor `cicd-exam.onrender.com/health` → Up

---

### Capture 9 — Step check-env.sh OK dans la CI

![check-env OK](docs/captures/09-check-env.png)

Emplacement : Actions → run CI → step "Vérifier les variables d'environnement" → "OK : toutes les variables sont definies"

---

### Capture 10 — Route /health live en production

![Health endpoint](docs/captures/10-health-live.png)

`GET https://cicd-exam.onrender.com/health` → `{"status":"ok","timestamp":"...","env":"development","version":"1.0.0"}`

---

### Capture 11 — Dashboard Render — service Live

![Render Live](docs/captures/11-render-live.png)

Service `CICD-exam` sur Render : Docker, Free, repo `DariusDreem / CICD-exam`, branche `NathanR`, statut **Live**.

---

## Réponses aux questions du jury

**1. Pourquoi `if: always()` sur l'upload d'artefact ?**

Sans `always()`, l'étape d'upload est sautée si les tests échouent — ce qui prive l'équipe du rapport de couverture au moment précis où elle en a le plus besoin. Avec `always()`, le rapport est uploadé même en cas d'échec, permettant d'analyser les tests qui ont planté.

**2. Différence entre le tag `:latest` et le tag `:<sha>` ?**

`:latest` est un alias mobile qui pointe toujours vers la dernière image buildée — pratique pour déployer rapidement mais sans traçabilité. `:<sha>` est un tag immuable lié à un commit précis, indispensable pour le rollback, l'audit et la reproductibilité.

**3. Que change `exit-code: 1` vs `exit-code: 0` sur Trivy ?**

Avec `exit-code: 0` (mode actuel), Trivy affiche les vulnérabilités mais laisse le pipeline continuer — c'est le mode "audit informatif". Avec `exit-code: 1`, Trivy bloque le job si des CVE CRITICAL/HIGH sont détectées — c'est le mode "bloquant" recommandé en production.

**4. Que fait `needs: deploy-staging` si le staging échoue ?**

GitHub Actions annule automatiquement `deploy-production` sans même le démarrer. La production ne peut être atteinte que si le staging a réussi.

**5. Que devrait contenir `/health` en production ?**

Des checks actifs : connexion BDD, disponibilité du cache, utilisation mémoire/disque. Distinction "liveness" (l'app répond) vs "readiness" (l'app peut recevoir du trafic). Temps de réponse de chaque check. Protection contre les abus (rate limiting).

**6. Que fait `set -e` dans un script bash ?**

Le shell s'arrête immédiatement à la première commande qui retourne un code non-zéro. Sans `set -e`, le script continue après une erreur et peut masquer des problèmes critiques.

**7. Pourquoi le nom du repo doit être en minuscules pour GHCR ?**

GHCR suit la spec OCI qui impose des noms de registry en minuscules. `DariusDreem/CICD-exam` est invalide ; la CI convertit via `tr '[:upper:]' '[:lower:]'` pour obtenir `dariusdreem/cicd-exam`.

---

## Preuve : absence de secrets en clair dans `.github/`

Résultat de `grep -ri "password\|token\|JeSuis\|postgresql://" .github/` :
- Aucune valeur en clair — tous les secrets passent par `${{ secrets.X }}`
- `DATABASE_URL` est hardcodée en tant que valeur de test non sensible (`postgresql://test:test@localhost:5432/test`)
