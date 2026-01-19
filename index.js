// ============================================================
// AFK Bot Configuration
// ============================================================
// You can edit the settings below to customize the bot.

const CONFIG = {
    // Server IP address (e.g., 'play.example.com' or '127.0.0.1')
    host: '185.107.192.63',

    // Server port (default Minecraft port is 25565)
    port: 62782,

    // Bot username (this is what the bot will be called in-game)
    username: '_AfkBot',

    // Delay in milliseconds before sending /afk after spawning (3000 = 3 seconds)
    afkDelay: 3000,

    // Delay in milliseconds before reconnecting after being kicked (3000 = 3 seconds)
    reconnectDelay: 3000,

    // Hunger threshold to start eating (max is 20). 50% hunger = 10.
    hungerThreshold: 10,

    // Health threshold to eat even if not hungry (max is 20)
    healthThreshold: 10,

    // Terminal status heartbeat (prints a compact status line periodically)
    statusIntervalMs: 60000,

    // Minimum time between repeated logs of the same kind
    logThrottleMs: {
        hunger: 30000,
        eatAttempt: 15000,
        noFood: 30000,
        fullHunger: 30000,
        afk: 15000,
        connection: 3000
    }
}

// ============================================================
// DO NOT EDIT BELOW THIS LINE UNLESS YOU KNOW WHAT YOU'RE DOING
// ============================================================

const mineflayer = require('mineflayer')
const autoEat = require('mineflayer-auto-eat').loader

let isAfk = false

function createStatusLogger() {
    const lastByKey = new Map()
    function stamp() {
        const d = new Date()
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        const ss = String(d.getSeconds()).padStart(2, '0')
        return `${hh}:${mm}:${ss}`
    }

    /**
     * Logs a message, with optional de-dupe & throttling per key.
     * If repeats are suppressed, the next emitted log will include the suppressed count.
     */
    function log(key, message, minIntervalMs = 0) {
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
        console.log(`[${stamp()}] ${message}${suffix}`)
    }

    return { log }
}

function getEdibleInventorySummary(bot) {
    const items = bot.inventory?.items?.() ?? []
    const foodsByName = bot.registry && bot.registry.foodsByName ? bot.registry.foodsByName : null

    if (!foodsByName) {
        // Fallback when we can't reliably determine edibility for this version.
        return { edibleCount: 0, edibleNames: [] }
    }

    const banned = new Set(bot.autoEat?.options?.bannedFood ?? [])
    const edible = items.filter(it => foodsByName[it.name] && !banned.has(it.name))

    const counts = new Map()
    for (const it of edible) {
        counts.set(it.name, (counts.get(it.name) ?? 0) + it.count)
    }
    const edibleNames = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `${name}x${count}`)

    return { edibleCount: edible.length, edibleNames }
}

const EAT_COOLDOWN_MS = 4000

// Global reconnect state - ensures only ONE reconnection timer and ONE bot instance
let reconnectTimer = null
let currentBot = null

function scheduleReconnect(delay = CONFIG.reconnectDelay) {
    if (reconnectTimer) return // Already scheduled

    const logger = createStatusLogger()
    logger.log('reconnect', `Reconnecting in ${delay / 1000}s...`, CONFIG.logThrottleMs.connection)

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        createBot()
    }, delay)
}

function createBot() {
    // Clean up any existing bot
    if (currentBot) {
        try {
            currentBot.removeAllListeners()
            currentBot.quit()
        } catch (e) { /* ignore */ }
        currentBot = null
    }

    const logger = createStatusLogger()
    logger.log('connect', `Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username}...`, CONFIG.logThrottleMs.connection)

    const bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username
    })
    currentBot = bot

    // Load auto-eat plugin
    bot.loadPlugin(autoEat)

    bot.on('login', () => {
        logger.log('login', 'Bot has logged in.', CONFIG.logThrottleMs.connection)
    })

    bot.on('spawn', () => {
        logger.log('spawn', `Bot spawned. Waiting ${CONFIG.afkDelay / 1000}s to send /afk...`, CONFIG.logThrottleMs.connection)

        // Configure auto-eat
        bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: CONFIG.hungerThreshold,
            bannedFood: ['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish']
        }

        // Ensure auto-eat is enabled
        if (typeof bot.autoEat.enable === 'function') {
            bot.autoEat.enable()
        }

        setTimeout(() => {
            bot.chat('/afk')
            logger.log('afk-on', 'Chatted: /afk (AFK mode on).', CONFIG.logThrottleMs.afk)
            isAfk = true
        }, CONFIG.afkDelay)

        // Periodic status heartbeat (non-spammy)
        let lastHeartbeatAt = 0
        const statusTimer = setInterval(() => {
            const now = Date.now()
            if (now - lastHeartbeatAt < CONFIG.statusIntervalMs) return
            lastHeartbeatAt = now

            const afkText = isAfk ? 'AFK' : 'ACTIVE'
            const food = typeof bot.food === 'number' ? bot.food : '?'
            const health = typeof bot.health === 'number' ? bot.health.toFixed(1) : '?'
            logger.log('heartbeat', `Status: ${afkText} | health=${health} | food=${food} | eating=${isEating ? 'yes' : 'no'}`)
        }, Math.max(5000, Math.min(CONFIG.statusIntervalMs, 60000)))

        bot.once('end', () => clearInterval(statusTimer))
    })

    // Health monitoring - eat if low health (but don't call if already eating!)
    let isEating = false;
    let lastEatAttemptAt = 0;
    let lastFood = null
    let lastHealth = null

    function tryEat(reason) {
        const now = Date.now()
        if (isEating) return
        if (now - lastEatAttemptAt < EAT_COOLDOWN_MS) return
        if (bot.food >= 20) {
            // Can't eat when full hunger on most servers
            logger.log('full-hunger', `${reason} Hunger is full (food=${bot.food}). Not eating.`, CONFIG.logThrottleMs.fullHunger)
            return
        }

        lastEatAttemptAt = now
        const inv = getEdibleInventorySummary(bot)
        if (inv.edibleCount === 0) {
            logger.log('no-food', `${reason} Bot is hungry but found no edible food in inventory.`, CONFIG.logThrottleMs.noFood)
        } else {
            const top = inv.edibleNames.length ? ` (${inv.edibleNames.join(', ')})` : ''
            logger.log('eat-attempt', `${reason} Bot is trying to eat from inventory${top}... (health=${bot.health.toFixed(1)}, food=${bot.food})`, CONFIG.logThrottleMs.eatAttempt)
        }
        try {
            bot.autoEat.eat()
        } catch (err) {
            // Ignore "Already eating" and similar transient errors
        }
    }

    bot.on('autoeat_started', () => {
        logger.log('eat-start', 'Bot started eating.', 0)
        isEating = true;
        if (isAfk) {
            isAfk = false;
            logger.log('afk-off', 'AFK mode off (eating).', CONFIG.logThrottleMs.afk)
        }
    });

    bot.on('autoeat_finished', () => {
        logger.log('eat-finish', `Bot finished eating. (health=${bot.health.toFixed(1)}, food=${bot.food})`, 0)
        isEating = false;
        setTimeout(() => {
            if (!isAfk) {
                bot.chat('/afk');
                logger.log('afk-on', 'Returned to /afk after eating (AFK mode on).', CONFIG.logThrottleMs.afk)
                isAfk = true;
            }
        }, 1000);
    });

    bot.on('autoeat_stopped', () => {
        // More specific reason if we can infer it
        if (bot.food >= 20) {
            logger.log('eat-stop', 'Auto-eat stopped (hunger full).', CONFIG.logThrottleMs.fullHunger)
        } else {
            logger.log('eat-stop', 'Auto-eat stopped (no food / cannot eat).', CONFIG.logThrottleMs.noFood)
        }
        isEating = false;
        if (!isAfk) {
            setTimeout(() => {
                bot.chat('/afk');
                logger.log('afk-on', 'Returned to /afk (AFK mode on).', CONFIG.logThrottleMs.afk)
                isAfk = true;
            }, 1000);
        }
    });

    bot.on('autoeat_error', (err) => {
        const msg = err && err.message ? err.message : String(err)
        logger.log('eat-error', `Auto-eat error: ${msg}`, 0)
        isEating = false
    })

    bot.on('health', () => {
        // Scenario logs (throttled): hunger/health changed, hungry state, seeking food, etc.
        if (typeof bot.food === 'number' && bot.food !== lastFood) {
            lastFood = bot.food
            if (bot.food <= CONFIG.hungerThreshold) {
                logger.log('hunger-low', `Bot is getting hungry (food=${bot.food} <= ${CONFIG.hungerThreshold}).`, CONFIG.logThrottleMs.hunger)
            } else if (bot.food >= 18) {
                logger.log('hunger-ok', `Bot hunger looks OK now (food=${bot.food}).`, CONFIG.logThrottleMs.hunger)
            }
        }

        if (typeof bot.health === 'number' && bot.health !== lastHealth) {
            lastHealth = bot.health
            if (bot.health <= CONFIG.healthThreshold) {
                logger.log('health-low', `Bot health is low (health=${bot.health.toFixed(1)} <= ${CONFIG.healthThreshold}).`, CONFIG.logThrottleMs.hunger)
            }
        }

        // Requirements:
        // - If hunger <= 50% (food <= 10), eat
        // - Or if low health and can eat, eat
        if (bot.food <= CONFIG.hungerThreshold) {
            logger.log('seek-food', 'Bot is trying to find food in inventory...', CONFIG.logThrottleMs.eatAttempt)
            tryEat(`[HUNGER<=${CONFIG.hungerThreshold}]`)
            return
        }

        if (bot.health <= CONFIG.healthThreshold) {
            logger.log('seek-food', 'Bot is trying to find food in inventory (low health)...', CONFIG.logThrottleMs.eatAttempt)
            tryEat(`[LOW_HEALTH<=${CONFIG.healthThreshold}]`)
        }
    });


    bot.on('kicked', (reason) => {
        const reasonStr = JSON.stringify(reason)
        logger.log('kicked', `Kicked: ${reasonStr}`, 0)

        // If throttled, wait longer (e.g. 10 seconds)
        if (reasonStr.toLowerCase().includes('throttl')) {
            scheduleReconnect(10000)
        } else {
            scheduleReconnect()
        }
    })

    bot.on('error', (err) => {
        logger.log('error', `Error: ${err.message}`, 0)
        scheduleReconnect()
    })

    bot.on('end', (reason) => {
        logger.log('end', `Disconnected: ${reason}`, 0)
        scheduleReconnect()
    })
}

createBot()

