const { Client } = require('pg');
const BaseDatabase = require('../core/BaseDatabase');

class AgeProvider extends BaseDatabase {
    constructor(uri, user, password) {
        super('ApacheAGE');
        // Parse the uri or construct standard pg connection
        this.client = new Client({
            connectionString: uri,
        });
    }

    async connect() {
        try {
            await this.client.connect();
            // Load the AGE extension and set search path
            await this.client.query(`CREATE EXTENSION IF NOT EXISTS age;`);
            await this.client.query(`LOAD 'age';`);
            await this.client.query(`SET search_path = ag_catalog, "$user", public;`);
            console.log(`[${this.name}] Connection established successfully!`);
        } catch (error) {
            console.error(`[${this.name}] Connection error:`, error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.end();
            console.log(`[${this.name}] Disconnected.`);
        }
    }

    async clearData() {
        try {
            await this.client.query(`SELECT drop_graph('benchmark', true);`);
        } catch (e) {
            // Ignore if graph doesn't exist
        }
        await this.client.query(`SELECT create_graph('benchmark');`);
    }

    async createIndexes() {
        // AGE uses Postgres B-Tree indexes on the properties field
        // But for simplicity in this benchmark, AGE's internal sequential scan or PG index can be defined
        try {
            await this.client.query(`
                CREATE INDEX IF NOT EXISTS person_nodeId_idx 
                ON benchmark."person" USING GIN (properties);
            `);
        } catch (e) {
            // It's fine if the label table doesn't exist yet, we'll index after loading if needed
            // Actually, in AGE, creating labels first is better
            await this.client.query(`SELECT create_vlabel('benchmark', 'person');`);
            await this.client.query(`SELECT create_elabel('benchmark', 'knows');`);
            await this.client.query(`
                CREATE INDEX IF NOT EXISTS person_nodeId_idx 
                ON benchmark."person" USING GIN (properties);
            `);
        }
    }

    async loadNodes(nodes, batchSize = 5000) {
        let loaded = 0;
        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize);
            const params = JSON.stringify({ batch: batch.map(n => ({ id: n.id })) });
            
            await this.client.query(`
                SELECT * FROM cypher('benchmark', $$
                    UNWIND $batch AS n
                    CREATE (:person {nodeId: n.id})
                $$, $1) as (v agtype);
            `, [params]);
            
            loaded += batch.length;
        }
        return loaded;
    }

    async loadEdges(edges, batchSize = 5000) {
        let loaded = 0;
        for (let i = 0; i < edges.length; i += batchSize) {
            const batch = edges.slice(i, i + batchSize);
            const params = JSON.stringify({ batch: batch.map(e => ({ from: e.from, to: e.to })) });
            
            await this.client.query(`
                SELECT * FROM cypher('benchmark', $$
                    UNWIND $batch AS e
                    MATCH (a:person {nodeId: e.from}), (b:person {nodeId: e.to})
                    CREATE (a)-[:knows]->(b)
                $$, $1) as (v agtype);
            `, [params]);
            
            loaded += batch.length;
        }
        return loaded;
    }

    async traversal(startNodeId, hops) {
        const query = `
            SELECT * FROM cypher('benchmark', $$
                MATCH (p:person {nodeId: ${startNodeId}})-[:knows*${hops}]->(f:person)
                RETURN f.nodeId
            $$) as (nodeId agtype);
        `;
        const res = await this.client.query(query);
        const nodes = res.rows.map(r => parseInt(r.nodeid, 10));
        return [...new Set(nodes)];
    }

    async pointLookup(nodeId) {
        const query = `
            SELECT * FROM cypher('benchmark', $$
                MATCH (p:person {nodeId: ${nodeId}})
                RETURN p
            $$) as (p agtype);
        `;
        const res = await this.client.query(query);
        return res.rows.length > 0 ? res.rows[0].p : null;
    }

    async indexedLookup(property, value) {
        const query = `
            SELECT * FROM cypher('benchmark', $$
                MATCH (p:person {${property}: ${value}})
                RETURN p
            $$) as (p agtype);
        `;
        const res = await this.client.query(query);
        return res.rows.map(r => r.p);
    }

    async aggregation() {
        const query = `
            SELECT * FROM cypher('benchmark', $$
                MATCH ()-[r:knows]->()
                RETURN count(r)
            $$) as (c agtype);
        `;
        const res = await this.client.query(query);
        return [{ key: 'KNOWS', count: parseInt(res.rows[0].c, 10) }];
    }

    async writeNode(node) {
        await this.client.query(`
            SELECT * FROM cypher('benchmark', $$
                CREATE (p:person {nodeId: ${node.id}})
            $$) as (v agtype);
        `);
    }
}

module.exports = AgeProvider;
