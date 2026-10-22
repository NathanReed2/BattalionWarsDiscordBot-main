const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const GUILD_ID = '188322587116306433';
const CATEGORY_ID = '1280160927928553534';
const MOD_ROLE_ID = '207234190805041152';
const UNVERIFIED_ROLE_ID = '830119466967760957';
const imageChannelId = '836618101666611211';
const videoChannelId = '946218801828102184';
const additionalImageChannelId = '285274392059969546';

const BAN_ON_POST_CHANNEL_ID = '1522800908403212489';
const BAN_PURGE_WINDOW_MS = 60 * 60 * 1000;

function isImageChannel(id) {
    return id === imageChannelId || id === additionalImageChannelId;
}

function isVideoChannel(id) {
    return id === videoChannelId;
}

async function handleMessage(message, isEdit) {
    if (message.author.bot) return;

    // No longer delete system messages or moderate art/video channels.
    // Function is intentionally a no-op for now.
}

async function purgeLastHourMessagesFromUser(channel, userId) {
    if (!channel?.isTextBased?.() || channel.isDMBased?.() || typeof channel.bulkDelete !== 'function') {
        return 0;
    }

    const cutoff = Date.now() - BAN_PURGE_WINDOW_MS;
    let deletedCount = 0;
    let before;

    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
        if (!fetched || fetched.size === 0) break;

        const oldest = fetched.last();
        before = oldest?.id;

        const userRecentMessages = fetched.filter(
            msg => msg.author?.id === userId && msg.createdTimestamp >= cutoff
        );

        if (userRecentMessages.size > 0) {
            const deleted = await channel.bulkDelete(userRecentMessages, true).catch(() => null);
            if (deleted && deleted.size > 0) {
                deletedCount += deleted.size;
            }
        }

        if (!oldest || oldest.createdTimestamp < cutoff || fetched.size < 100) break;
    }

    return deletedCount;
}

async function purgeLastHourMessagesFromUserAcrossGuild(guild, me, userId) {
    if (!guild || !me) return 0;

    let deletedCount = 0;
    await guild.channels.fetch().catch(() => null);

    for (const channel of guild.channels.cache.values()) {
        if (!channel?.isTextBased?.() || channel.isDMBased?.() || typeof channel.bulkDelete !== 'function') {
            continue;
        }

        const perms = channel.permissionsFor(me);
        if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages])) {
            continue;
        }

        const channelDeleted = await purgeLastHourMessagesFromUser(channel, userId).catch(() => 0);
        deletedCount += channelDeleted;
    }

    return deletedCount;
}

function setupMessageCreate(client) {
    client.on('messageCreate', async message => {
        if (message.author.bot) return;

        if (message.channel.id === BAN_ON_POST_CHANNEL_ID) {
            if (!message.guild) {
                console.error(`[auto-ban] Ignored message in ${message.channel.id} because message.guild was null.`);
                return;
            }

            console.log(`[auto-ban] Triggered by ${message.author.tag} (${message.author.id}) in channel ${message.channel.id}.`);
            await message.delete().catch(err => console.error('[auto-ban] Failed to delete message:', err));

            const me = message.guild.members.me ?? await message.guild.members.fetchMe().catch(() => null);

            if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) {
                console.error('[auto-ban] Bot is missing the "Ban Members" permission. Cannot ban.');
                return;
            }

            try {
                await message.guild.members.ban(message.author.id, {
                    reason: `Automatic ban for posting in restricted channel (${BAN_ON_POST_CHANNEL_ID})`,
                });
                console.log(`[auto-ban] Successfully banned ${message.author.tag} (${message.author.id}).`);
            } catch (err) {
                console.error(`[auto-ban] Failed to ban ${message.author.id}:`, err);
            }

            const purged = await purgeLastHourMessagesFromUserAcrossGuild(message.guild, me, message.author.id);
            console.log(`[auto-ban] Purged ${purged} messages from ${message.author.tag} from the previous hour across all channels.`);

            return;
        }

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
            if (user) {
                await user.send(`**${message.author.tag}:** ${message.content}`).catch(console.error);
            }
        }

        // Also handle moderation for image/video channels.
        handleMessage(message, false);
    });
}

module.exports = { setupMessageCreate, handleMessage };
