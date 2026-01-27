# Mineflayer AFK Bot

A smart Minecraft AFK bot built with [Mineflayer](https://github.com/PrismarineJS/mineflayer) that automatically maintains your presence on a server with intelligent hunger management, food safety filtering, and auto-reconnection capabilities.

---

## ✨ Features

### 🔄 Auto-AFK & Reconnect
- Automatically runs `/afk` command after spawning (configurable delay)
- Auto-reconnects on kick, error, or disconnection
- Handles throttled connection kicks with extended reconnect delay

### 🍖 Intelligent Hunger Management
- **Auto-Eating**: Automatically eats when hunger drops to 50% (≤10) or health is low (≤10)
- **Safe Food Filtering**: Only eats beneficial foods, avoiding:
  - `rotten_flesh`, `spider_eye`, `poisonous_potato`, `pufferfish`
  - Any food with negative effects (poison, hunger, weakness, etc.)
- **Food Inventory Tracking**: Monitors safe edible food count in inventory

### 🗣️ Food Request System
- When food runs low (< 6 safe items), enters "request mode"
- Periodically sends food request messages in chat (Filipino/English)
- **Accepts/Rejects collected items**: 
  - Accepts safe food with thank-you messages
  - Automatically tosses harmful food with rejection messages
  - Asks for more if still running low

### 📊 Ping Monitoring
- Monitors server ping every 5 seconds
- Detects high ping situations (≥250ms) with strike system
- Logs ping mode changes (NORMAL/HIGH) for debugging

### 🚫 Safety Features
- **Block Breaking/Placing Disabled**: Prevents accidental griefing
- **No Pathfinding Movement**: Stays in place, doesn't wander
- **Throttled Logging**: Prevents log spam with smart message rate-limiting

### 📝 Status Heartbeat
- Logs periodic status updates every 60 seconds including:
  - AFK state, health, food level
  - Current ping and ping mode
  - Eating and food request status

---

## ⚙️ Configuration

Edit `config.js` to change connection settings:

```javascript
module.exports = {
    host: 'your.server.ip',    // Server address
    port: 25565,                // Server port
    username: '_AfkBot',        // Bot username
    version: false              // Auto-detect version (or specify like '1.20.1')
}
```

### Advanced Configuration

Additional settings can be adjusted in `index.js` under the `CONFIG` object:

| Setting | Default | Description |
|---------|---------|-------------|
| `afkDelay` | 3000ms | Delay before running /afk after spawn |
| `reconnectDelay` | 3000ms | Delay before reconnecting after disconnect |
| `hungerThreshold` | 10 | Hunger level to trigger eating (50%) |
| `healthThreshold` | 10 | Health level to trigger emergency eating |
| `lowFoodThresholdItems` | 6 | Safe food count to trigger request mode |
| `foodRequestIntervalMs` | 45000ms | Time between food request messages |
| `statusIntervalMs` | 60000ms | Time between status heartbeat logs |
| `highPingThresholdMs` | 250ms | Ping threshold to trigger high-ping mode |

---

## 📦 Dependencies

- `mineflayer` - Core Minecraft bot framework
- `mineflayer-auto-eat` - Automatic eating functionality
- `mineflayer-pathfinder` - Movement system (used for configuration only)

---

## 🚀 How to Run (PC)

1. Install [Node.js](https://nodejs.org/) (v16+ recommended)
2. Open a terminal in the bot folder
3. Install dependencies (first time only):
   ```bash
   npm install
   ```
4. Configure the bot by editing `config.js`
5. Start the bot:
   ```bash
   npm start
   ```

---

## 📱 How to Run on Android (Termux)

### Option 1: From ZIP Download

1. **Install Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/)
2. Set up the environment:
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs -y
   ```
3. Enable storage access and navigate to download folder:
   ```bash
   termux-setup-storage
   cd storage/downloads/afk_bot
   ```
4. Install dependencies and run:
   ```bash
   npm install
   npm start
   ```

### Option 2: Using wget

1. Install required packages:
   ```bash
   pkg install wget unzip -y
   ```
2. Download and extract:
   ```bash
   wget https://github.com/YOUR_USERNAME/YOUR_REPO/archive/refs/heads/main.zip -O afk_bot.zip
   unzip afk_bot.zip
   mv YOUR_REPO-main afk_bot
   rm afk_bot.zip
   ```
3. Install and run:
   ```bash
   cd afk_bot
   npm install
   npm start
   ```

---

## 🔄 How to Update

### Git Users
```bash
git pull
npm install
```

### ZIP Users
1. Download the latest release
2. Extract files
3. Copy your `config.js` settings to the new folder
4. Run `npm install` to update dependencies

---

## 📋 Log Messages Reference

| Log Key | Description |
|---------|-------------|
| `connect` | Connecting to server |
| `spawn` | Bot spawned in world |
| `afk-on/off` | AFK mode toggled |
| `eat-*` | Eating-related events |
| `food-*` | Food inventory/request events |
| `ping-*` | Ping status changes |
| `heartbeat` | Periodic status update |
| `kicked/error/end` | Disconnect events |

---

## 🛡️ Safety Notes

- The bot will **never** break or place blocks
- The bot will **never** attack entities
- The bot only moves to eat, then returns to AFK
- All potentially harmful foods are automatically rejected and discarded

---

## 📄 License

ISC
