require('dotenv').config();

const CognoDBProvider = require('./src/providers/CognoDBProvider');
const FalkorDBProvider = require('./src/providers/FalkorDBProvider');
const MemgraphProvider = require('./src/providers/MemgraphProvider');
const ArangoDBProvider = require('./src/providers/ArangoDBProvider');
const AgeProvider = require('./src/providers/AgeProvider');
const DataLoader = require('./src/core/DataLoader');
const BenchmarkRunner = require('./src/core/BenchmarkRunner');

async function main() {
    console.log("=== Starting Graph Database Benchmark ===");

    const providers = [
        new CognoDBProvider(process.env.COGNODB_URI, process.env.COGNODB_USER, process.env.COGNODB_PASSWORD),
        new FalkorDBProvider(process.env.FALKORDB_URI),
        new MemgraphProvider(process.env.MEMGRAPH_URI, process.env.MEMGRAPH_USER, process.env.MEMGRAPH_PASSWORD),
        new ArangoDBProvider(process.env.ARANGODB_URI, process.env.ARANGODB_USER, process.env.ARANGODB_PASSWORD, process.env.ARANGODB_DB),
        new AgeProvider(process.env.AGE_URI)
    ];
    const connectedProviders = [];
    for (const provider of providers) {
        try {
            await provider.connect();
            connectedProviders.push(provider);
        } catch (error) {
            console.error(`Failed to connect to ${provider.name}. Check your credentials and ensure Docker is running.`);
        }
    }

    if (connectedProviders.length === 0) {
        console.error("No databases connected. Exiting.");
        return;
    }

    // Run benchmarks
    const DataLoader = require('./src/core/DataLoader');
    const BenchmarkRunner = require('./src/core/BenchmarkRunner');
    const loader = new DataLoader('./data/nodes.json', './data/edges.json');
    const runner = new BenchmarkRunner(connectedProviders, loader);

    try {
        await runner.runIngest();
        await runner.runQueries();
        await runner.runMixedWorkload();
        await runner.runFootprint();
        runner.outputResults();
    } catch (error) {
        console.error('Error during benchmark:', error);
    }

    for (const provider of providers) {
        try {
            await provider.disconnect();
        } catch (error) {
            console.error(`Failed to disconnect from ${provider.name}.`);
        }
    }
}

main();
