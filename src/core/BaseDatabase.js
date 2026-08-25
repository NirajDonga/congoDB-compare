const DEFAULT_BATCH_SIZE = 1000;

class BaseDatabase {
    constructor(name) {
        this.name = name;
        if (this.constructor === BaseDatabase) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    // Lifecycle
    async connect() { this._notImpl('connect'); }
    async disconnect() { this._notImpl('disconnect'); }

    // Data management
    async clearData() { this._notImpl('clearData'); }
    async createIndexes() { this._notImpl('createIndexes'); }
    async loadNodes(nodes, batchSize = DEFAULT_BATCH_SIZE) { this._notImpl('loadNodes'); }
    async loadEdges(edges, batchSize = DEFAULT_BATCH_SIZE) { this._notImpl('loadEdges'); }

    // Queries
    async traversal(startNodeId, hops) { this._notImpl('traversal'); }
    async pointLookup(nodeId) { this._notImpl('pointLookup'); }
    async indexedLookup(property, value) { this._notImpl('indexedLookup'); }
    async aggregation() { this._notImpl('aggregation'); }

    // Write (mixed workload)
    async writeNode(node) { this._notImpl('writeNode'); }

    _notImpl(method) {
        throw new Error(`[${this.name}] ${method}() not implemented.`);
    }
}

BaseDatabase.DEFAULT_BATCH_SIZE = DEFAULT_BATCH_SIZE;

module.exports = BaseDatabase;
