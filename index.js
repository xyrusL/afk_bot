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

    // Hunger threshold to start eating (max is 20, start eating when below this)
    hungerThreshold: 14,

    // Health threshold to eat even if not hungry (max is 20)
    healthThreshold: 10
}

// ============================================================
// DO NOT EDIT BELOW THIS LINE UNLESS YOU KNOW WHAT YOU'RE DOING
// ============================================================

const mineflayer = require('mineflayer')
const autoEat = require('mineflayer-auto-eat').plugin

// List of food item names in Minecraft
const FOOD_ITEMS = [
    'apple', 'baked_potato', 'beef', 'beetroot', 'beetroot_soup', 'bread',
    'carrot', 'chicken', 'chorus_fruit', 'cod', 'cooked_beef', 'cooked_chicken',
    'cooked_cod', 'cooked_mutton', 'cooked_porkchop', 'cooked_rabbit', 'cooked_salmon',
    'cookie', 'dried_kelp', 'enchanted_golden_apple', 'golden_apple', 'golden_carrot',
    'honey_bottle', 'melon_slice', 'mushroom_stew', 'mutton', 'poisonous_potato',
    'porkchop', 'potato', 'pufferfish', 'pumpkin_pie', 'rabbit', 'rabbit_stew',
    'raw_beef', 'raw_chicken', 'raw_cod', 'raw_mutton', 'raw_porkchop', 'raw_rabbit',
    'raw_salmon', 'rotten_flesh', 'salmon', 'spider_eye', 'steak', 'suspicious_stew',
    'sweet_berries', 'tropical_fish', 'glow_berries'
]

function isFood(itemName) {
    return FOOD_ITEMS.some(food => itemName.toLowerCase().includes(food.replace('_', '')))
}

let isAfk = false

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

        setTimeout(() => {
            bot.chat('/afk')
            console.log('Chatted: /afk')
            isAfk = true
        }, CONFIG.afkDelay)
    })

    // Health monitoring - eat if low health (but don't call if already eating!)
    let isEating = false;

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
            bot.chat('/afk');
            console.log('Returned to /afk after eating.');
            isAfk = true;
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

    bot.on('health', () => {
        // Only try to eat if NOT already eating
        if (bot.health < CONFIG.healthThreshold && bot.food < 20 && !isEating) {
            console.log(`Low health (${bot.health.toFixed(1)}), trying to eat...`);
            try {
                bot.autoEat.eat();
            } catch (err) {
                // Ignore "Already eating" errors
            }
        }
    });

    // Pick up only food items
    bot.on('itemDrop', (entity) => {
        if (!entity || !entity.getDroppedItem) return

        const item = entity.getDroppedItem()
        if (!item) return

        const itemName = item.name
        if (isFood(itemName)) {
            console.log(`Food item detected nearby: ${itemName}. Picking it up...`)
            // Move to pick up the food
            bot.pathfinder && bot.pathfinder.goto
                ? bot.pathfinder.goto(new (require('mineflayer-pathfinder').goals.GoalNear)(entity.position.x, entity.position.y, entity.position.z, 1))
                : null
        } else {
            console.log(`Non-food item detected: ${itemName}. Ignoring.`)
        }
    })

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
