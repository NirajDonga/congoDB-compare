class Stats {
    static compute(latencies) {
        if (!latencies || latencies.length === 0) {
            return { count: 0, p50: 0, p95: 0, p99: 0, mean: 0 };
        }

        const sorted = [...latencies].sort((a, b) => a - b);
        const len = sorted.length;

        const p50 = sorted[Math.floor(len * 0.50)];
        const p95 = sorted[Math.floor(len * 0.95)];
        const p99 = sorted[Math.floor(len * 0.99)];
        
        const sum = sorted.reduce((acc, val) => acc + val, 0);
        const mean = sum / len;

        return {
            count: len,
            mean: Number(mean.toFixed(2)),
            p50: Number(p50.toFixed(2)),
            p95: Number(p95.toFixed(2)),
            p99: Number(p99.toFixed(2))
        };
    }
}

module.exports = Stats;
