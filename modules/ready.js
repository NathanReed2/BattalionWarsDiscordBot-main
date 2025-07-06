const { SlashCommandBuilder } = require('@discordjs/builders');

const GUILD_ID = '188322587116306433';

async function setupCommands(client, guild) {
    // Clear all global commands
    await client.application.commands.set([]);
    // Clear all guild commands
    await guild.commands.set([]);

    const commands = [
        new SlashCommandBuilder().setName('ping').setDescription('Checks the ping time of the bot'),
        new SlashCommandBuilder()
            .setName('toggleverification')
            .setDescription('Toggle between automatic and manual verification')
            .addBooleanOption(option =>
                option.setName('enabled').setDescription('Enable or disable automatic verification').setRequired(true)
            ),
        new SlashCommandBuilder().setName('assault').setDescription('Get a weighted random assault mission name.'),
        new SlashCommandBuilder().setName('skirmish').setDescription('Get a weighted random skirmish mission name.'),
        new SlashCommandBuilder().setName('coop').setDescription('Get a weighted random coop mission name.'),
        new SlashCommandBuilder().setName('anymission').setDescription('Get a weighted random mission name from all categories.'),
        new SlashCommandBuilder().setName('membercount').setDescription('Get the current member count of the server.'),
        new SlashCommandBuilder().setName('missionchances').setDescription('Show the current % chance for all maps in the 2 commands.'),
        new SlashCommandBuilder().setName('debugbuffer').setDescription('shows the current buffer for a catagory and the % chance each slot gives.'),      
// new SlashCommandBuilder().setName('testmissions').setDescription('Show all missions for testing purposes.')
    ].map(cmd => cmd.toJSON());

    await guild.commands.set(commands);
}

function setupReady(client) {
    client.on('ready', async () => {
        console.log(`Bot is ready as: ${client.user.tag}`);
        const guild = client.guilds.cache.get(GUILD_ID);
        if (guild) {
            await setupCommands(client, guild);
        }
    });
}

module.exports = { setupReady };