# 🤖 Minecraft AFK Bot

A smart, self-managing bot that keeps your Minecraft account online — even when you're away. It handles hunger, reconnects by itself, and asks for help when it needs food. Just set it up and let it run.

---

## ✨ What It Does

### 🟢 Stays Online Automatically
The bot connects to your server and goes AFK right away. If it ever gets disconnected — whether by a kick, a crash, or a timeout — it reconnects on its own without you having to do anything.

### 🍎 Eats When Hungry
When the bot's hunger or health gets low, it automatically eats food from its inventory. It's smart about it too — it only eats safe food and avoids anything harmful like rotten flesh or poisonous potatoes.

### 🙋 Asks for Food When It Runs Out
If the bot runs low on food, it switches into "request mode" and politely asks players in chat for more. When someone gives it food, it checks if it's safe — thanks them if it is, or throws it away if it isn't.

### 📡 Monitors Its Connection
The bot tracks its ping to the server and logs when the connection is slow. It also checks if the server is online before trying to connect, and backs off slowly if the server is down — so it doesn't spam reconnects.

### 🛡️ Safe by Design
The bot can't dig blocks or place them. It won't accidentally grief your world. It's built to be passive — just staying alive and online.

---

## ⚙️ Setup

### What You Need
- [Node.js](https://nodejs.org/) v16 or higher

### First Time
```bash
npm install
```

### Configure It
Open `config.js` and fill in your server details:

```js
connection: {
  host: 'your.server.ip',  // Server address
  port: 25565,              // Server port
  username: '_AfkBot',      // Bot's Minecraft username
  version: false            // Auto-detect version, or set manually e.g. '1.20.4'
}
```

### Run It
```bash
npm start
```

---

## 📱 Running on Android (Termux)

You can even run this on your phone!

1. Install [Termux from F-Droid](https://f-droid.org/packages/com.termux/)
2. Run:
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs -y
   ```
3. Navigate to the bot folder and run:
   ```bash
   npm install
   npm start
   ```

---

## 🔧 Configuration Options

All settings live in `config.js`. Here are the key ones:

| Setting | Default | What It Does |
|---|---|---|
| `afkCommand` | `/afk` | The command sent to toggle AFK mode |
| `sendAfkChat` | `true` | Set to `false` to disable the AFK command |
| `randomWalk.enabled` | `false` | Make the bot walk around randomly to avoid idle kicks |
| `hungerThreshold` | `10` | Hunger level that triggers eating |
| `healthThreshold` | `10` | Health level that triggers emergency eating |
| `lowFoodThresholdItems` | `6` | How few food items triggers food request mode |
| `reconnectDelayMs` | `3000ms` | How long to wait before reconnecting |
| `preConnectPing` | `true` | Ping the server before connecting |

---

## 💬 Custom Messages

The bot sends chat messages when it needs food, receives food, or rejects unsafe food. You can customize all of these in `custom_messages/messages.json`.

If a message list is empty, the bot simply won't send that type of message.

---

## 📦 Built With

- [mineflayer](https://github.com/PrismarineJS/mineflayer) — Minecraft bot framework
- [mineflayer-auto-eat](https://github.com/link-discord/mineflayer-auto-eat) — Automatic eating
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) — Movement and navigation

---

## 📄 License

[MIT](./LICENSE) — free to use, modify, and share.