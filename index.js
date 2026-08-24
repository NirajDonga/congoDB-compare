require('dotenv').config();

const CognoDBProvider = require('./src/providers/CognoDBProvider');
const Neo4jProvider = require('./src/providers/Neo4jProvider');
const MemgraphProvider = require('./src/providers/MemgraphProvider');
const ArangoDBProvider = require('./src/providers/ArangoDBProvider');
const SurrealDBProvider = require('./src/providers/SurrealDBProvider');

async function main() {
    const providers = [
        new CognoDBProvider(process.env.COGNODB_URI, process.env.COGNODB_USER, process.env.COGNODB_PASSWORD),
        new Neo4jProvider(process.env.NEO4J_URI, process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
        new MemgraphProvider(process.env.MEMGRAPH_URI, process.env.MEMGRAPH_USER, process.env.MEMGRAPH_PASSWORD),
        new ArangoDBProvider(process.env.ARANGODB_URI, process.env.ARANGODB_USER, process.env.ARANGODB_PASSWORD),
        new SurrealDBProvider(process.env.SURREALDB_URI, process.env.SURREALDB_USER, process.env.SURREALDB_PASSWORD)
    ];
    for (const provider of providers) {
        try {
            await provider.connect();
        } catch (error) {
            console.error(`Failed to connect to ${provider.name}. Check your credentials and ensure Docker is running.`);
        }
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
