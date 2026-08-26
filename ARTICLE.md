# Starving the Graph: Benchmarking 5 Graph DBs on Half a CPU

We usually benchmark databases by throwing them on a 64-core AWS server and seeing what happens. But what if you strip away the compute and force them to run on the absolute bare minimum? 

I decided to benchmark **CognoDB Cloud's free tier** against four self-hosted graph databases: **FalkorDB**, **Memgraph**, **ArangoDB**, and **Apache AGE**. 

To make it a fair fight, I choked the Docker containers down to match CognoDB’s tiny free tier: **0.5 vCPUs and 512 MB RAM**. 

Here’s what breaks when you take off the training wheels.

## 1. Network Ping Ruins Everything
First off, comparing a cloud database to `localhost` is brutal. My local Docker containers responded in sub-milliseconds because they bypassed the internet entirely. CognoDB, on the other hand, had a hard floor of ~307ms for *every single query*. 

That's not CognoDB being slow; that's just the reality of network round-trip time (RTT) and TLS handshakes over the public web. 
*Takeaway:* The fastest graph engine in the world won't save you if your database is in a different region than your app server. Ping is king.

## 2. The 3-Hop Reality Check
A 1-hop query (find my friends) is easy. A 3-hop query (find my friends' friends' friends) is where architectures actually get tested. 

I tested three different setups:
- **True Graph (In-Memory):** FalkorDB and Memgraph. 
- **Multi-Model:** ArangoDB (document + graph).
- **Relational:** Apache AGE (graph on top of Postgres).

At 3 hops, the difference was wild:
- **FalkorDB:** 10 ms
- **Memgraph:** 48 ms
- **Apache AGE:** 133 ms
- **ArangoDB:** 304 ms

Why did Arango and AGE struggle? **Index lookups.** 
FalkorDB and Memgraph use "index-free adjacency." Relationships are just physical memory pointers. A 3-hop query is just jumping across memory addresses. ArangoDB and AGE don't have that—they have to run traditional index lookups at every single hop. When the traversal tree explodes at hop 3, those index lookups become a massive bottleneck.

## 3. The 0.5 CPU Wall
My favorite part of the test was running a concurrency sweep (1, 10, and 40 clients). 

At 1 client, **FalkorDB** crushed it with 3,394 requests per second. But when I cranked it up to 40 concurrent clients, *every single local database slowed down*. FalkorDB dropped to 2,847 req/sec. 

Why? We hit the compute wall. 
When you force 40 concurrent threads to run on half of a single CPU core, the system starts thrashing. The context-switching overhead completely eats up any parallelization benefits. 

Meanwhile, **CognoDB** scaled positively from 3 to 146 req/sec. It’s slower overall due to the network, but its cloud connection pooling and burstable compute handled the concurrency pressure way better than my starved local containers.

## The Bottom Line
If you need deep, multi-hop traversals, you need a native graph database with index-free adjacency. But if you're deploying on a tiny free-tier cloud instance, don't overthink the query engine—your network latency and connection pooling are going to dictate your performance. 

*(Want to run the benchmark yourself? The code, dataset, and Docker configs are up on my [GitHub Repository](#).)*
