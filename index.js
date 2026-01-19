// ============================================================
// AFK Bot Configuration
// ============================================================
// You can edit the settings below to customize the bot.

const CONFIG = {
    // Server IP address (e.g., 'play.example.com' or '127.0.0.1')
    host: 'watermelon.deze.me',

    // Server port (default Minecraft port is 25565)
    port: 62782,

    // Bot username (this is what the bot will be called in-game)
    username: 'AFKBot',

    // Delay in milliseconds before sending /afk after spawning (3000 = 3 seconds)
    afkDelay: 3000,

    // Delay in milliseconds before reconnecting after being kicked (3000 = 3 seconds)
    reconnectDelay: 3000
}

// ============================================================
// DO NOT EDIT BELOW THIS LINE UNLESS YOU KNOW WHAT YOU'RE DOING
// ============================================================

const mineflayer = require('mineflayer')

function createBot() {
    console.log(`Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username}...`)

    const bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username
    })

    bot.on('login', () => {
        console.log('Bot has logged in.')
    })

    bot.on('spawn', () => {
        console.log(`Bot spawned. Waiting ${CONFIG.afkDelay / 1000} seconds to send /afk...`)
        setTimeout(() => {
            bot.chat('/afk')
            console.log('Chatted: /afk')
        }, CONFIG.afkDelay)
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
