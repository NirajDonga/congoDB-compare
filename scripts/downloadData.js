const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const path = require('path');

const DATA_URL = 'https://snap.stanford.edu/data/email-Enron.txt.gz';
const DATA_DIR = path.join(__dirname, '..', 'data');
const GZ_FILE_PATH = path.join(DATA_DIR, 'email-Enron.txt.gz');
const TXT_FILE_PATH = path.join(DATA_DIR, 'email-Enron.txt');
const JSON_NODES_PATH = path.join(DATA_DIR, 'nodes.json');
const JSON_EDGES_PATH = path.join(DATA_DIR, 'edges.json');

async function downloadFile() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(GZ_FILE_PATH)) {
            console.log('Dataset already downloaded.');
            return resolve();
        }
        console.log(`Downloading dataset from ${DATA_URL}...`);
        const file = fs.createWriteStream(GZ_FILE_PATH);
        https.get(DATA_URL, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to get '${DATA_URL}' (${response.statusCode})`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('Download completed.');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(GZ_FILE_PATH, () => {});
            reject(err);
        });
    });
}

async function extractFile() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(TXT_FILE_PATH)) {
            console.log('Dataset already extracted.');
            return resolve();
        }
        console.log('Extracting gz file...');
        const fileContents = fs.createReadStream(GZ_FILE_PATH);
        const writeStream = fs.createWriteStream(TXT_FILE_PATH);
        const unzip = zlib.createGunzip();

        fileContents.pipe(unzip).pipe(writeStream).on('finish', (err) => {
            if (err) return reject(err);
            console.log('Extraction completed.');
            resolve();
        });
    });
}

async function parseAndSaveAsJSON() {
    if (fs.existsSync(JSON_NODES_PATH) && fs.existsSync(JSON_EDGES_PATH)) {
        console.log('JSON parsed files already exist.');
        return;
    }

    console.log('Parsing text file to generate nodes and edges JSON...');
    const data = fs.readFileSync(TXT_FILE_PATH, 'utf8');
    const lines = data.split('\n');

    const nodesSet = new Set();
    const edges = [];

    for (const line of lines) {
        if (line.startsWith('#') || line.trim() === '') continue; // Skip comments and empty lines
        const [from, to] = line.trim().split(/\s+/);
        if (from !== undefined && to !== undefined) {
            nodesSet.add(Number(from));
            nodesSet.add(Number(to));
            edges.push({ from: Number(from), to: Number(to) });
        }
    }

    const nodes = Array.from(nodesSet).map(id => ({ id }));
    
    console.log(`Parsed ${nodes.length} nodes and ${edges.length} edges.`);
    
    fs.writeFileSync(JSON_NODES_PATH, JSON.stringify(nodes, null, 2));
    fs.writeFileSync(JSON_EDGES_PATH, JSON.stringify(edges, null, 2));
    console.log('JSON data saved successfully to /data folder.');
}

async function main() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR);
        }
        await downloadFile();
        await extractFile();
        await parseAndSaveAsJSON();
        console.log('Data preparation finished successfully!');
    } catch (error) {
        console.error('Error preparing data:', error);
        process.exit(1);
    }
}

main();
