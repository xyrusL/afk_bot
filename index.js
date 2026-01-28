// ============================================================
// AFK Bot
// ============================================================
const mineflayer = require('mineflayer')
const autoEat = require('mineflayer-auto-eat').loader
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const { createLogger } = require('./logger')
const CONNECTION = require('./config')

const CONFIG = {
  afkDelay: 3000,
  reconnectDelay: 3000,

  hungerThreshold: 10,
  healthThreshold: 10,

  lowFoodThresholdItems: 6,
  foodRequestIntervalMs: 45000,

  statusIntervalMs: 60000,

  pingCheckIntervalMs: 5000,
  highPingThresholdMs: 250,
  highPingStrikes: 3,
  highPingRecoveryStrikes: 3,
  highPingHoldMs: 30000,

  // --- auto-eat tuning ---
  eatTimeoutMs: 9000,          // eating timeout (ms)
  eatBackoffOnFailMs: 7000,    // backoff after failed eat (ms)

  // --- chat anti-spam ---
  chatCooldownMs: 1500,

  bannedFood: ['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish'],
  negativeEffects: [
    'poison', 'hunger', 'slowness', 'weakness', 'wither', 'blindness', 'nausea',
    'mining_fatigue', 'instant_damage', 'darkness', 'bad_omen', 'unluck'
  ],

  logThrottleMs: {
    connection: 3000,
    afk: 15000,
    hunger: 30000,
    noFood: 30000,
    ping: 15000,
    block: 30000
  }
}

const FOOD_REQUEST_MESSAGES = [
  'Uy gutom na ako, may extra food ba dyan?',
  'Low na food ko guys, pahingi naman.',
  'Im starving, sino may spare food?',
  'Wala na akong makain, tulong pls.',
  'Food check! Baka may sobra kayo.',
  'Need food ASAP, di na kaya.'
]
const THANK_YOU_MESSAGES = [
  'Salamat! Lifesaver ka.',
  'Thanks sa food, appreciate it!',
  'Maraming salamat, idol.'
]
const REJECTION_MESSAGES = [
  'Tinapon ko yan kasi hindi safe kainin.',
  'Sorry, harmful yan sa akin kaya tinapon ko.',
  'That food is not safe for me, I had to throw it.'
]
const NEED_MORE_MESSAGES = [
  'Salamat! Pero kulang pa food ko, pahingi pa please.',
  'Appreciate it, pero low pa rin food ko.'
]

// ---------- tiny helpers ----------
const now = () => Date.now()
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const throttle = (() => {
  const last = new Map()
  return (key, ms, fn) => {
    const t = now()
    if ((last.get(key) ?? 0) + ms > t) return
    last.set(key, t)
    fn()
  }
})()

function getPingMs(bot) {
  return (typeof bot?.player?.ping === 'number' && bot.player.ping)
    || (typeof bot?._client?.ping === 'number' && bot._client.ping)
    || (typeof bot?._client?.latency === 'number' && bot._client.latency)
    || null
}

function disableBlockInteractions(bot, logger) {
  if (bot._afkBlockGuardsInstalled) return
  bot._afkBlockGuardsInstalled = true

  if (typeof bot.dig === 'function') {
    bot.dig = async () => {
      logger.log('dig-blocked', 'Blocked dig attempt.', CONFIG.logThrottleMs.block)
      throw new Error('digging disabled')
    }
  }

  if (typeof bot.placeBlock === 'function') {
    bot.placeBlock = async () => {
      logger.log('place-blocked', 'Blocked place attempt.', CONFIG.logThrottleMs.block)
      throw new Error('block placing disabled')
    }
  }
}

function configureMovementsNoBlockInteraction(movements) {
  movements.canDig = false
  movements.canPlaceBlocks = false
  // keep both spellings (different mineflayer versions)
  movements.scafoldingBlocks = []
  movements.scaffoldBlocks = []
}

// ---------- global singleton reconnect ----------
let currentBot = null
let reconnectTimer = null

function scheduleReconnect(delay = CONFIG.reconnectDelay) {
  if (reconnectTimer) return
  const logger = createLogger({ name: 'AFK' })
  throttle('reconnect-log', CONFIG.logThrottleMs.connection, () =>
    logger.log('reconnect', `Reconnecting in ${delay / 1000}s...`, CONFIG.logThrottleMs.connection)
  )
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, delay)
}

function createBot() {
  if (currentBot) {
    try { currentBot.removeAllListeners(); currentBot.quit() } catch { }
    currentBot = null
  }

  const logger = createLogger({ name: 'AFK' })
  logger.log('connect', `Connecting to ${CONNECTION.host}:${CONNECTION.port} as ${CONNECTION.username}...`, CONFIG.logThrottleMs.connection)

  const bot = mineflayer.createBot({
    host: CONNECTION.host,
    port: CONNECTION.port,
    username: CONNECTION.username,
    version: CONNECTION.version || false
  })
  currentBot = bot

  // IMPORTANT: attach these immediately to avoid early crash
  bot.on('error', (err) => {
    logger.log('error', `Error: ${err?.message ?? String(err)}`, 0)
    scheduleReconnect()
  })
  bot.on('end', (reason) => {
    logger.log('end', `Disconnected: ${reason}`, 0)
    scheduleReconnect()
  })
  bot.on('kicked', (reason) => {
    const r = JSON.stringify(reason)
    logger.log('kicked', `Kicked: ${r}`, 0)
    scheduleReconnect(r.toLowerCase().includes('throttl') ? 10000 : CONFIG.reconnectDelay)
  })

  disableBlockInteractions(bot, logger)

  bot.loadPlugin(autoEat)
  bot.loadPlugin(pathfinder)

  // ---------- state ----------
  let isAfk = false
  let isEating = false
  let eatBackoffUntil = 0

  let requestMode = false
  let requestTimer = null
  let lastRequestAt = 0

  let movements = null
  let lastKnownFoodCount = 0
  let lastHealthCheckAt = 0
  let lastActivity = 'startup'

  let highPingMode = false
  let highPingUntil = 0
  let hiStrikes = 0
  let loStrikes = 0

  const negativeEffectIds = new Set()
  const EAT_COOLDOWN_MS = 4000
  let lastEatAttemptAt = 0

  // chat cooldown to avoid double messages
  let lastChatAt = 0
  function safeChat(msg) {
    const t = now()
    if (t - lastChatAt < CONFIG.chatCooldownMs) return false
    bot.chat(msg)
    lastChatAt = t
    return true
  }

  const setActivity = (s) => { lastActivity = s || 'unknown' }
  const safeLog = (k, msg, ms = 0) => throttle(k, ms, () => logger.log(k, msg, ms))

  function setAfkOn(reason = 'Returned to /afk.', delayMs = 0) {
    const apply = () => {
      if (isAfk) return
      safeChat('/afk')
      isAfk = true
      safeLog('afk-on', reason, CONFIG.logThrottleMs.afk)
    }
    if (delayMs > 0) setTimeout(apply, delayMs)
    else apply()
  }

  function setAfkOff(reason = 'AFK off.') {
    if (!isAfk) return
    isAfk = false
    safeLog('afk-off', reason, CONFIG.logThrottleMs.afk)
  }

  // low-level client errors (e.g., PartialReadError) can be thrown without hitting bot.on('error')
  if (bot._client && !bot._client._afkClientErrHooked) {
    bot._client._afkClientErrHooked = true
    bot._client.on('error', (err) => {
      const msg = err?.message ?? String(err)
      const isPartial = err?.name === 'PartialReadError'
        || msg.includes('PartialReadError')
        || msg.includes('Unexpected buffer end')
      safeLog('client-error', `Client error${isPartial ? ' (partial read)' : ''}: ${msg}`, CONFIG.logThrottleMs.connection)
      scheduleReconnect()
    })
  }

  function attachAutoEatEvents() {
    if (bot._afkAutoEatEventsInstalled) return
    bot._afkAutoEatEventsInstalled = true

    const onStart = () => {
      if (isEating) return
      isEating = true
      setActivity('eating')
      safeLog('eat-start', 'Bot started eating.', 0)
      setAfkOff('AFK off (eating).')
    }
    const onFinish = () => {
      if (!isEating) return
      isEating = false
      setActivity('eat-finished')
      safeLog('eat-finish', `Finished eating. (health=${bot.health?.toFixed?.(1) ?? '?'}, food=${bot.food ?? '?'})`, 0)
      setAfkOn('Returned to /afk.', 1000)
    }
    const onStop = () => {
      if (!isEating) return
      isEating = false
      setActivity('eat-stopped')
      safeLog('eat-stop', `Auto-eat stopped. (food=${bot.food ?? '?'})`, CONFIG.logThrottleMs.noFood)
      if (!isAfk) setAfkOn('Returned to /afk.', 1000)
    }
    const onError = (err) => {
      isEating = false
      setActivity('eat-error')
      logger.log('eat-error', `Auto-eat error: ${err?.message ?? String(err)}`, 0)
    }

    // Newer mineflayer-auto-eat emits on the plugin instance
    if (bot.autoEat?.on) {
      bot.autoEat.on('eatStart', onStart)
      bot.autoEat.on('eatFinish', onFinish)
      bot.autoEat.on('eatFail', onError)
    }

    // Older mineflayer-auto-eat emits on the bot
    bot.on('autoeat_started', onStart)
    bot.on('autoeat_finished', onFinish)
    bot.on('autoeat_stopped', onStop)
    bot.on('autoeat_error', onError)
  }

  function refreshNegativeEffectIds() {
    negativeEffectIds.clear()
    const effectsByName = bot.registry?.effectsByName ?? {}
    for (const name of CONFIG.negativeEffects) {
      const e = effectsByName[name]
      if (e && typeof e.id === 'number') negativeEffectIds.add(e.id)
    }
  }

  function foodHasNegativeEffects(foodInfo) {
    for (const eff of (foodInfo?.effects ?? [])) {
      const id = eff?.effect
      if (typeof id === 'number' && negativeEffectIds.has(id)) return true
    }
    return false
  }

  function isSafeEdible(name) {
    const foods = bot.registry?.foodsByName ?? null
    if (!foods?.[name]) return false
    if (CONFIG.bannedFood.includes(name)) return false
    return !foodHasNegativeEffects(foods[name])
  }

  function safeFoodSummary() {
    const items = bot.inventory?.items?.() ?? []
    const foods = bot.registry?.foodsByName ?? null
    if (!foods) return { count: 0, top: [] }

    const counts = new Map()
    for (const it of items) {
      if (!foods[it.name]) continue
      if (!isSafeEdible(it.name)) continue
      counts.set(it.name, (counts.get(it.name) ?? 0) + it.count)
    }

    let count = 0
    for (const c of counts.values()) count += c

    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([n, c]) => `${n}x${c}`)

    return { count, top }
  }

  function stopAllMovement() {
    try { bot.pathfinder?.stop(); bot.pathfinder?.setGoal(null) } catch { }
  }

  function sendFoodRequest(reason = 'low-food', force = false) {
    if (!requestMode && !force) return
    const t = now()
    if (!force && t - lastRequestAt < CONFIG.foodRequestIntervalMs) return
    lastRequestAt = t
    const msg = pick(FOOD_REQUEST_MESSAGES)
    safeChat(msg)
    safeLog('food-request', `[${reason}] ${msg}`, CONFIG.logThrottleMs.noFood)
  }

  function setRequestMode(on, reason, foodCount) {
    if (on === requestMode) return
    requestMode = on
    stopAllMovement()

    if (requestMode) {
      setActivity('request-food')
      if (!isAfk) {
        setAfkOn('Switched to /afk for request mode.')
      }

      safeLog('request-start',
        `${reason} Food low (safeFoodItems=${foodCount} < ${CONFIG.lowFoodThresholdItems}).`,
        CONFIG.logThrottleMs.noFood
      )

      if (!requestTimer) {
        requestTimer = setInterval(() => requestMode && sendFoodRequest('timer'), Math.max(5000, CONFIG.foodRequestIntervalMs))
        bot.once('end', () => { if (requestTimer) clearInterval(requestTimer); requestTimer = null })
      }

      sendFoodRequest('enter', true)
    } else {
      setActivity('request-complete')
      if (requestTimer) { clearInterval(requestTimer); requestTimer = null }
      safeLog('request-stop',
        `Food ok again (safeFoodItems=${foodCount} >= ${CONFIG.lowFoodThresholdItems}).`,
        CONFIG.logThrottleMs.noFood
      )
    }
  }

  function updateRequestMode(reason) {
    const s = safeFoodSummary()
    lastKnownFoodCount = s.count
    setRequestMode(s.count < CONFIG.lowFoodThresholdItems, reason, s.count)
    return s
  }

  // Catch autoEat timeout + backoff
  function tryEat(reason) {
    const t = now()

    if (t < eatBackoffUntil) return
    if (isEating) return
    if (t - lastEatAttemptAt < EAT_COOLDOWN_MS) return
    if (bot.food >= 20) return

    lastEatAttemptAt = t
    setActivity('eat-attempt')

    const inv = safeFoodSummary()
    if (!inv.count) {
      safeLog('no-food', `${reason} No safe edible food in inventory.`, CONFIG.logThrottleMs.noFood)
      updateRequestMode('no-food-to-eat')
      return
    }

    safeLog('eat-attempt',
      `${reason} Eating... (H=${bot.health?.toFixed?.(0) ?? '?'}, F=${bot.food})`,
      CONFIG.logThrottleMs.hunger
    )

    // IMPORTANT: always catch rejection (prevents crash on "Eating timed out")
    Promise.resolve(bot.autoEat.eat())
      .catch((err) => {
        const msg = err?.message ?? String(err)
        safeLog('eat-failed', `Eat failed: ${msg}`, CONFIG.logThrottleMs.noFood)

        // backoff so we don't spam eat attempts during lag or blocked eating
        eatBackoffUntil = now() + CONFIG.eatBackoffOnFailMs
        isEating = false
        setActivity('eat-failed')

        // ensure we go back to AFK if we were kicked out of it
        if (!isAfk) {
          setAfkOn('Returned to /afk.', 1000)
        }
      })
  }

  async function tossByName(name) {
    const stack = bot.inventory?.items?.().find(it => it.name === name)
    if (!stack) return false
    try { await bot.tossStack(stack); return true } catch { return false }
  }

  async function handleCollectedItem(collectedEntity) {
    const dropped = typeof collectedEntity.getDroppedItem === 'function'
      ? collectedEntity.getDroppedItem()
      : collectedEntity.metadata?.item
    if (!dropped || typeof dropped.type !== 'number') return

    const itemDef = bot.registry?.items?.[dropped.type]
    const itemName = itemDef?.name
    if (!itemName) return

    const isEdible = Boolean(bot.registry?.foodsByName?.[itemName])
    const safe = isSafeEdible(itemName)

    if (!isEdible || !safe) {
      const tossed = await tossByName(itemName)
      safeChat(`${pick(REJECTION_MESSAGES)} (${!isEdible ? 'not edible' : 'negative effects'}).`)
      safeLog('food-reject', `Rejected ${itemName}. Tossed=${tossed}.`, CONFIG.logThrottleMs.noFood)
      updateRequestMode('reject-food')
      return
    }

    safeChat(pick(THANK_YOU_MESSAGES))
    safeLog('food-accept', `Accepted: ${itemName}.`, 0)

    const s = updateRequestMode('received-food')
    if (s.count < CONFIG.lowFoodThresholdItems) {
      // ONE message only, and reset request timer so timer won't instantly spam
      safeChat(pick(NEED_MORE_MESSAGES))
      lastRequestAt = now()
    } else {
      // also reset request timer after thanks to avoid immediate timer spam
      lastRequestAt = now()
    }
  }

  // ---------- events ----------
  bot.on('login', () => safeLog('login', 'Bot has logged in.', CONFIG.logThrottleMs.connection))

  bot.on('spawn', () => {
    safeLog('spawn', `Spawned. /afk in ${CONFIG.afkDelay / 1000}s...`, CONFIG.logThrottleMs.connection)

    if (!movements) {
      movements = new Movements(bot, bot.registry)
      configureMovementsNoBlockInteraction(movements)
      bot.pathfinder.setMovements(movements)
    }

    // Configure auto-eat (newer plugin uses setOpts; fall back to legacy options field)
    const autoEatOpts = {
      priority: 'foodPoints',
      minHunger: CONFIG.hungerThreshold,
      minHealth: CONFIG.healthThreshold,
      bannedFood: CONFIG.bannedFood,
      eatingTimeout: CONFIG.eatTimeoutMs
    }
    if (typeof bot.autoEat?.setOpts === 'function') bot.autoEat.setOpts(autoEatOpts)
    else bot.autoEat.options = {
      ...autoEatOpts,
      startAt: CONFIG.hungerThreshold,
      timeout: CONFIG.eatTimeoutMs
    }

    refreshNegativeEffectIds()

    // We trigger eat manually; disable built-in listener if exists
    if (typeof bot.autoEat?.disableAuto === 'function') bot.autoEat.disableAuto()
    else if (typeof bot.autoEat?.disable === 'function') bot.autoEat.disable()

    attachAutoEatEvents()

    setTimeout(() => {
      setAfkOn('Chatted: /afk (AFK on).')
      updateRequestMode('spawn-afk')
    }, CONFIG.afkDelay)

    // heartbeat
    const hb = setInterval(() => {
      const ping = getPingMs(bot)
      logger.log(
        'heartbeat',
        `Status: ${isAfk ? 'AFK' : 'ACTIVE'} | health=${bot.health?.toFixed?.(1) ?? '?'} | food=${bot.food ?? '?'} | ping=${typeof ping === 'number' ? ping + 'ms' : '?'}(${highPingMode ? 'HIGH' : 'NORMAL'}) | eating=${isEating ? 'yes' : 'no'} | requesting=${requestMode ? 'yes' : 'no'}`
      )
    }, Math.max(5000, Math.min(CONFIG.statusIntervalMs, 60000)))
    bot.once('end', () => clearInterval(hb))
  })

  bot.on('playerCollect', (collector, collected) => {
    if (collector !== bot.entity) return
    handleCollectedItem(collected).catch(e => logger.log('collect-error', `Collect handler error: ${e.message}`, 0))
  })

  // manual health driver (debounced)
  bot.on('health', () => {
    const t = now()
    if (t - lastHealthCheckAt < 2000) return
    lastHealthCheckAt = t

    const prev = lastKnownFoodCount
    const s = updateRequestMode('health-check')
    if (s.count !== prev) {
      safeLog(
        'food-count',
        `Safe edible items: ${s.count}${s.top.length ? ` (${s.top.join(', ')})` : ''}`,
        CONFIG.logThrottleMs.noFood
      )
    }

    // Optional: if high ping mode, you can choose to delay eating attempts slightly
    // if (highPingMode) return

    if (bot.food <= CONFIG.hungerThreshold) return tryEat(`[HUNGER<=${CONFIG.hungerThreshold}]`)
    if (bot.health <= CONFIG.healthThreshold) return tryEat(`[LOW_HEALTH<=${CONFIG.healthThreshold}]`)
  })

  // ping monitor
  const pingTimer = setInterval(() => {
    const ping = getPingMs(bot)
    if (typeof ping !== 'number') return

    if (ping >= CONFIG.highPingThresholdMs) {
      hiStrikes++; loStrikes = 0
      if (!highPingMode && hiStrikes >= CONFIG.highPingStrikes) {
        highPingMode = true
        highPingUntil = now() + CONFIG.highPingHoldMs
        safeLog('ping-high', `High ping (${ping}ms). Mode=HIGH. Last=${lastActivity}`, CONFIG.logThrottleMs.ping)
      }
    } else {
      loStrikes++; hiStrikes = 0
      if (highPingMode && now() >= highPingUntil && loStrikes >= CONFIG.highPingRecoveryStrikes) {
        highPingMode = false
        safeLog('ping-ok', `Ping recovered (${ping}ms). Mode=NORMAL.`, CONFIG.logThrottleMs.ping)
      }
    }
  }, Math.max(1000, CONFIG.pingCheckIntervalMs))
  bot.once('end', () => clearInterval(pingTimer))
}

createBot()
