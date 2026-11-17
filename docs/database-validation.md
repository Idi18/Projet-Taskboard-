# Validation de la base de données PostgreSQL — TaskBoard

## 1. Objectif

Cette documentation présente les tests de déploiement, d'initialisation et de persistance de PostgreSQL réalisés dans le cadre du projet Docker & Kubernetes TaskBoard.

## 2. Architecture technique

La base de données utilise l'image officielle `postgres:16-alpine`.

Dans Kubernetes, elle est exécutée par un StatefulSet à un réplica, avec un PersistentVolumeClaim de 1 Gi et un Service interne ClusterIP nommé `db`, sur le port 5432.

Le script `db/init.sql` initialise la table `tasks` et trois tâches d'exemple lors de la première création de la base.

## 3. Validation Kubernetes — Test T4

Le déploiement du StatefulSet a créé automatiquement le Pod `db-0` et le PVC `db-data-db-0`.

**Procédure réalisée :**

1. Vérification du Pod PostgreSQL : état `Running`, disponibilité `1/1`.
2. Vérification du PVC : état `Bound`, capacité de 1 Gi.
3. Insertion d'une quatrième tâche nommée `Test persistance T4`.
4. Suppression volontaire du Pod avec `kubectl delete pod db-0 -n taskboard`.
5. Attente de la recréation automatique du Pod par le StatefulSet.
6. Nouvelle interrogation SQL de la table `tasks`.

**Résultat observé :** les quatre tâches étaient toujours présentes après la recréation de `db-0`. Le PVC était toujours associé à son volume persistant.

**Conclusion :** test T4 réussi. Le stockage persistant fonctionne malgré la suppression du Pod PostgreSQL.

## 4. Validation Docker Compose

Un environnement PostgreSQL indépendant a été préparé avec `db/compose.db-test.yaml`.

Le conteneur utilise un volume Docker nommé pour conserver les données et un healthcheck fondé sur `pg_isready`.

**Procédure réalisée :**

1. Démarrage de PostgreSQL avec Docker Compose.
2. Vérification de l'état `healthy`.
3. Vérification des trois tâches initiales.
4. Insertion d'une quatrième tâche nommée `Test persistance Compose`.
5. Arrêt et suppression du conteneur avec `docker compose down`, sans l'option `-v`.
6. Redémarrage avec `docker compose up -d --wait`.
7. Nouvelle interrogation SQL.

**Résultat observé :** les quatre tâches ont été retrouvées après redémarrage. Le conteneur était de nouveau `healthy`.

**Conclusion :** la persistance du volume Docker Compose est validée.

## 5. Sécurité et configuration

Les paramètres non sensibles sont centralisés dans la ConfigMap `web-config`. Le mot de passe PostgreSQL est fourni séparément par le Secret Kubernetes `db-credentials`, créé localement et non versionné.

La base est exposée uniquement à l'intérieur du cluster via le Service ClusterIP `db`. Aucun NodePort PostgreSQL n'a été configuré.

Le Secret Kubernetes nécessite, en environnement de production, des contrôles d'accès RBAC et un chiffrement au repos.

## 6. Limites des validations

Les tests effectués démontrent la persistance après recréation des conteneurs et du Pod PostgreSQL.

Ils ne prouvent pas la résistance à la perte totale du nœud de stockage, ni la haute disponibilité de la base : le StatefulSet utilise actuellement un seul réplica.

La connexion avec l'application Express et les tests d'intégration web seront vérifiés lorsque les développements des autres membres seront disponibles.