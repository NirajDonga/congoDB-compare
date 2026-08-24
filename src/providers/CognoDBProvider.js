const neo4j = require('neo4j-driver');
const BaseDatabase = require('../core/BaseDatabase');

class CognoDBProvider extends BaseDatabase {
    constructor(uri, user, password) {
        super('CognoDB');
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
}

module.exports = CognoDBProvider;
