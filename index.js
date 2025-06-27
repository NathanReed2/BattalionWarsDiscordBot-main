const fs = require('fs');
const path = require('path');

// --- Logging patch: log to both console and log.txt ---
const logFile = path.join(process.cwd(), 'log.txt');
function logToFile(type, args) {
    const msg = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
    fs.appendFileSync(logFile, msg);
}
['log', 'error', 'warn', 'info'].forEach(method => {
    const orig = console[method];
    console[method] = (...args) => {
        logToFile(method, args);
        orig.apply(console, args);
    };
});
// --- End logging patch ---

// Force dotenv to load .env from the current working directory (where the exe is run)
const dotenvPath = path.join(process.cwd(), '.env');
console.log('Loading .env from:', dotenvPath);
if (!fs.existsSync(dotenvPath)) {
    console.error('.env file not found at', dotenvPath);
} else {
    console.log('.env file found.');
}
require('dotenv').config({ path: dotenvPath });

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

// Check for missing or misconfigured .env file
if (!process.env.BOT_TOKEN) {
    console.error('Error: BOT_TOKEN is not set. Please ensure a .env file with BOT_TOKEN is present or set the BOT_TOKEN environment variable.');
    process.exit(1);
}

// Setup all event handlers
setupReady(client);
setupGuildMemberAdd(client);
setupGuildMemberUpdate(client);
setupMessageCreate(client);
setupMessageUpdate(client);
setupInteractionCreate(client);
setupErrorHandlers();

client.login(process.env.BOT_TOKEN);