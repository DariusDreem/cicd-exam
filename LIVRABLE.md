# LIVRABLE — Pipeline CI/CD complète `api-events`

Branche de travail : `exam/cicd-samia` (créée depuis `main`)

---

## Ce qui est automatisé (fichiers committés)

| Étape | Fichier(s) | Ce que ça fait |
|-------|-----------|----------------|
| **1 — CI avancée** | `.github/workflows/ci.yml` | Cache npm, service Postgres (avec healthcheck), variables d'env au niveau job (`API_PASSWORD`, `DATABASE_URL`, `NODE_ENV`), tests avec `--coverage`, upload artefact `test-report-<env>` (7 jours) |
| **2 — Docker + GHCR** | `Dockerfile`, `.github/workflows/build-publish.yml` | Build image Node 20 Alpine, push sur GHCR avec tags `:latest` et `:<sha>` à chaque push sur `main` |
| **3 — DevSecOps** | `.github/dependabot.yml`, Trivy dans `build-publish.yml` | Mises à jour auto npm + actions (weekly), scan de vulnérabilités CRITICAL/HIGH après chaque build |
| **4 — CD** | `.github/workflows/deploy.yml` | Deploy staging automatique via `RENDER_DEPLOY_HOOK`, deploy production bloqué jusqu'à approbation manuelle (Required reviewers) |
| **5 — /health** | `app.js`, `app.test.js` | Route `GET /health` → 200 + JSON (status, timestamp, env, version) ; 2 tests Supertest correspondants |
| **6 — check-env.sh** | `scripts/check-env.sh`, `ci.yml` | Vérifie avant les tests que `DATABASE_URL`, `API_PASSWORD` et `NODE_ENV` sont définis ; fail fast si l'une manque |

---

## Actions manuelles à faire dans GitHub

> Ces actions **ne peuvent pas être automatisées** par des fichiers committés.

### 1. Secrets (Settings → Secrets and variables → Actions)

Créer les 3 secrets suivants :

| Nom | Valeur |
|-----|--------|
| `API_PASSWORD` | Mot de passe de l'API (valeur de votre choix, ex: `supersecret`) |
| `DATABASE_URL` | `postgresql://test:test@localhost:5432/test` (déjà dans le yml pour CI, mais optionnel ici) |
| `NODE_ENV` | `test` |

> ⚠️ Tant que `API_PASSWORD` n'est pas créé, le step "Vérifier API_PASSWORD" fera échouer la CI.

### 2. Environnements (Settings → Environments)

Créer deux environnements :

**`staging`**
- Ajouter le secret `RENDER_DEPLOY_HOOK` = URL du deploy hook Render (obtenu dans le dashboard Render)

**`production`**
- Activer **Required reviewers** et s'ajouter comme reviewer
- Optionnel : ajouter un délai d'attente

### 3. UptimeRobot (https://uptimerobot.com)

- Créer un compte gratuit
- Nouveau monitor : type **HTTP(S)**
- URL : `https://<votre-app>.onrender.com/health`
- Intervalle : **5 minutes**
- Notification : alerte email sur l'adresse configurée

---

## Captures à prendre (preuves pour le jury)

| N° | Quoi capturer | Où trouver |
|----|--------------|-----------|
| 1 | Logs CI montrant **"Cache restored from…"** | Actions → run CI → step "Setup Node.js" |
| 2 | Artefact **`test-report-<env>`** visible | Actions → run CI → onglet "Summary" → "Artifacts" |
| 3 | Image avec ses **2 tags** (`:latest` et `:<sha>`) | Onglet "Packages" → `api-events` (`ghcr.io/samiasahla27/api-events`) |
| 4 | **Rapport Trivy** dans les logs | Actions → run build-publish → step "Scan image Trivy" |
| 5 | Liste masquée des **secrets** | Settings → Secrets and variables → Actions (les valeurs sont cachées ✓) |
| 6 | **Required reviewers** activé sur `production` | Settings → Environments → production |
| 7 | Run `deploy` **bloqué en attente d'approbation** sur `deploy-production` | Actions → run deploy → job "Deploy to Production" → "Review deployments" |
| 8 | **Dashboard UptimeRobot** avec le monitor en vert | https://uptimerobot.com/dashboard |
| 9 | Logs du step **`check-env` OK** | Actions → run CI → step "Vérifier les variables d'environnement requises" |

---

## Réponses aux questions du jury

**1. Pourquoi `if: always()` sur l'upload d'artefact ?**

Sans `always()`, l'étape d'upload est sautée si les tests échouent, ce qui prive l'équipe du rapport de couverture au moment précis où elle en a le plus besoin pour diagnostiquer. Avec `always()`, le rapport est uploadé même en cas d'échec des tests, permettant d'analyser la couverture et d'identifier les tests qui ont planté.

**2. Différence entre le tag `:latest` et le tag `:<sha>` ?**

`:latest` est un alias mobile qui pointe toujours vers la dernière image buildée — il est pratique pour déployer rapidement mais ne permet pas de tracer exactement quelle version tourne. `:<sha>` est un tag immuable lié à un commit précis, indispensable pour le rollback, l'audit et la reproductibilité : on sait exactement quel code est dans l'image.

**3. Que change `exit-code: 1` vs `exit-code: 0` sur Trivy ?**

Avec `exit-code: 0`, Trivy affiche les vulnérabilités trouvées mais laisse le pipeline continuer quel que soit le résultat — c'est le mode "audit informatif". Avec `exit-code: 1`, Trivy fait échouer le job si des vulnérabilités de la sévérité ciblée (CRITICAL, HIGH) sont détectées, bloquant ainsi le déploiement d'une image vulnérable — c'est le mode "bloquant" recommandé en production.

**4. Que fait `needs: deploy-staging` si le job staging échoue ?**

Si `deploy-staging` échoue (curl qui retourne une erreur, environnement indisponible, etc.), GitHub Actions annule automatiquement `deploy-production` sans même le démarrer. C'est une dépendance forte : la production ne peut être déployée que si le staging a été validé avec succès, ce qui évite de pousser du code cassé en prod.

**5. Que devrait contenir une route `/health` en production (au-delà du minimum) ?**

En production, `/health` devrait vérifier activement l'état des dépendances critiques : connexion à la base de données (ping ou requête simple), disponibilité du cache (Redis, etc.), et éventuellement l'espace disque ou l'utilisation mémoire. Elle devrait aussi distinguer "liveness" (l'app répond) de "readiness" (l'app est prête à recevoir du trafic), retourner le temps de réponse de chaque check, et être protégée contre les abus (rate limiting ou auth interne).

**6. Que fait `set -e` dans un script bash ?**

`set -e` (ou `set -o errexit`) indique au shell de sortir immédiatement avec un code d'erreur dès qu'une commande retourne un statut non-zéro. Sans cette option, le script continue d'exécuter les lignes suivantes même après une erreur, ce qui peut masquer des problèmes et produire des comportements imprévisibles. C'est une bonne pratique systématique dans les scripts CI pour garantir un comportement "fail fast".

---

## Preuve : absence de secrets en clair dans `.github/`

Résultat de `grep -ri "password\|token\|postgresql://" .github/` :
- Aucune valeur en clair — tous les secrets passent par `${{ secrets.X }}`
