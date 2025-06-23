require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { setupReady } = require('./modules/ready');
const { setupGuildMemberAdd } = require('./modules/guildMemberAdd');
const { setupGuildMemberUpdate } = require('./modules/guildMemberUpdate');
const { setupMessageCreate } = require('./modules/messageCreate');
const { setupMessageUpdate } = require('./modules/messageUpdate');
const { setupInteractionCreate } = require('./modules/interactionCreate');
const { setupErrorHandlers } = require('./modules/errorHandlers');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// Setup all event handlers
setupReady(client);
setupGuildMemberAdd(client);
setupGuildMemberUpdate(client);
setupMessageCreate(client);
setupMessageUpdate(client);
setupInteractionCreate(client);
setupErrorHandlers();

client.login(process.env.BOT_TOKEN);