# 🗄️ DATABASE SCHEMAS (PRODUCTION-LEVEL)

## ☁️ Africa Cloud — Polyglot Data Architecture

---

# 🧠 0. DATABASE STRATEGY (IMPORTANT)

You are NOT using one database.

You are using:

| Purpose            | DB         |
| ------------------ | ---------- |
| Metadata & configs | Postgres   |
| Streaming          | Kafka      |
| Object storage     | S3 / MinIO |
| Time-series / logs | Cassandra  |
| Graph (fraud)      | Neo4j      |

---

# 🧱 1. POSTGRES (CORE METADATA DATABASE)

This is your **control plane brain**.

---

## 1.1 `tenants`

Multi-tenancy support (banks, startups, govs)

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT, -- bank, telco, gov, startup
    country_code TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.2 `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.3 `api_keys`

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    key TEXT UNIQUE,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.4 `edge_nodes`

Tracks all deployed nodes across Africa

```sql
CREATE TABLE edge_nodes (
    id UUID PRIMARY KEY,
    name TEXT,
    country TEXT,
    region TEXT,
    status TEXT,
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.5 `services`

Microservices registry

```sql
CREATE TABLE services (
    id UUID PRIMARY KEY,
    name TEXT,
    version TEXT,
    status TEXT,
    deployed_on UUID REFERENCES edge_nodes(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.6 `pipelines`

```sql
CREATE TABLE pipelines (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    name TEXT,
    definition JSONB,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.7 `pipeline_runs`

```sql
CREATE TABLE pipeline_runs (
    id UUID PRIMARY KEY,
    pipeline_id UUID,
    status TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    logs TEXT
);
```

---

## 1.8 `datasets`

Lakehouse metadata

```sql
CREATE TABLE datasets (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    name TEXT,
    schema JSONB,
    storage_path TEXT,
    version INT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.9 `sync_logs`

CRITICAL for distributed system debugging

```sql
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY,
    node_id UUID,
    event_id TEXT,
    status TEXT,
    retries INT DEFAULT 0,
    last_attempt TIMESTAMP
);
```

---

# 📡 2. KAFKA (EVENT STREAM DESIGN)

---

## Core Topics

```plaintext
ingestion.raw
ingestion.validated
data.processed
risk.events
sync.events
```

---

## Event Structure (STANDARDIZED)

```json
{
  "event_id": "uuid",
  "event_type": "INSERT | UPDATE | DELETE",
  "source": "postgres | api | file",
  "timestamp": "ISO8601",
  "payload": {},
  "metadata": {
    "tenant_id": "",
    "node_id": ""
  }
}
```

---

# 🗄️ 3. OBJECT STORAGE (S3 / MINIO)

---

## Bucket Structure

```plaintext
/africa-cloud/
    /tenant_id/
        /dataset_name/
            /year=2026/
                /month=03/
                    /day=28/
                        file.parquet
```

---

## Features

* Partitioned by:

  * tenant
  * country
  * date

* Format:

  * Parquet (columnar, compressed)

---

# 📊 4. CASSANDRA (TIME-SERIES + LOGS)

---

## 4.1 `event_logs`

```sql
CREATE TABLE event_logs (
    event_id UUID,
    node_id UUID,
    event_type TEXT,
    timestamp TIMESTAMP,
    payload TEXT,
    PRIMARY KEY (node_id, timestamp)
);
```

---

## 4.2 `metrics`

```sql
CREATE TABLE metrics (
    node_id UUID,
    metric_name TEXT,
    value DOUBLE,
    timestamp TIMESTAMP,
    PRIMARY KEY (node_id, metric_name, timestamp)
);
```

---

# 🧠 5. NEO4J (FRAUD & IDENTITY GRAPH)

---

## Nodes

* User
* Account
* Device
* Transaction

---

## Relationships

```plaintext
(User)-[:OWNS]->(Account)
(Account)-[:SENT]->(Transaction)
(Transaction)-[:TO]->(Account)
(User)-[:USES]->(Device)
```

---

## Use Cases

* Fraud ring detection
* Identity linking
* Suspicious pattern detection

---

# 🔄 6. SYNC STATE TABLES (VERY IMPORTANT)

---

## 6.1 `sync_state`

Tracks last sync per node

```sql
CREATE TABLE sync_state (
    node_id UUID,
    last_event_timestamp TIMESTAMP,
    last_event_id TEXT,
    status TEXT,
    PRIMARY KEY (node_id)
);
```

---

## 6.2 `conflicts`

```sql
CREATE TABLE conflicts (
    id UUID PRIMARY KEY,
    entity_id TEXT,
    node_id UUID,
    conflict_type TEXT,
    resolution_status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 🧠 7. DATA VERSIONING (CRITICAL)

---

## Strategy

* Every dataset has:

  * Version
  * Timestamp
  * Change log

---

## Example

```plaintext
dataset_v1.parquet
dataset_v2.parquet
```

---

# ⚠️ KEY DESIGN DECISIONS

---

## 1. Multi-Tenancy

* Everything tied to `tenant_id`

---

## 2. Event-Driven Data

* Kafka is source of truth for changes

---

## 3. Immutable Storage

* Parquet files are append-only

---

## 4. Sync Observability

* Logs + state tables track every sync

---

# 🔥 WHAT YOU JUST BUILT

You now have:

* Control plane schema
* Data plane architecture
* Event model
* Storage model
* Sync tracking

This is **real distributed system data design**.

---

# 👉 NEXT (CRITICAL — YOUR SECRET WEAPON)

Now we go to:

# 🔄 SYNC ENGINE PROTOCOL

This is where you beat:

* Amazon Web Services
* Google Cloud Platform

Because they are NOT built for:

* Offline-first
* Intermittent sync
* Edge conflict resolution

---
