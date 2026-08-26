const Timer = require('./Timer');
const Stats = require('./Stats');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Map provider names to docker-compose service names for footprint collection
const DOCKER_SERVICE_MAP = {
    'CognoDB': 'cognodb',
    'FalkorDB': 'falkordb',
    'Memgraph': 'memgraph',
    'ArangoDB': 'arangodb',
    'ApacheAGE': 'age'
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

            try {
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
            } catch (error) {
                console.error(`[${provider.name}] Ingest failed: ${error.message}`);
                this.results[provider.name].ingest.error = error.message;
            }
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

            // Skip queries if ingest failed (no data to query)
            if (this.results[provider.name].ingest?.error) {
                console.log(`[${provider.name}] Skipping queries — ingest failed.`);
                continue;
            }

            try {
                // Cold-start measurement (before any warm-up)
                console.log(`[${provider.name}] Measuring cold-start latencies...`);
                let coldLatencies = [];
                for (let i = 0; i < 10; i++) {
                    try {
                        const { latencyMs } = await Timer.measure(() => provider.traversal(sampleNodes[i].id, 1));
                        coldLatencies.push(latencyMs);
                    } catch (err) { /* skip failed iteration */ }
                }
                this.results[provider.name].queries.coldStart1Hop = Stats.compute(coldLatencies);
                console.log(`[${provider.name}] Cold 1-hop: p50 ${this.results[provider.name].queries.coldStart1Hop.p50}ms, p95 ${this.results[provider.name].queries.coldStart1Hop.p95}ms`);

                // Warm-up
                console.log(`[${provider.name}] Warming up...`);
                for (let i = 0; i < 20; i++) {
                    try {
                        await provider.traversal(sampleNodes[i % sampleNodes.length].id, 1);
                        await provider.pointLookup(sampleNodes[i % sampleNodes.length].id);
                    } catch (err) { /* ignore warm-up errors */ }
                }

                // Helper to run a benchmark workload with per-iteration error handling
                const benchmarkWorkload = async (label, iterCount, fn) => {
                    let latencies = [];
                    let errors = 0;
                    for (let i = 0; i < iterCount; i++) {
                        try {
                            const { latencyMs } = await Timer.measure(() => fn(i));
                            latencies.push(latencyMs);
                        } catch (err) {
                            errors++;
                        }
                    }
                    const stats = Stats.compute(latencies);
                    stats.errors = errors;
                    if (errors > 0) console.warn(`[${provider.name}] ${label}: ${errors}/${iterCount} queries failed`);
                    return stats;
                };

                // Traversal 1-hop
                this.results[provider.name].queries.traversal1Hop = await benchmarkWorkload('1-hop', runs, (i) => provider.traversal(sampleNodes[i].id, 1));
                console.log(`[${provider.name}] 1-hop: p50 ${this.results[provider.name].queries.traversal1Hop.p50}ms, p95 ${this.results[provider.name].queries.traversal1Hop.p95}ms`);

                // Traversal 2-hop
                this.results[provider.name].queries.traversal2Hop = await benchmarkWorkload('2-hop', runs, (i) => provider.traversal(sampleNodes[i].id, 2));
                console.log(`[${provider.name}] 2-hop: p50 ${this.results[provider.name].queries.traversal2Hop.p50}ms, p95 ${this.results[provider.name].queries.traversal2Hop.p95}ms`);

                // Traversal 3-hop
                this.results[provider.name].queries.traversal3Hop = await benchmarkWorkload('3-hop', runs, (i) => provider.traversal(sampleNodes[i].id, 3));
                console.log(`[${provider.name}] 3-hop: p50 ${this.results[provider.name].queries.traversal3Hop.p50}ms, p95 ${this.results[provider.name].queries.traversal3Hop.p95}ms`);

                // Point Lookup
                this.results[provider.name].queries.pointLookup = await benchmarkWorkload('Point Lookup', runs, (i) => provider.pointLookup(sampleNodes[i].id));
                console.log(`[${provider.name}] Point Lookup: p50 ${this.results[provider.name].queries.pointLookup.p50}ms`);

                // Indexed Lookup
                this.results[provider.name].queries.indexedLookup = await benchmarkWorkload('Indexed Lookup', runs, (i) => provider.indexedLookup('nodeId', sampleNodes[i].id));
                console.log(`[${provider.name}] Indexed Lookup: p50 ${this.results[provider.name].queries.indexedLookup.p50}ms`);

                // Aggregation
                this.results[provider.name].queries.aggregation = await benchmarkWorkload('Aggregation', runs, () => provider.aggregation());
                console.log(`[${provider.name}] Aggregation: p50 ${this.results[provider.name].queries.aggregation.p50}ms, p95 ${this.results[provider.name].queries.aggregation.p95}ms`);
            } catch (error) {
                console.error(`[${provider.name}] Query benchmark failed: ${error.message}`);
                this.results[provider.name].queries.error = error.message;
            }
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
