# Graph Database Benchmark Suite

This repository contains a benchmarking suite designed to compare the performance of CognoDB Cloud against four other prominent graph databases: Neo4j, Memgraph, ArangoDB, and SurrealDB. 

## Methodology & Fairness

To ensure a rigorous and completely fair evaluation, this benchmark ensures that **all databases operate under the exact same resource constraints**. 

Comparing databases with unequal hardware (e.g., a managed free tier vs. a paid tier, or unconstrained local deployments) introduces methodology errors. Therefore, this benchmark uses Docker to strictly cap the resources of the four self-hosted databases to exactly match the CognoDB free tier specifications.

### Database Resource Specifications

All five databases in this benchmark are capped at **0.5 vCPUs** and **256 MB of RAM**:

| Database | Deployment Type | vCPU Allocation | RAM Allocation | Storage Allocation |
| :--- | :--- | :--- | :--- | :--- |
| **CognoDB** | Managed Cloud (c0 Free Tier) | 0.5 (Burstable) | 256 MB | 1 GB |
| **Neo4j** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | Local Disk |
| **Memgraph** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | Local Disk |
| **ArangoDB** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | Local Disk |
| **SurrealDB** | Local Docker Container | 0.5 (Hard limit) | 256 MB (Hard limit) | Local Disk |

*(Note: The strict resource capping for the local containers is enforced via `deploy.resources.limits` in the `docker-compose.yml` file).*
