# Mineflayer AFK Bot

A simple Minecraft AFK bot that connects, spawns, and runs `/afk`. It has auto-reconnect capabilities.

## Configuration
Edit `index.js` to change:
- Server IP (`host`)
- Port (`port`)
- Bot Username (`username`)

## How to Run (PC)
1. Install [Node.js](https://nodejs.org/).
2. Open a terminal in the folder.
3. Run `npm install` (first time only).
4. Run `npm start`.

---

## How to Run on Android (Termux)

If you downloaded the code as a ZIP file:

1.  **Install Termux** from F-Droid or GitHub (Play Store version is outdated).
2.  Open Termux and run these commands to prepare the environment:
    ```bash
    pkg update && pkg upgrade -y
    pkg install nodejs -y
    ```
3.  Navigate to your download folder.
    - If you are not sure where it is, you might need to grant storage permission first:
      ```bash
      termux-setup-storage
      ```
    - Then go to the folder (example if in Downloads):
      ```bash
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
