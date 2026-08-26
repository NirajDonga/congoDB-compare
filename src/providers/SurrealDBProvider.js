const { Surreal } = require('surrealdb');
const BaseDatabase = require('../core/BaseDatabase');

class SurrealDBProvider extends BaseDatabase {
    constructor(uri, user, password) {
        super('SurrealDB');
        this.uri = uri;
        this.user = user;
        this.password = password;
        this.db = null;
    }

    async connect() {
        try {
            this.db = new Surreal();
            await this.db.connect(this.uri);
            await this.db.signin({
                username: this.user,
                password: this.password,
            });
            // Create namespace and database if they don't exist
            await this.db.query('DEFINE NAMESPACE IF NOT EXISTS benchmark');
            await this.db.query('DEFINE DATABASE IF NOT EXISTS benchmark');
            await this.db.use({ namespace: 'benchmark', database: 'benchmark' });
            console.log(`[${this.name}] Connection established successfully!`);
        } catch (error) {
            console.error(`[${this.name}] Connection error:`, error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.db) {
            await this.db.close();
            console.log(`[${this.name}] Disconnected.`);
        }
    }

    async clearData() {
        await this.db.query('REMOVE TABLE IF EXISTS person');
        await this.db.query('REMOVE TABLE IF EXISTS knows');
    }

    async createIndexes() {
        await this.db.query('DEFINE INDEX IF NOT EXISTS person_nodeId ON TABLE person COLUMNS nodeId');
    }

    async loadNodes(nodes, batchSize = BaseDatabase.DEFAULT_BATCH_SIZE) {
        let loaded = 0;
        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize).map(n => ({
                id: n.id,       // becomes record ID person:<id>
                nodeId: n.id,   // indexed property for lookups
            }));
            await this.db.insert('person', batch);
            loaded += batch.length;
        }
        return loaded;
    }

    async loadEdges(edges, batchSize = 500) {
        let loaded = 0;
        for (let i = 0; i < edges.length; i += batchSize) {
            const batch = edges.slice(i, i + batchSize);
            const statements = batch
                .map(e => {
                    const from = String(e.from).replace(/[^a-zA-Z0-9_]/g, '_');
                    const to = String(e.to).replace(/[^a-zA-Z0-9_]/g, '_');
                    return `RELATE person:${from}->knows->person:${to}`;
                })
                .join('; ');
            await this.db.query(statements);
            loaded += batch.length;
        }
        return loaded;
    }

    async traversal(startNodeId, hops) {
        const path = Array(hops).fill('->knows->person').join('');
        const query = `SELECT ${path}.nodeId AS nodes FROM person:${startNodeId}`;
        const [res] = await this.db.query(query);
        const nodes = res?.result?.[0]?.nodes || [];
        return [...new Set(nodes.flat(Infinity))];
    }

    async pointLookup(nodeId) {
        const [res] = await this.db.query('SELECT * FROM type::thing("person", $id)', { id: nodeId });
        return res?.result?.[0] || null;
    }

    async indexedLookup(property, value) {
        const [res] = await this.db.query(`SELECT * FROM person WHERE ${property} = $value`, { value });
        return res?.result || [];
    }

    async aggregation() {
        const [res] = await this.db.query('SELECT count() AS count FROM knows GROUP BY ALL');
        return [{ key: 'KNOWS', count: res?.result?.[0]?.count || 0 }];
    }

    async writeNode(node) {
        await this.db.insert('person', { id: node.id, nodeId: node.id });
    }
}

module.exports = SurrealDBProvider;
