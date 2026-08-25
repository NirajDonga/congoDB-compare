const Timer = require('./Timer');
const Stats = require('./Stats');

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
}

module.exports = BenchmarkRunner;
