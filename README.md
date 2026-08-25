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

## Analysis & Findings

*(Note: The following analysis should be updated once the benchmark results are populated).*

### 1. Ingest & Load Performance
- **CognoDB & Neo4j:** Due to their native graph storage and optimized Cypher `UNWIND` bolt transactions, these platforms typically excel at batch ingestion. 
- **Memgraph:** Operating primarily in-memory, Memgraph often demonstrates the highest burst ingest speeds, though it is bounded by the strict 512MB RAM limit.
- **ArangoDB & SurrealDB:** As multi-model databases wrapping graph capabilities over document/KV stores, ingest throughput is generally competitive but can incur overhead during complex relationship creations.

### 2. Traversal & Lookup Latency
- **Deep Traversals (2-hop, 3-hop):** Native graph engines (CognoDB, Neo4j) rely on index-free adjacency, allowing constant-time pointer chasing. This results in minimal latency degradation as hop depth increases. Multi-model engines without index-free adjacency usually see exponential latency increases at deeper hops.
- **Point Lookups:** All databases perform exceptionally well (often sub-millisecond) for 1-hop point lookups thanks to the persistent `nodeId` indexes.

### 3. Mixed Workload & Concurrency
- Under concurrent read/write pressure (80/20 mix), databases handle locking differently. Memgraph's in-memory MVCC (Multi-Version Concurrency Control) typically shines here. CognoDB performs well but must contend with the added network latency of the public internet compared to the local `localhost` Docker counterparts.

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
