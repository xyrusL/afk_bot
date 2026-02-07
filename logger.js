/**
 * Build a lightweight console logger with per-key duplicate suppression.
 */
function createLogger(options = {}) {
    const name = options.name ? String(options.name) : 'AFK'
    const lastByKey = new Map()

    /**
     * Format local time as HH:MM:SS for compact log prefixes.
     */
    function stamp() {
        const d = new Date()
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        const ss = String(d.getSeconds()).padStart(2, '0')
        return `${hh}:${mm}:${ss}`
    }

    /**
     * Emit one log entry and suppress repeated identical messages within interval.
     */
    function emit(level, key, message, minIntervalMs = 0) {
        const now = Date.now()
        const prev = key ? lastByKey.get(key) : undefined
        if (key && prev) {
            const within = minIntervalMs > 0 && (now - prev.lastAt) < minIntervalMs
            const same = prev.lastMessage === message
            if (within && same) {
                prev.suppressed += 1
                lastByKey.set(key, prev)
                return
            }
        }

        let suffix = ''
        if (key && prev && prev.suppressed > 0) {
            suffix = ` (suppressed ${prev.suppressed} repeats)`
        }

        if (key) {
            lastByKey.set(key, { lastAt: now, lastMessage: message, suppressed: 0 })
        }

        const levelTag = level ? `[${level}] ` : ''
        console.log(`[${stamp()}] [${name}] ${levelTag}${message}${suffix}`)
    }

    return {
        log: (key, message, minIntervalMs = 0) => emit('INFO', key, message, minIntervalMs),
        debug: (key, message, minIntervalMs = 0) => emit('DEBUG', key, message, minIntervalMs)
    }
}

module.exports = { createLogger }
