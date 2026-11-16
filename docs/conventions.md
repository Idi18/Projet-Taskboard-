# Conventions de l'equipe

## Noms communs
- Namespace : taskboard
- ConfigMap de l'app : web-config (DB_HOST=db, DB_PORT=5432, DB_NAME=taskboard, DB_USER=taskboard, APP_PORT=3000)
- Secret : db-credentials (cle DB_PASSWORD)
- Service de la base : db (ClusterIP, port 5432)
- Service de l'app : web (NodePort 30080)
- Image de l'app : taskboard-web:1.0.0
- Port de l'app : 3000

## Labels obligatoires sur chaque objet
- app: taskboard
- tier: web pour l'application, tier: db pour la base

## Git
- Une branche par tache : app/..., docker/..., k8s/..., db/...
- Toujours passer par une pull request, relue par un autre membre
