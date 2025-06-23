const { handleMessage } = require('./messageCreate');

function setupMessageUpdate(client) {
    client.on('messageUpdate', (_, newMsg) => handleMessage(newMsg, true));
}

module.exports = { setupMessageUpdate };
