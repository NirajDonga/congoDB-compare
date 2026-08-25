const Timer = require('./Timer');
const Stats = require('./Stats');
const fs = require('fs');
const path = require('path');

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

            // Aggregation (fewer runs since it touches whole graph)
            latencies = [];
            for (let i = 0; i < Math.min(runs, 10); i++) {
                const { latencyMs } = await Timer.measure(() => provider.aggregation());
                latencies.push(latencyMs);
            }
            this.results[provider.name].queries.aggregation = Stats.compute(latencies);
            console.log(`[${provider.name}] Aggregation: p50 ${this.results[provider.name].queries.aggregation.p50}ms`);
        }
    }

    async runMixedWorkload(concurrency = 10, writeRatio = 0.2, durationSeconds = 10) {
        console.log(`\n--- MIXED WORKLOAD BENCHMARK (${concurrency} clients, ${100 - writeRatio * 100}% read / ${writeRatio * 100}% write) ---`);
        const { nodes } = this.dataLoader.load();

        for (const provider of this.providers) {
            console.log(`\n[${provider.name}] Starting mixed workload...`);
            this.results[provider.name].mixed = {};

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
            this.results[provider.name].mixed.queriesPerSec = queriesPerSec;
            console.log(`[${provider.name}] Sustained throughput: ${queriesPerSec} queries/sec`);
        }
    }

    outputResults() {
        console.log('\n--- BENCHMARK SUMMARY ---');
        const summary = {};
        for (const [provider, res] of Object.entries(this.results)) {
            summary[provider] = {
                'Nodes/sec': res.ingest?.nodesPerSec || '-',
                'Edges/sec': res.ingest?.edgesPerSec || '-',
                '1-Hop p50/p95': `${res.queries?.traversal1Hop?.p50 || '-'}/${res.queries?.traversal1Hop?.p95 || '-'}`,
                '2-Hop p50/p95': `${res.queries?.traversal2Hop?.p50 || '-'}/${res.queries?.traversal2Hop?.p95 || '-'}`,
                '3-Hop p50/p95': `${res.queries?.traversal3Hop?.p50 || '-'}/${res.queries?.traversal3Hop?.p95 || '-'}`,
                'Pt Lookup p50/p95': `${res.queries?.pointLookup?.p50 || '-'}/${res.queries?.pointLookup?.p95 || '-'}`,
                'Idx Lookup p50/p95': `${res.queries?.indexedLookup?.p50 || '-'}/${res.queries?.indexedLookup?.p95 || '-'}`,
                'Aggr p50/p95': `${res.queries?.aggregation?.p50 || '-'}/${res.queries?.aggregation?.p95 || '-'}`,
                'Mixed Q/sec': res.mixed?.queriesPerSec || '-'
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
