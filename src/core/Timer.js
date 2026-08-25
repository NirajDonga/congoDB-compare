class Timer {
    static async measure(fn) {
        const start = process.hrtime.bigint();
        const result = await fn();
        const end = process.hrtime.bigint();
        return {
            result,
            latencyMs: Number(end - start) / 1000000.0
        };
    }
}

module.exports = Timer;
