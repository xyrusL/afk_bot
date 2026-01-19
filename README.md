# Mineflayer AFK Bot

A simple Minecraft AFK bot that connects, spawns, and runs `/afk`. It has auto-reconnect capabilities.

## Configuration
Edit `index.js` to change:
- Server IP (`host`)
- Port (`port`)
- Bot Username (`username`)
- Hunger/Health thresholds

## Features
- **Auto-AFK**: Runs `/afk` automatically after spawning.
- **Auto-Reconnect**: Reconnects on kick or error.
- **Hunger Management**: Eats from the bot's inventory when hunger is at or below 50% (food ≤ 10) or when health is low (<= configured health threshold) and the bot can eat.
    - The bot no longer detects or moves toward dropped food.

## How to Run (PC)
1. Install [Node.js](https://nodejs.org/).
2. Open a terminal in the folder.
3. Run `npm install` (first time only).
4. Run `npm start`.

---

## How to Run on Android (Termux)

If you downloaded the code as a ZIP file:

1.  **Install Termux** from F-Droid or GitHub.
2.  Open Termux and run these commands to prepare the environment:
    ```bash
    pkg update && pkg upgrade -y
    pkg install nodejs -y
    ```
3.  Navigate to your download folder:
    ```bash
    termux-setup-storage
    cd storage/downloads/afk_bot
    ```
4.  Install the bot dependencies:
    ```bash
    npm install
    ```
5.  Start the bot:
    ```bash
    npm start
    ```

### Option 2: Using wget (Direct Download)
If you prefer not to use git:

1.  **Install wget and unzip**:
    ```bash
    pkg install wget unzip -y
    ```
2.  **Download the bot** (replace URL with your repo's zip link):
    ```bash
    wget https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/archive/refs/heads/main.zip -O afk_bot.zip
    ```
3.  **Unzip and move to internal storage**:
    It is best to keep files in Termux's home directory to avoid permission issues.
    ```bash
    unzip afk_bot.zip
    mv YOUR_REPO_NAME-main afk_bot
    rm afk_bot.zip
    ```
4.  **Install and Run**:
    ```bash
    cd afk_bot
    npm install
    npm start
    ```

---

## How to Update

If the bot has been updated in the repository, here is how to get the latest version suitable for your setup:

### Option 1: Using Git (Recommended)
If you used `git clone` to install the bot, simply run:
```bash
git pull
npm install
```

### Option 2: Re-downloading (ZIP Users)
If you downloaded the ZIP file:
1. Download the latest ZIP from the repository.
2. Extract the files.
3. **Copy your configured `index.js`** (or just copy your settings) from the old folder to the new one so you don't lose your settings.
4. Replace the old files with the new ones.
5. In your terminal/Termux, run:
   ```bash
   npm install
   ```
   (This updates any new dependencies like the auto-eat plugin).
