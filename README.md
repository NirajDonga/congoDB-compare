# CognoDB Graph Database Benchmark

A rigorous benchmarking suite designed to compare the performance of **CognoDB Cloud** against four prominent self-hosted graph databases: **Neo4j**, **Memgraph**, **ArangoDB**, and **SurrealDB**.

## Methodology

To ensure a fair evaluation, all databases operate under identical resource constraints. Comparing managed cloud tiers against unconstrained local deployments introduces methodology errors. This suite strictly caps the resources of the four self-hosted databases via Docker to match CognoDB's c0 free tier specifications.

### Resource Allocation

All databases are capped at **0.5 vCPUs** and **512 MB RAM**.

| Database | Deployment Model | vCPU Allocation | RAM Allocation |
| :--- | :--- | :--- | :--- |
| **CognoDB** | Managed Cloud (c0 Free Tier) | 0.5 (Burstable) | 512 MB |
| **Neo4j** | Local Docker Container | 0.5 (Hard limit) | 512 MB (Hard limit) |
| **Memgraph** | Local Docker Container | 0.5 (Hard limit) | 512 MB (Hard limit) |
| **ArangoDB** | Local Docker Container | 0.5 (Hard limit) | 512 MB (Hard limit) |
| **SurrealDB** | Local Docker Container | 0.5 (Hard limit) | 512 MB (Hard limit) |

---

## Dataset & Implementation

The benchmark utilizes the [SNAP email-Enron](http://snap.stanford.edu/data/email-Enron.html) dataset, providing a realistic graph topology for traversals and lookups.
- **Nodes (Email Addresses):** 36,692
- **Edges (Communications):** 183,831

### Database Integrations
- **CognoDB / Neo4j / Memgraph:** Cypher `UNWIND` batches for ingest; Bolt protocol for queries.
- **ArangoDB:** `collection.import()` for ingest; AQL for queries.
- **SurrealDB:** `db.insert()` & `RELATE` for ingest; SurrealQL for queries.

*Note: A persistent index is created on the `nodeId` property across all databases prior to query execution.*

---

## Results

*Note: Run the benchmark locally to generate environment-specific results.*

### Ingest Throughput
| Database | Nodes/sec | Edges/sec |
| :--- | :--- | :--- |
| **CognoDB** | TBD | TBD |
| **Neo4j** | TBD | TBD |
| **Memgraph** | TBD | TBD |
| **ArangoDB** | TBD | TBD |
| **SurrealDB** | TBD | TBD |

### Query Latency (p50 in ms)
| Database | 1-Hop | 2-Hop | 3-Hop | Point Lookup | Indexed Lookup | Aggregation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CognoDB** | TBD | TBD | TBD | TBD | TBD | TBD |
| **Neo4j** | TBD | TBD | TBD | TBD | TBD | TBD |
| **Memgraph** | TBD | TBD | TBD | TBD | TBD | TBD |
| **ArangoDB** | TBD | TBD | TBD | TBD | TBD | TBD |
| **SurrealDB** | TBD | TBD | TBD | TBD | TBD | TBD |

### Footprint & Concurrency
| Database | Queries/sec (80/20 mix) | Memory (Idle) | Storage Size |
| :--- | :--- | :--- | :--- |
| **CognoDB** | TBD | N/A (Managed) | TBD |
| **Neo4j** | TBD | TBD | TBD |
| **Memgraph** | TBD | TBD | TBD |
| **ArangoDB** | TBD | TBD | TBD |
| **SurrealDB** | TBD | TBD | TBD |

---

## Reproduction Guide

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Download Dataset**
   ```bash
   node scripts/downloadData.js
   ```

3. **Initialize Databases**
   ```bash
   docker compose up -d
   ```

4. **Configure Environment**
   - Create a free c0 instance at [CognoDB Console](https://console.cognodb.com/signup).
   - Copy `.env.example` to `.env` and apply your CognoDB URI and credentials.

5. **Execute Benchmark**
   ```bash
   npm run benchmark
   ```
   *Detailed results are exported to `results/benchmark_results.json`.*
