const fs = require('fs');

class DataLoader {
    constructor(nodesPath, edgesPath) {
        this.nodesPath = nodesPath;
        this.edgesPath = edgesPath;
    }

    load() {
        console.log('Loading dataset into memory...');
        const nodes = JSON.parse(fs.readFileSync(this.nodesPath, 'utf8'));
        const edges = JSON.parse(fs.readFileSync(this.edgesPath, 'utf8'));
        console.log(`Loaded ${nodes.length} nodes and ${edges.length} edges.`);
        return { nodes, edges };
    }
}

module.exports = DataLoader;
