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
    healthThreshold: 10
}

// ============================================================
// DO NOT EDIT BELOW THIS LINE UNLESS YOU KNOW WHAT YOU'RE DOING
// ============================================================

const mineflayer = require('mineflayer')
const autoEat = require('mineflayer-auto-eat').plugin

let isAfk = false

const EAT_COOLDOWN_MS = 4000

function createBot() {
    console.log(`Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username}...`)

    const bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username
    })

    // Load auto-eat plugin
    bot.loadPlugin(autoEat)

    bot.on('login', () => {
        console.log('Bot has logged in.')
    })

    bot.on('spawn', () => {
        console.log(`Bot spawned. Waiting ${CONFIG.afkDelay / 1000} seconds to send /afk...`)

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
            console.log('Chatted: /afk')
            isAfk = true
        }, CONFIG.afkDelay)
    })

    // Health monitoring - eat if low health (but don't call if already eating!)
    let isEating = false;
    let lastEatAttemptAt = 0;

    function tryEat(reason) {
        const now = Date.now()
        if (isEating) return
        if (now - lastEatAttemptAt < EAT_COOLDOWN_MS) return
        if (bot.food >= 20) {
            // Can't eat when full hunger on most servers
            return
        }

        lastEatAttemptAt = now
        console.log(`${reason} Trying to eat from inventory... (health=${bot.health.toFixed(1)}, food=${bot.food})`)
        try {
            bot.autoEat.eat()
        } catch (err) {
            // Ignore "Already eating" and similar transient errors
        }
    }

    bot.on('autoeat_started', () => {
        console.log('Bot is eating...');
        isEating = true;
        if (isAfk) {
            isAfk = false;
        }
    });

    bot.on('autoeat_finished', () => {
        console.log('Bot finished eating.');
        isEating = false;
        setTimeout(() => {
            if (!isAfk) {
                bot.chat('/afk');
                console.log('Returned to /afk after eating.');
                isAfk = true;
            }
        }, 1000);
    });

    bot.on('autoeat_stopped', () => {
        console.log('Bot stopped eating (no food or full).');
        isEating = false;
        if (!isAfk) {
            setTimeout(() => {
                bot.chat('/afk');
                console.log('Returned to /afk.');
                isAfk = true;
            }, 1000);
        }
    });

    bot.on('autoeat_error', (err) => {
        const msg = err && err.message ? err.message : String(err)
        console.log(`Auto-eat error: ${msg}`)
        isEating = false
    })

    bot.on('health', () => {
        // Requirements:
        // - If hunger <= 50% (food <= 10), eat
        // - Or if low health and can eat, eat
        if (bot.food <= CONFIG.hungerThreshold) {
            tryEat(`[HUNGER<=${CONFIG.hungerThreshold}]`)
            return
        }

        if (bot.health <= CONFIG.healthThreshold) {
            tryEat(`[LOW_HEALTH<=${CONFIG.healthThreshold}]`)
        }
    });


    bot.on('kicked', (reason) => {
        console.log(`Kicked: ${reason}`)
        console.log(`Reconnecting in ${CONFIG.reconnectDelay / 1000} seconds...`)
        setTimeout(createBot, CONFIG.reconnectDelay)
    })

    bot.on('error', (err) => {
        console.log(`Error: ${err.message}`)
        console.log(`Reconnecting in ${CONFIG.reconnectDelay / 1000} seconds...`)
        setTimeout(createBot, CONFIG.reconnectDelay)
    })

    bot.on('end', (reason) => {
        console.log(`Disconnected: ${reason}`)
        console.log(`Reconnecting in ${CONFIG.reconnectDelay / 1000} seconds...`)
        setTimeout(createBot, CONFIG.reconnectDelay)
    })
}

createBot()
