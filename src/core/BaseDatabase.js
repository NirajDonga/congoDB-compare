class BaseDatabase {
    constructor(name) {
        this.name = name;
        if (this.constructor === BaseDatabase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    async connect() {
        throw new Error("Method 'connect()' must be implemented.");
    }

    async disconnect() {
        throw new Error("Method 'disconnect()' must be implemented.");
    }
}

module.exports = BaseDatabase;
