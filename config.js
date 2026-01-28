module.exports = {
  connection: {
    host: 'watermelon.deze.me',
    port: 25565,
    username: '_AfkBot',
    version: false
  },
  settings: {
    afkDelay: 3000,
    reconnectDelay: 3000,
    stopOnDuplicateLogin: true,
    throttledReconnectDelayMs: 30000,
    throttledReconnectMaxMs: 120000,

    afkCommand: '/afk',
    sendAfkChat: true,

    randomWalk: {
      enabled: false,
      intervalMs: 15000,
      radius: 6
    },

    hungerThreshold: 10,
    healthThreshold: 10,

    lowFoodThresholdItems: 6,
    foodRequestIntervalMs: 45000,

    statusIntervalMs: 60000,

    // --- pre-connect ping ---
    preConnectPing: true,
    pingTimeoutMs: 2000,
    offlineBackoffBaseMs: 5000,
    offlineBackoffMaxMs: 60000,

    pingCheckIntervalMs: 5000,
    highPingThresholdMs: 250,
    highPingStrikes: 3,
    highPingRecoveryStrikes: 3,
    highPingHoldMs: 30000,

    // --- auto-eat tuning ---
    eatTimeoutMs: 9000,
    eatBackoffOnFailMs: 7000,

    // --- chat anti-spam ---
    chatCooldownMs: 1500,

    messagesPath: 'custom_messages/messages.json',

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
}
