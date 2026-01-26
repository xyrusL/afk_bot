// ============================================================
// AFK Bot Configuration
// ============================================================
// You can edit the settings below to customize the bot.

const CONFIG = {
    // Server hostname 
    
    host: 'watermelon.deze.me',

    // Server port 
    port: 25565,

    // Bot username
    username: '_AfkBot',

    // Set to 'false' (or null) to auto-detect version.
    version: false,

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

    // Chest seeking (food) behavior
    enableChestSeek: true,
    chestScanRadius: 24,
    chestScanIntervalMs: 5000,
    chestEmptyCooldownMs: 300000,
    chestUnreachableCooldownMs: 120000,
    seekCooldownMs: 60000,
    maxSeekDurationMs: 45000,
    wanderStepBlocks: 10,
    returnAfkDelayMs: 3000,

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
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalNear } = goals
const { createLogger } = require('./logger')

let isAfk = false

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

function isEdibleItemName(bot, name) {
    const foodsByName = bot.registry && bot.registry.foodsByName ? bot.registry.foodsByName : null
    if (!foodsByName) return false
    const banned = new Set(bot.autoEat?.options?.bannedFood ?? [])
    return Boolean(foodsByName[name] && !banned.has(name))
}

function pickChestFoodItem(bot, chestItems) {
    for (const item of chestItems) {
        if (isEdibleItemName(bot, item.name) && item.count > 1) {
            return item
        }
    }
    return null
}

function posKey(pos) {
    return `${pos.x},${pos.y},${pos.z}`
}

function distanceSq(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    const dz = a.z - b.z
    return dx * dx + dy * dy + dz * dz
}

function withTimeout(promise, ms, label) {
    let timeoutId
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(label || 'timeout'))
        }, ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

const EAT_COOLDOWN_MS = 4000

// Global reconnect state - ensures only ONE reconnection timer and ONE bot instance
let reconnectTimer = null
let currentBot = null

function scheduleReconnect(delay = CONFIG.reconnectDelay) {
    if (reconnectTimer) return // Already scheduled

    const logger = createLogger({ name: 'AFK' })
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

    const logger = createLogger({ name: 'AFK' })
    logger.log('connect', `Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username}...`, CONFIG.logThrottleMs.connection)

    const bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: CONFIG.version || false
    })
    currentBot = bot

    // Load auto-eat plugin
    bot.loadPlugin(autoEat)
    bot.loadPlugin(pathfinder)

    bot.on('login', () => {
        logger.log('login', 'Bot has logged in.', CONFIG.logThrottleMs.connection)
    })

    bot.on('spawn', () => {
        logger.log('spawn', `Bot spawned. Waiting ${CONFIG.afkDelay / 1000}s to send /afk...`, CONFIG.logThrottleMs.connection)

        if (!homePos) {
            homePos = bot.entity.position.clone()
            logger.log('home-set', `Home position set at ${homePos.x.toFixed(1)}, ${homePos.y.toFixed(1)}, ${homePos.z.toFixed(1)}.`, 0)
        }

        if (!movements) {
            movements = new Movements(bot, bot.registry)
            bot.pathfinder.setMovements(movements)
        }

        // Configure auto-eat
        bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: CONFIG.hungerThreshold,
            bannedFood: ['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish']
        }

        // Disable built-in auto-eat listener to prevent conflict with our manual health listener below.
        // We will call bot.autoEat.eat() manually when we decide it's time.
        if (typeof bot.autoEat.disable === 'function') {
            bot.autoEat.disable()
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
            logger.log('heartbeat', `Status: ${afkText} | health=${health} | food=${food} | eating=${isEating ? 'yes' : 'no'} | seeking=${seekInProgress ? 'yes' : 'no'}`)
        }, Math.max(5000, Math.min(CONFIG.statusIntervalMs, 60000)))

        bot.once('end', () => clearInterval(statusTimer))
    })

    // Health monitoring - eat if low health (but don't call if already eating!)
    let isEating = false;
    let seekInProgress = false
    let seekCooldownUntil = 0
    let seekStartPos = null
    let homePos = null
    let movements = null
    let lastChestScanAt = 0
    let cachedChestPositions = []
    const chestMemory = new Map()
    let lastEatAttemptAt = 0;
    let lastFood = null
    let lastHealth = null
    // OPTIMIZATION: Debounce health checks to reduce event processing frequency
    let lastHealthCheckAt = 0
    const HEALTH_CHECK_DEBOUNCE_MS = 2000 // Only process health events every 2 seconds

    function getNearbyChests() {
        const now = Date.now()
        if (now - lastChestScanAt >= CONFIG.chestScanIntervalMs) {
            lastChestScanAt = now
            const chestId = bot.registry.blocksByName.chest?.id
            if (typeof chestId !== 'number') {
                cachedChestPositions = []
            } else {
                cachedChestPositions = bot.findBlocks({
                    matching: chestId,
                    maxDistance: CONFIG.chestScanRadius,
                    count: 64
                }) || []
            }
            logger.debug('chest-scan', `Chest scan: found ${cachedChestPositions.length} chests within ${CONFIG.chestScanRadius} blocks.`, CONFIG.chestScanIntervalMs)
        }
        return cachedChestPositions
    }

    function markChest(pos, key, ms) {
        const k = posKey(pos)
        const now = Date.now()
        const info = chestMemory.get(k) || { pos }
        if (key === 'emptyUntil') info.emptyUntil = now + ms
        if (key === 'unreachableUntil') info.unreachableUntil = now + ms
        chestMemory.set(k, info)
    }

    function isChestUsable(pos) {
        const info = chestMemory.get(posKey(pos))
        const now = Date.now()
        if (!info) return true
        if (info.emptyUntil && now < info.emptyUntil) return false
        if (info.unreachableUntil && now < info.unreachableUntil) return false
        return true
    }

    async function gotoNear(pos, range, timeoutMs, label) {
        const goal = new GoalNear(pos.x, pos.y, pos.z, range)
        await withTimeout(bot.pathfinder.goto(goal), timeoutMs, label)
    }

    async function wanderStep() {
        const dx = Math.floor(Math.random() * (CONFIG.wanderStepBlocks * 2 + 1)) - CONFIG.wanderStepBlocks
        const dz = Math.floor(Math.random() * (CONFIG.wanderStepBlocks * 2 + 1)) - CONFIG.wanderStepBlocks
        const target = bot.entity.position.offset(dx || 1, 0, dz || -1)
        try {
            await gotoNear(target, 1, 10000, 'wander-timeout')
        } catch (err) {
            logger.log('wander-fail', `Wander failed: ${err.message}`, CONFIG.logThrottleMs.noFood)
        }
    }

    async function openChestAndTakeOneFood(pos) {
        const chestBlock = bot.blockAt(pos)
        if (!chestBlock) return false
        const chest = await bot.openChest(chestBlock)
        try {
            const items = typeof chest.containerItems === 'function' ? chest.containerItems() : chest.items()
            logger.debug('chest-items', `Chest items: ${items.length} total.`, CONFIG.logThrottleMs.noFood)
            const pick = pickChestFoodItem(bot, items)
            if (!pick) return false
            await chest.withdraw(pick.type, pick.metadata, 1)
            logger.log('chest-withdraw', `Withdrew 1x ${pick.name} from chest at ${pos.x},${pos.y},${pos.z}.`, 0)
            return true
        } finally {
            chest.close()
        }
    }

    async function returnToPosition(pos) {
        if (!pos) return
        logger.log('returning', `Returning to ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}.`, 0)
        try {
            await gotoNear(pos, 1, 20000, 'return-timeout')
        } catch (err) {
            logger.log('return-fail', `Return failed: ${err.message}`, 0)
        }
        setTimeout(() => {
            if (!isAfk) {
                bot.chat('/afk')
                logger.log('afk-on', 'Returned to /afk after chest seek (AFK mode on).', CONFIG.logThrottleMs.afk)
                isAfk = true
            }
        }, CONFIG.returnAfkDelayMs)
    }

    async function seekFood(reason) {
        if (!CONFIG.enableChestSeek) return
        const now = Date.now()
        if (seekInProgress) return
        if (now < seekCooldownUntil) return

        seekInProgress = true
        seekStartPos = bot.entity.position.clone()
        logger.log('seek-start', `${reason} Seeking food in nearby chests...`, CONFIG.logThrottleMs.noFood)
        if (isAfk) {
            isAfk = false
            logger.log('afk-off', 'AFK mode off (seeking food).', CONFIG.logThrottleMs.afk)
        }

        let tookFood = false
        const startAt = Date.now()
        while (Date.now() - startAt < CONFIG.maxSeekDurationMs && !tookFood) {
            const nearby = getNearbyChests().filter(isChestUsable)
            if (nearby.length === 0) {
                await wanderStep()
                continue
            }

            const sorted = nearby
                .slice()
                .sort((a, b) => distanceSq(a, bot.entity.position) - distanceSq(b, bot.entity.position))

            let progressed = false
            for (const pos of sorted) {
                if (!isChestUsable(pos)) continue
                progressed = true
                try {
                    logger.log('move-chest', `Moving to chest at ${pos.x},${pos.y},${pos.z}.`, CONFIG.logThrottleMs.noFood)
                    await gotoNear(pos, 1, 15000, 'chest-timeout')
                } catch (err) {
                    logger.log('chest-unreachable', `Chest unreachable at ${pos.x},${pos.y},${pos.z}: ${err.message}`, CONFIG.logThrottleMs.noFood)
                    markChest(pos, 'unreachableUntil', CONFIG.chestUnreachableCooldownMs)
                    continue
                }

                try {
                    const got = await openChestAndTakeOneFood(pos)
                    if (got) {
                        tookFood = true
                        break
                    } else {
                        logger.log('chest-empty', `No usable food in chest at ${pos.x},${pos.y},${pos.z}.`, CONFIG.logThrottleMs.noFood)
                        markChest(pos, 'emptyUntil', CONFIG.chestEmptyCooldownMs)
                    }
                } catch (err) {
                    logger.log('chest-error', `Chest error at ${pos.x},${pos.y},${pos.z}: ${err.message}`, CONFIG.logThrottleMs.noFood)
                    markChest(pos, 'unreachableUntil', CONFIG.chestUnreachableCooldownMs)
                }
            }

            if (!progressed) {
                await wanderStep()
            }
        }

        if (!tookFood) {
            logger.log('seek-fail', 'No reachable chests with spare food found.', CONFIG.logThrottleMs.noFood)
            seekCooldownUntil = Date.now() + CONFIG.seekCooldownMs
        }

        await returnToPosition(seekStartPos)
        seekInProgress = false
    }

    function tryEat(reason) {
        const now = Date.now()
        if (isEating) return
        if (now - lastEatAttemptAt < EAT_COOLDOWN_MS) return
        if (bot.food >= 20) {
            // Can't eat when full hunger on most servers
            // OPTIMIZATION: Only log full hunger if we actually tried to eat (throttled anyway)
            logger.log('full-hunger', `${reason} Hunger is full (food=${bot.food}). Not eating.`, CONFIG.logThrottleMs.fullHunger)
            return
        }

        lastEatAttemptAt = now
        // OPTIMIZATION: Only scan inventory when we're actually going to eat, and log in one place
        const inv = getEdibleInventorySummary(bot)
        if (inv.edibleCount === 0) {
            logger.log('no-food', `${reason} No edible food in inventory.`, CONFIG.logThrottleMs.noFood)
            seekFood(reason).catch(err => {
                logger.log('seek-error', `Seek error: ${err.message}`, 0)
                seekInProgress = false
            })
            return // OPTIMIZATION: Early return - don't call eat() if no food
        }

        const top = inv.edibleNames.length ? ` (${inv.edibleNames.join(', ')})` : ''
        logger.log('eat-attempt', `${reason} Eating${top}... (H=${bot.health.toFixed(0)}, F=${bot.food})`, CONFIG.logThrottleMs.eatAttempt)
        logger.debug('inv-food', `Inventory edible summary: count=${inv.edibleCount}${top}`, CONFIG.logThrottleMs.eatAttempt)
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
        // OPTIMIZATION: Removed duplicate /afk here - autoeat_finished handles the re-AFK
        // This event fires when eating is interrupted (no food, can't eat, etc.)
        if (bot.food >= 20) {
            logger.log('eat-stop', 'Auto-eat stopped (hunger full).', CONFIG.logThrottleMs.fullHunger)
        } else {
            logger.log('eat-stop', 'Auto-eat stopped (no food / cannot eat).', CONFIG.logThrottleMs.noFood)
        }
        isEating = false;
        // Only send /afk if we broke out of AFK and autoeat_finished won't fire
        // autoeat_finished fires on successful completion, autoeat_stopped on interruption
        if (!isAfk) {
            setTimeout(() => {
                if (!isAfk && !isEating) { // Double-check we're still not eating
                    bot.chat('/afk');
                    logger.log('afk-on', 'Returned to /afk (AFK mode on).', CONFIG.logThrottleMs.afk)
                    isAfk = true;
                }
            }, 1000);
        }
    });

    bot.on('autoeat_error', (err) => {
        const msg = err && err.message ? err.message : String(err)
        logger.log('eat-error', `Auto-eat error: ${msg}`, 0)
        isEating = false
    })

    // Manual health monitoring - We drive the eating logic here to have fine-grained control and logging.
    // This allows us to log "seeking food" BEFORE the action, and handle cooldowns explicitly.
    // OPTIMIZATION: Debounced to prevent excessive processing on every server tick
    bot.on('health', () => {
        const now = Date.now()
        // OPTIMIZATION: Skip processing if we checked recently (debounce)
        if (now - lastHealthCheckAt < HEALTH_CHECK_DEBOUNCE_MS) return
        lastHealthCheckAt = now

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
        // OPTIMIZATION: Removed duplicate 'seek-food' log - tryEat already logs the attempt
        if (bot.food <= CONFIG.hungerThreshold) {
            tryEat(`[HUNGER<=${CONFIG.hungerThreshold}]`)
            return
        }

        if (bot.health <= CONFIG.healthThreshold) {
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

