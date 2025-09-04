const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const GUILD_ID = '188322587116306433';
const CATEGORY_ID = '1280160927928553534';
const MOD_ROLE_ID = '207234190805041152';
const UNVERIFIED_ROLE_ID = '830119466967760957';
const LOG_CHANNEL_ID = '1242967139472773271';
const imageChannelId = '836618101666611211';
const videoChannelId = '946218801828102184';
const additionalImageChannelId = '285274392059969546';

function isImageChannel(id) {
    return id === imageChannelId || id === additionalImageChannelId;
}
function isVideoChannel(id) {
    return id === videoChannelId;
}
async function handleMessage(message, isEdit) {
    if (message.author.bot) return;

    // No longer delete system messages or moderate art/video channels
    // Function is now a no-op
}

function setupMessageCreate(client) {
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        if (message.channel.type === ChannelType.DM) {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) return;
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (!member) return;
            if (member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                let modmailChannel = guild.channels.cache.find(c => c.topic === message.author.id);
                if (!modmailChannel) {
                    modmailChannel = await guild.channels.create({
                        name: `DM-${message.author.username}`,
                        type: ChannelType.GuildText,
                        parent: CATEGORY_ID,
                        topic: message.author.id,
                        permissionOverwrites: [
                            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: MOD_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        ],
                    });
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`verify-${member.id}`).setLabel('Verify').setStyle(ButtonStyle.Primary)
                    );
                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle('Verification Required')
                        .setDescription(`User <@${member.id}> requires verification. Please click the button below to verify.`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    await modmailChannel.send({ embeds: [embed], components: [row] }).catch(console.error);
                }
                await modmailChannel.send(`<@${member.id}> (${message.author.tag}): ${message.content}`).catch(console.error);
                await message.channel.send('A verification request along with your message has been sent to the moderators.');
            } else {
                await message.channel.send('You do not have the required role for verification.');
            }
        } else if (message.channel.parentId === CATEGORY_ID && message.channel.topic) {
            const user = await client.users.fetch(message.channel.topic).catch(() => null);
            if (user) await user.send(`**${message.author.tag}:** ${message.content}`).catch(console.error);
        }
        // Also handle moderation for image/video channels
        handleMessage(message, false);
    });
}

module.exports = { setupMessageCreate, handleMessage };
