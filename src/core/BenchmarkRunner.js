const Timer = require('./Timer');
const Stats = require('./Stats');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Map provider names to docker-compose service names for footprint collection
const DOCKER_SERVICE_MAP = {
    'Neo4j': 'neo4j',
    'Memgraph': 'memgraph',
    'ArangoDB': 'arangodb',
    'SurrealDB': 'surrealdb',
};

class BenchmarkRunner {
    constructor(providers, dataLoader) {
        this.providers = providers;
        this.dataLoader = dataLoader; // e.g., loads Enron dataset
        this.results = {};
    }

    async runIngest() {
        console.log('\n--- INGEST THROUGHPUT BENCHMARK ---');
        const { nodes, edges } = this.dataLoader.load();
        
        for (const provider of this.providers) {
            console.log(`\n[${provider.name}] Starting ingest benchmark...`);
            this.results[provider.name] = { ingest: {} };

            await provider.clearData();
            await provider.createIndexes();

            const { latencyMs: nodesTime } = await Timer.measure(async () => {
                await provider.loadNodes(nodes);
            });
            const nodesPerSec = Math.floor(nodes.length / (nodesTime / 1000));
            this.results[provider.name].ingest.nodesPerSec = nodesPerSec;
            console.log(`[${provider.name}] Nodes: ${nodesPerSec} / sec (${nodesTime.toFixed(2)} ms)`);

            const { latencyMs: edgesTime } = await Timer.measure(async () => {
                await provider.loadEdges(edges);
            });
            const edgesPerSec = Math.floor(edges.length / (edgesTime / 1000));
            this.results[provider.name].ingest.edgesPerSec = edgesPerSec;
            console.log(`[${provider.name}] Edges: ${edgesPerSec} / sec (${edgesTime.toFixed(2)} ms)`);

            const totalLoadTime = nodesTime + edgesTime;
            this.results[provider.name].ingest.totalLoadTimeMs = totalLoadTime;
            console.log(`[${provider.name}] Total Load Time: ${totalLoadTime.toFixed(2)} ms`);
        }
    }

    async runQueries(runs = 100) {
        console.log('\n--- QUERY LATENCY BENCHMARK ---');
        const { nodes } = this.dataLoader.load();
        const sampleNodes = [];
        for (let i = 0; i < runs; i++) {
            sampleNodes.push(nodes[Math.floor(Math.random() * nodes.length)]);
        }

        for (const provider of this.providers) {
            console.log(`\n[${provider.name}] Starting query benchmarks...`);
            this.results[provider.name] = this.results[provider.name] || {};
            this.results[provider.name].queries = {};

            // Cold-start measurement (before any warm-up)
            console.log(`[${provider.name}] Measuring cold-start latencies...`);
            let coldLatencies = [];
            for (let i = 0; i < 10; i++) {
                const { latencyMs } = await Timer.measure(() => provider.traversal(sampleNodes[i].id, 1));
                coldLatencies.push(latencyMs);
            }
            this.results[provider.name].queries.coldStart1Hop = Stats.compute(coldLatencies);
            console.log(`[${provider.name}] Cold 1-hop: p50 ${this.results[provider.name].queries.coldStart1Hop.p50}ms, p95 ${this.results[provider.name].queries.coldStart1Hop.p95}ms`);

            // Warm-up
            console.log(`[${provider.name}] Warming up...`);
            for (let i = 0; i < 20; i++) {
                await provider.traversal(sampleNodes[i % sampleNodes.length].id, 1);
                await provider.pointLookup(sampleNodes[i % sampleNodes.length].id);
            }

            // Traversal 1-hop
            let latencies = [];
            for (const node of sampleNodes) {
                const { latencyMs } = await Timer.measure(() => provider.traversal(node.id, 1));
                latencies.push(latencyMs);
            }
            this.results[provider.name].queries.traversal1Hop = Stats.compute(latencies);
            console.log(`[${provider.name}] 1-hop: p50 ${this.results[provider.name].queries.traversal1Hop.p50}ms, p95 ${this.results[provider.name].queries.traversal1Hop.p95}ms`);

            // Traversal 2-hop
            latencies = [];
            for (const node of sampleNodes) {
                const { latencyMs } = await Timer.measure(() => provider.traversal(node.id, 2));
                latencies.push(latencyMs);
            }
            this.results[provider.name].queries.traversal2Hop = Stats.compute(latencies);
            console.log(`[${provider.name}] 2-hop: p50 ${this.results[provider.name].queries.traversal2Hop.p50}ms, p95 ${this.results[provider.name].queries.traversal2Hop.p95}ms`);

            // Traversal 3-hop
            latencies = [];
            for (const node of sampleNodes) {
                const { latencyMs } = await Timer.measure(() => provider.traversal(node.id, 3));
                latencies.push(latencyMs);
            }
            this.results[provider.name].queries.traversal3Hop = Stats.compute(latencies);
            console.log(`[${provider.name}] 3-hop: p50 ${this.results[provider.name].queries.traversal3Hop.p50}ms, p95 ${this.results[provider.name].queries.traversal3Hop.p95}ms`);

            // Point Lookup
            latencies = [];
            for (const node of sampleNodes) {
                const { latencyMs } = await Timer.measure(() => provider.pointLookup(node.id));
                latencies.push(latencyMs);
            }
            this.results[provider.name].queries.pointLookup = Stats.compute(latencies);
            console.log(`[${provider.name}] Point Lookup: p50 ${this.results[provider.name].queries.pointLookup.p50}ms`);

            // Indexed Lookup
            latencies = [];
            for (const node of sampleNodes) {
                const { latencyMs } = await Timer.measure(() => provider.indexedLookup('nodeId', node.id));
                latencies.push(latencyMs);
            }
            this.results[provider.name].queries.indexedLookup = Stats.compute(latencies);
            console.log(`[${provider.name}] Indexed Lookup: p50 ${this.results[provider.name].queries.indexedLookup.p50}ms`);

            // Aggregation
            latencies = [];
            for (let i = 0; i < runs; i++) {
                const { latencyMs } = await Timer.measure(() => provider.aggregation());
                latencies.push(latencyMs);
            }
            this.results[provider.name].queries.aggregation = Stats.compute(latencies);
            console.log(`[${provider.name}] Aggregation: p50 ${this.results[provider.name].queries.aggregation.p50}ms, p95 ${this.results[provider.name].queries.aggregation.p95}ms`);
        }
    }

    async runMixedWorkload(concurrencyLevels = [1, 10, 40], writeRatio = 0.2, durationSeconds = 10) {
        console.log(`\n--- MIXED WORKLOAD BENCHMARK (${concurrencyLevels.join('/')} clients, ${100 - writeRatio * 100}% read / ${writeRatio * 100}% write, ${durationSeconds}s per level) ---`);
        const { nodes } = this.dataLoader.load();

        for (const provider of this.providers) {
            this.results[provider.name].mixed = {};

            for (const concurrency of concurrencyLevels) {
                console.log(`\n[${provider.name}] Mixed workload @ ${concurrency} clients...`);

                let queryCount = 0;
                const endTime = Date.now() + (durationSeconds * 1000);

                const worker = async () => {
                    while (Date.now() < endTime) {
                        try {
                            const isWrite = Math.random() < writeRatio;
                            if (isWrite) {
                                const randomNode = { id: `new_node_${Math.floor(Math.random() * 1000000)}` };
                                await provider.writeNode(randomNode);
                            } else {
                                const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
                                await provider.pointLookup(randomNode.id);
                            }
                            queryCount++;
                        } catch (err) {
                            // Ignore individual query failures in mixed workload to keep hammering
                        }
                    }
                };

                const workers = [];
                for (let i = 0; i < concurrency; i++) {
                    workers.push(worker());
                }

                await Promise.all(workers);
                const queriesPerSec = Math.floor(queryCount / durationSeconds);
                this.results[provider.name].mixed[`concurrency_${concurrency}`] = queriesPerSec;
                console.log(`[${provider.name}] @ ${concurrency} clients: ${queriesPerSec} queries/sec`);
            }
        }
    }

    async runFootprint() {
        console.log('\n--- RESOURCE FOOTPRINT ---');

        for (const provider of this.providers) {
            this.results[provider.name].footprint = {};
            const serviceName = DOCKER_SERVICE_MAP[provider.name];

            if (!serviceName) {
                // Managed cloud (CognoDB) — not observable locally
                this.results[provider.name].footprint.memory = 'N/A (Managed)';
                this.results[provider.name].footprint.storage = 'N/A (Managed)';
                console.log(`[${provider.name}] Footprint: N/A (Managed cloud)`);
                continue;
            }

            try {
                // Get memory usage via docker stats
                const statsOutput = execSync(
                    `docker stats --no-stream --format "{{.MemUsage}}" $(docker compose ps -q ${serviceName})`,
                    { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', timeout: 10000 }
                ).trim();
                this.results[provider.name].footprint.memory = statsOutput || 'N/A';

                // Get container disk usage
                const sizeOutput = execSync(
                    `docker inspect --format="{{.SizeRw}}" $(docker compose ps -q ${serviceName})`,
                    { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', timeout: 10000 }
                ).trim();
                const sizeBytes = parseInt(sizeOutput, 10);
                const sizeMB = isNaN(sizeBytes) ? 'N/A' : `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
                this.results[provider.name].footprint.storage = sizeMB;

                console.log(`[${provider.name}] Memory: ${statsOutput} | Storage: ${sizeMB}`);
            } catch (err) {
                this.results[provider.name].footprint.memory = 'Error';
                this.results[provider.name].footprint.storage = 'Error';
                console.warn(`[${provider.name}] Could not collect footprint: ${err.message}`);
            }
        }
    }

    outputResults() {
        console.log('\n--- BENCHMARK SUMMARY ---');
        const summary = {};
        for (const [provider, res] of Object.entries(this.results)) {
            summary[provider] = {
                'Total Load (ms)': res.ingest?.totalLoadTimeMs?.toFixed(0) || '-',
                'Nodes/sec': res.ingest?.nodesPerSec || '-',
                'Edges/sec': res.ingest?.edgesPerSec || '-',
                '1-Hop p50/p95': `${res.queries?.traversal1Hop?.p50 || '-'}/${res.queries?.traversal1Hop?.p95 || '-'}`,
                '2-Hop p50/p95': `${res.queries?.traversal2Hop?.p50 || '-'}/${res.queries?.traversal2Hop?.p95 || '-'}`,
                '3-Hop p50/p95': `${res.queries?.traversal3Hop?.p50 || '-'}/${res.queries?.traversal3Hop?.p95 || '-'}`,
                'Pt Lookup p50/p95': `${res.queries?.pointLookup?.p50 || '-'}/${res.queries?.pointLookup?.p95 || '-'}`,
                'Idx Lookup p50/p95': `${res.queries?.indexedLookup?.p50 || '-'}/${res.queries?.indexedLookup?.p95 || '-'}`,
                'Aggr p50/p95': `${res.queries?.aggregation?.p50 || '-'}/${res.queries?.aggregation?.p95 || '-'}`,
                'Mixed 1c Q/s': res.mixed?.concurrency_1 || '-',
                'Mixed 10c Q/s': res.mixed?.concurrency_10 || '-',
                'Mixed 40c Q/s': res.mixed?.concurrency_40 || '-',
                'Cold 1-Hop p50': res.queries?.coldStart1Hop?.p50 || '-',
                'Memory': res.footprint?.memory || '-',
                'Storage': res.footprint?.storage || '-',
            };
        }
        console.table(summary);

        const resultsDir = path.join(__dirname, '..', '..', 'results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const resultsFile = path.join(resultsDir, 'benchmark_results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2), 'utf-8');
        console.log(`\nDetailed results saved to ${resultsFile}\n`);
    }
}

module.exports = BenchmarkRunner;
