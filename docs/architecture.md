flowchart TB
    U["Navigateur du poste hôte"]

    subgraph K8S["Cluster Kubernetes - Namespace taskboard"]
        WEB_SVC["Service web<br/>NodePort : 30080"]
        WEB["Deployment web<br/>2 réplicas - Port 3000"]
        DB_SVC["Service db<br/>ClusterIP : 5432"]
        DB["StatefulSet db<br/>PostgreSQL 16 - db-0"]
        PVC[("PVC db-data-db-0<br/>1 Gi - ReadWriteOnce")]

        CM["ConfigMap web-config"]
        SEC["Secret db-credentials"]
        INIT["ConfigMap db-init<br/>Script SQL"]

        WEB_SVC --> WEB
        WEB -->|"DB_HOST=db - TCP 5432"| DB_SVC
        DB_SVC --> DB
        DB --> PVC

        CM -.-> WEB
        CM -.-> DB
        SEC -.-> WEB
        SEC -.-> DB
        INIT -.-> DB
    end

    U -->|"HTTP : 30080"| WEB_SVC
