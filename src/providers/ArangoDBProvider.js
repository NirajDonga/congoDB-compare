const { Database } = require('arangojs');
const BaseDatabase = require('../core/BaseDatabase');

class ArangoDBProvider extends BaseDatabase {
    constructor(uri, user, password) {
        super('ArangoDB');
        this.uri = uri;
        this.user = user;
        this.password = password;
        this.db = null;
    }

    async connect() {
        try {
            this.db = new Database({
                url: this.uri,
                auth: { username: this.user, password: this.password }
            });
            const version = await this.db.version();
            console.log(`[${this.name}] Connection established successfully! Version: ${version.version}`);
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
        for (const name of ['persons', 'knows']) {
            const col = this.db.collection(name);
            if (await col.exists()) await col.drop();
        }
    }

    async createIndexes() {
        const persons = this.db.collection('persons');
        if (!(await persons.exists())) await persons.create();
        await persons.ensureIndex({ type: 'persistent', fields: ['nodeId'] });

        const knows = this.db.collection('knows');
        if (!(await knows.exists())) await knows.create({ type: 3 }); // 3 = edge collection
    }

    async loadNodes(nodes, batchSize = BaseDatabase.DEFAULT_BATCH_SIZE) {
        const col = this.db.collection('persons');
        let loaded = 0;
        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize).map(n => ({
                _key: String(n.id),
                nodeId: n.id,
            }));
            const result = await col.import(batch);
            loaded += result.created;
        }
        return loaded;
    }

    async loadEdges(edges, batchSize = BaseDatabase.DEFAULT_BATCH_SIZE) {
        const col = this.db.collection('knows');
        let loaded = 0;
        for (let i = 0; i < edges.length; i += batchSize) {
            const batch = edges.slice(i, i + batchSize).map(e => ({
                _from: `persons/${e.from}`,
                _to: `persons/${e.to}`,
            }));
            const result = await col.import(batch);
            loaded += result.created;
        }
        return loaded;
    }
}

module.exports = ArangoDBProvider;
