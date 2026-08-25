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
                .map(e => `RELATE person:${e.from}->knows->person:${e.to}`)
                .join('; ');
            await this.db.query(statements);
            loaded += batch.length;
        }
        return loaded;
    }
}

module.exports = SurrealDBProvider;
