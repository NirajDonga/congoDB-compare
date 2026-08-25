const neo4j = require('neo4j-driver');
const BaseDatabase = require('../core/BaseDatabase');

class Neo4jProvider extends BaseDatabase {
    constructor(uri, user, password) {
        super('Neo4j');
        this.uri = uri;
        this.user = user;
        this.password = password;
        this.driver = null;
    }

    async connect() {
        try {
            this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.password));
            await this.driver.getServerInfo();
            console.log(`[${this.name}] Connection established successfully!`);
        } catch (error) {
            console.error(`[${this.name}] Connection error:`, error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.driver) {
            await this.driver.close();
            console.log(`[${this.name}] Disconnected.`);
        }
    }

    async run(cypher, params = {}) {
        const session = this.driver.session();
        try {
            return await session.run(cypher, params);
        } finally {
            await session.close();
        }
    }

    async clearData() {
        await this.run('MATCH (n) DETACH DELETE n');
    }

    async createIndexes() {
        await this.run('CREATE INDEX IF NOT EXISTS FOR (n:Person) ON (n.id)');
    }

    async loadNodes(nodes, batchSize = BaseDatabase.DEFAULT_BATCH_SIZE) {
        let loaded = 0;
        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize);
            await this.run('UNWIND $batch AS row CREATE (n:Person {id: row.id})', { batch });
            loaded += batch.length;
        }
        return loaded;
    }

    async loadEdges(edges, batchSize = BaseDatabase.DEFAULT_BATCH_SIZE) {
        let loaded = 0;
        for (let i = 0; i < edges.length; i += batchSize) {
            const batch = edges.slice(i, i + batchSize);
            await this.run(
                `UNWIND $batch AS row
                 MATCH (a:Person {id: row.from}), (b:Person {id: row.to})
                 CREATE (a)-[:KNOWS]->(b)`,
                { batch }
            );
            loaded += batch.length;
        }
        return loaded;
    }
}

module.exports = Neo4jProvider;
