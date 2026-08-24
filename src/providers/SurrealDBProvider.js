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
}

module.exports = SurrealDBProvider;
