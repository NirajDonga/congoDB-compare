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
}

module.exports = ArangoDBProvider;
