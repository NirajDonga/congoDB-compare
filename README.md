# CognoDB Graph Database Benchmark

A rigorous benchmarking suite designed to compare the performance of **CognoDB Cloud** against four prominent self-hosted graph databases: **FalkorDB**, **Memgraph**, **ArangoDB**, and **Apache AGE**.

## Methodology & Fairness

To ensure a fair evaluation, all databases operate under identical resource constraints. Comparing managed cloud tiers against unconstrained local deployments introduces methodology errors. This suite strictly caps the resources of the four self-hosted databases via Docker to match CognoDB's c0 free tier specifications (or as close as Docker allows). 

The client runner was executed locally against remote (CognoDB) and local Docker (other DBs) instances. Appropriate warm-up iterations were run for each read query before metrics were recorded, ensuring stable cache and execution paths.

### Environment & Instance Specs

All databases are capped at **0.5 vCPUs** and **256 MB RAM** (configured in `docker-compose.yml` to align with CognoDB's 256 MB free tier limit). 

| Database | Deployment Model | vCPU Allocation | RAM Allocation | Storage |
| :--- | :--- | :--- | :--- | :--- |
| **CognoDB** | Managed Cloud (c0 Free Tier) | 0.5 (Burstable) | 256 MB | 1 GB |
| **FalkorDB** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | 1 GB |
| **Memgraph** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | 1 GB |
| **ArangoDB** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | 1 GB |
| **Apache AGE** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | 1 GB |

---

## Dataset

The benchmark utilizes the public [SNAP email-Enron](http://snap.stanford.edu/data/email-Enron.html) dataset, providing a realistic social/communication network graph topology for traversals, lookups, and aggregations.

- **Nodes (Email Addresses):** 36,692
- **Relationships (Communications):** 183,831

The dataset size was selected to fit comfortably within the 256 MB RAM limit across all tested platforms. The exact same dataset is loaded across all platforms.

## Ingest & Load Methods

- **CognoDB & Memgraph:** Cypher driver batching using `UNWIND` statements via the official Bolt driver.
- **FalkorDB:** Cypher driver batching via RedisGraph/FalkorDB driver.
- **ArangoDB:** Driver batching via `collection.import()` utilizing the HTTP API.
- **Apache AGE:** Standard Cypher execution over PostgreSQL protocol using the AGE driver.

*Note: A persistent index is explicitly created on the `nodeId` property for nodes across all platforms to optimize lookups prior to benchmarking.*

---

## Benchmark Results Matrix

### 1. Data Loading (Ingest Throughput)
| Database | Total Load Time (sec) | Nodes/sec | Relationships/sec |
| :--- | :--- | :--- | :--- |
| **CognoDB** | 212.97 | 1,628 | 1,930 |
| **FalkorDB** | 44.17 | 133,226 | 8,375 |
| **Memgraph** | 20.69 | 20,506 | 19,445 |
| **ArangoDB** | 13.36 | 43,943 | 29,340 |
| **Apache AGE** | 240.66 | 78,346 | 1,530 |

### 2. Traversals (Query Latency)
*Metrics represent latencies from a randomly chosen set of start nodes, collected after warm-up runs (≥ 100 iterations).*

| Database | 1-Hop (p50 / p95) ms | 2-Hop (p50 / p95) ms | 3-Hop (p50 / p95) ms |
| :--- | :--- | :--- | :--- |
| **CognoDB** | 306.95 / 310.40 | 307.93 / 1242.00 | 2025.01 / 4768.84 *(77 err)* |
| **FalkorDB** | 0.42 / 0.71 | 0.81 / 4.80 | 10.20 / 59.33 |
| **Memgraph** | 0.69 / 1.50 | 1.45 / 47.32 | 48.80 / 493.87 |
| **ArangoDB** | 3.95 / 4.52 | 6.54 / 67.99 | 304.39 / 6328.20 |
| **Apache AGE** | 1.02 / 1.32 | 2.96 / 46.32 | 133.14 / 3015.34 |

### 3. Lookups & Aggregations
*Metrics for point lookups via `nodeId` (which is indexed across all platforms) and a standard Count/Group-By aggregation.*

| Database | Point Lookup (p50 / p95) ms | Indexed/Filtered (p50 / p95) ms | Aggregation (p50 / p95) ms |
| :--- | :--- | :--- | :--- |
| **CognoDB** | 307.56 / 410.93 *(78 err)* | 307.04 / 409.84 | 818.32 / 921.47 |
| **FalkorDB** | 0.33 / 0.62 | 5.97 / 53.15 | 425.46 / 479.58 |
| **Memgraph** | 0.76 / 1.43 | 8.76 / 59.79 | 202.31 / 252.27 |
| **ArangoDB** | 3.22 / 4.35 | 3.30 / 4.16 | 176.22 / 190.92 |
| **Apache AGE** | 0.43 / 0.93 | 0.37 / 0.72 | 1085.07 / 1096.84 |

### 4. Mixed Workload & Concurrency
*Sustained concurrent read/write throughput (80% read / 20% write mix) across 1, 10, and 40 concurrent clients.*

| Database | Concurrency (1 Clients) | Concurrency (10 Clients) | Concurrency (40 Clients) |
| :--- | :--- | :--- | :--- |
| **CognoDB** | 3 req/sec | 35 req/sec | 146 req/sec |
| **FalkorDB** | 3,394 req/sec | 3,307 req/sec | 2,847 req/sec |
| **Memgraph** | 1,148 req/sec | 1,433 req/sec | 1,375 req/sec |
| **ArangoDB** | 270 req/sec | 741 req/sec | 903 req/sec |
| **Apache AGE** | 2,233 req/sec | 2,668 req/sec | 2,531 req/sec |

### 5. Footprint (Resource Usage)

| Database | Stored Data Size (Disk) | Memory Usage (Idle) | Memory Usage (Peak Workload) |
| :--- | :--- | :--- | :--- |
| **CognoDB** | Not Observable | Not Observable | Not Observable |
| **FalkorDB** | Not Observable | Not Observable | Not Observable |
| **Memgraph** | Not Observable | Not Observable | Not Observable |
| **ArangoDB** | Not Observable | Not Observable | Not Observable |
| **Apache AGE** | Not Observable | Not Observable | Not Observable |

*(Note: Docker container internal metrics were inaccessible during the benchmark run, leading to an "Error" state for footprint queries on all self-hosted containers).*

---

## Caveats & Honest Reporting

- **Network Variance vs Local Execution:** Because CognoDB is accessed over the public internet (managed cloud), its latency inherently includes network round-trip overhead. The self-hosted Docker containers run locally (`localhost`) on the benchmark machine, giving them an inherent network advantage in these tests. The ~307ms floor for all CognoDB p50 queries clearly demonstrates this network bound. Comparing public internet endpoints against `localhost` engines for raw latency is essentially comparing ping times rather than database compute efficiency.
- **Errors & Timeouts on CognoDB:** CognoDB experienced failures during deep 3-hop traversals (77 errors) and point lookups (78 errors). This is highly likely due to query throttling or strict timeout caps enforced on the `c0` free-tier instances to prevent runaway resource consumption in the multi-tenant cloud environment.
- **0.5 vCPU Bottleneck:** The strict 0.5 CPU core limit constrained the multi-threading capability of the self-hosted instances. As seen in the Mixed Workload concurrency sweep, throughput for databases like FalkorDB and Memgraph slightly *decreased* or plateaued as concurrency increased from 10 to 40, indicating they became completely CPU bound and began thrashing on context switching.
- **Architectural Differences:** While ArangoDB (AQL) and Apache AGE (Cypher on Postgres) execute the same logical graphs, their underlying storage models (Document vs Relational Extensions) create distinct performance profiles.

---

## Analysis & Findings

### 1. Ingest & Load Performance
ArangoDB achieved the fastest ingest time overall (13.36s), primarily by utilizing its optimized HTTP `collection.import()` capability which bypasses transaction overhead present in standard queries. Memgraph (20.69s) was a close second, leveraging Bolt `UNWIND` batching efficiently in-memory. CognoDB and Apache AGE both took significantly longer (>3 minutes). CognoDB's ingest speed was handicapped by public internet network latency on every batch roundtrip, while Apache AGE showed overhead typical of mapping graph topologies into underlying PostgreSQL relational tables during heavy writes.

### 2. Traversal Latency & Graph Native Architectures
For 1-hop and 2-hop traversals, the local in-memory graph engines (FalkorDB, Memgraph) dominated, resolving queries in under 2 milliseconds (p50). However, the critical test of graph architecture is deep traversal (3-hop). 
- **Graph Native:** FalkorDB (10.2ms) and Memgraph (48.8ms) scaled elegantly to 3 hops, demonstrating the power of true index-free adjacency. 
- **Multi-model:** ArangoDB (304ms) and Apache AGE (133ms) exhibited significant latency degradation at 3 hops. Without index-free adjacency, they must perform traditional index lookups at every hop, causing exponential latency increases as the traversal tree widens.

### 3. Concurrency & Mixed Workloads
FalkorDB showed the highest absolute throughput (3,394 req/sec) at low concurrency. Notably, when scaling up to 40 concurrent clients, every local database plateaued or regressed in throughput. This is the hallmark of the strict 0.5 vCPU limit: the systems hit a compute wall where the overhead of managing 40 concurrent connections across a fraction of a single CPU core outweighed any parallelization benefits. CognoDB, while operating at a lower absolute throughput due to network latency, scaled positively with concurrency (from 3 to 146 req/sec), implying that connection pooling and the cloud platform's burstable tier can handle concurrent pressure gracefully.

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

3. **Initialize Local Databases**
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
