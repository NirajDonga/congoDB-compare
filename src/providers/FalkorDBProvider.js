const { FalkorDB } = require('falkordb');
const BaseDatabase = require('../core/BaseDatabase');

class FalkorDBProvider extends BaseDatabase {
    constructor(uri) {
        super('FalkorDB');
        this.uri = uri;
        this.db = null;
        this.graph = null;
    }

    async connect() {
        try {
            // Parse host:port from URI like "redis://localhost:6379" or "localhost:6379"
            let host = 'localhost';
            let port = 6379;
            if (this.uri) {
                const cleaned = this.uri.replace(/^redis:\/\//, '');
                const parts = cleaned.split(':');
                host = parts[0] || 'localhost';
                port = parseInt(parts[1], 10) || 6379;
            }
            this.db = await FalkorDB.connect({ host, port });
            this.graph = this.db.selectGraph('benchmark');
            console.log(`[${this.name}] Connection established successfully!`);
        } catch (error) {
            console.error(`[${this.name}] Connection error:`, error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.db) {
            this.db.close();
            console.log(`[${this.name}] Disconnected.`);
        }
    }

    async clearData() {
        try {
            // Delete all nodes and relationships
            await this.graph.query('MATCH (n) DETACH DELETE n');
        } catch (err) {
            // Graph may not exist yet, that's fine
        }
    }

    async createIndexes() {
        await this.graph.query('CREATE INDEX FOR (n:Person) ON (n.id)');
    }

    async loadNodes(nodes, batchSize = BaseDatabase.DEFAULT_BATCH_SIZE) {
        let loaded = 0;
        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize);
            // FalkorDB supports UNWIND with parameters
            await this.graph.query(
                'UNWIND $batch AS row CREATE (n:Person {id: row.id})',
                { params: { batch } }
            );
            loaded += batch.length;
        }
        return loaded;
    }

    async loadEdges(edges, batchSize = BaseDatabase.DEFAULT_BATCH_SIZE) {
        let loaded = 0;
        for (let i = 0; i < edges.length; i += batchSize) {
            const batch = edges.slice(i, i + batchSize);
            await this.graph.query(
                `UNWIND $batch AS row
                 MATCH (a:Person {id: row.from}), (b:Person {id: row.to})
                 CREATE (a)-[:KNOWS]->(b)`,
                { params: { batch } }
            );
            loaded += batch.length;
        }
        return loaded;
    }

    async traversal(startNodeId, hops) {
        const result = await this.graph.query(
            `MATCH (n:Person {id: $id})-[:KNOWS*${hops}..${hops}]->(m:Person) RETURN DISTINCT m.id AS id`,
            { params: { id: startNodeId } }
        );
        return result.data || [];
    }

    async pointLookup(nodeId) {
        const result = await this.graph.query(
            'MATCH (n:Person {id: $id}) RETURN n',
            { params: { id: nodeId } }
        );
        return result.data && result.data.length > 0 ? result.data[0] : null;
    }

    async indexedLookup(property, value) {
        const result = await this.graph.query(
            `MATCH (n:Person) WHERE n.${property} = $value RETURN n`,
            { params: { value } }
        );
        return result.data || [];
    }

    async aggregation() {
        const result = await this.graph.query(
            'MATCH ()-[r:KNOWS]->() RETURN type(r) AS key, count(r) AS count'
        );
        return result.data || [];
    }

    async writeNode(node) {
        await this.graph.query(
            'CREATE (n:Person {id: $id})',
            { params: { id: node.id } }
        );
    }
}

module.exports = FalkorDBProvider;
