# Mineflayer AFK Bot

A Minecraft AFK bot built with Mineflayer that keeps you online, manages hunger safely, and reconnects when disconnected.

---

## Features

### Auto-AFK and Reconnect
- Sends `/afk` after spawn (configurable delay)
- Reconnects on kick, error, or disconnect
- Handles throttled kick reconnects with an extended delay
- Detects low-level client read errors and reconnects

### Hunger Management
- Eats when hunger or health is low (configurable thresholds)
- Safe food filter (banned items plus negative effects)
- Configurable eating timeout and retry backoff

### Food Request System
- Enters request mode when safe food runs low
- Sends periodic food requests in chat
- Accepts safe food with thank-you messages
- Rejects unsafe food and discards it

### Ping Monitoring
- Tracks ping and logs NORMAL/HIGH states using a strike system

### Safety and Stability
- Digging and block placement disabled
- No wandering or pathfinding movement
- Throttled logs to reduce spam

### Status Heartbeat
- Periodic status logs for AFK state, health, food, ping, and request/eat state

---

## Configuration

Edit `config.js` to change connection settings:

```javascript
module.exports = {
    host: 'your.server.ip',
    port: 25565,
    username: '_AfkBot',
    version: false // Auto-detect, or specify like '1.20.4'
}
```

### Advanced Settings (index.js)

Key settings you can tune inside the `CONFIG` object:

| Setting | Default | Description |
|---------|---------|-------------|
| `afkDelay` | 3000ms | Delay before sending `/afk` after spawn |
| `reconnectDelay` | 3000ms | Delay before reconnecting after disconnect |
| `hungerThreshold` | 10 | Hunger level to trigger eating |
| `healthThreshold` | 10 | Health level to trigger emergency eating |
| `eatTimeoutMs` | 9000ms | Timeout for a single eating action |
| `eatBackoffOnFailMs` | 7000ms | Backoff after a failed eat attempt |
| `lowFoodThresholdItems` | 6 | Safe food count to trigger request mode |
| `foodRequestIntervalMs` | 45000ms | Time between food request messages |
| `chatCooldownMs` | 1500ms | Minimum gap between chat messages |
| `statusIntervalMs` | 60000ms | Time between status heartbeat logs |
| `pingCheckIntervalMs` | 5000ms | Ping check interval |
| `highPingThresholdMs` | 250ms | Ping threshold for HIGH mode |
| `highPingStrikes` | 3 | Strikes to enter HIGH mode |
| `highPingRecoveryStrikes` | 3 | Strikes to exit HIGH mode |

---

## Dependencies

- `mineflayer`
- `mineflayer-auto-eat`
- `mineflayer-pathfinder`

---

## How to Run (PC)

1. Install Node.js (v16+ recommended)
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

## How to Run on Android (Termux)

1. Install Termux from F-Droid
2. Set up the environment:
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs -y
   ```
3. Enable storage access and navigate to the download folder:
   ```bash
   termux-setup-storage
   cd storage/downloads/afk_bot
   ```
4. Install dependencies and run:
   ```bash
   npm install
   npm start
   ```

---

## Log Messages Reference

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

## License

ISC
