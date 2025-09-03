const path = require('path');
const fs = require('fs');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { setAutoVerify } = require('./guildMemberAdd');
const { swapLangToVRoles } = require('./langRoles');
const LOG_CHANNEL_ID = '1242967139472773271';
const UNVERIFIED_ROLE_ID = '830119466967760957';
const VERIFIED_ROLE_ID = '1254576308843970593';
const imagePath = path.join(process.cwd(), 'images');

const data = {
    assault: [
        "LIGHTNING STRIKE",
        "DESTROY ALL TUNDRANS",
        "ACES HIGH",
        "STORM THE PALACE",
        "ARMADA",
        "COLD WAR"
    ],
    skirmish: [
        "BATTLESTATIONS",
        "EXCHANGE OF FIRE",
        "BORDER PATROL",
        "DONATSU ISLAND",
        "SAND CASTLES",
        "MELEE"
    ],
    coop: [
        "STORM THE BEACHES",
        "FROM TUNDRA WITH LOVE",
        "CRACK SQUAD",
        "UNDER SIEGE"
    ],
};
let lastSelectedMissions = { assault: null, skirmish: null, coop: null, anymission: null };

// --- Buffers for new commands ---
const PICK_BUFFER_SIZE = { assault: 12, skirmish: 12, coop: 8, anymission: 18 };
const pickBuffers = {
    assault: [],
    skirmish: [],
    coop: [],
    anymission: []
};

// Helper to fill buffer evenly with all missions, but randomly shuffled
function fillBufferEvenly(bufferName, missions) {
    const bufferSize = PICK_BUFFER_SIZE[bufferName];
    const perMission = Math.floor(bufferSize / missions.length);
    let remainder = bufferSize % missions.length;
    let bufferArr = [];
    for (const mission of missions) {
        for (let i = 0; i < perMission; i++) bufferArr.push(mission);
        if (remainder > 0) {
            bufferArr.push(mission);
            remainder--;
        }
    }
    // Shuffle the buffer so missions are randomly distributed
    for (let i = bufferArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bufferArr[i], bufferArr[j]] = [bufferArr[j], bufferArr[i]];
    }
    pickBuffers[bufferName] = bufferArr;
}

// Fill buffers on startup
fillBufferEvenly('assault', data.assault);
fillBufferEvenly('skirmish', data.skirmish);
fillBufferEvenly('coop', data.coop);
fillBufferEvenly('anymission', ['assault', 'skirmish', 'coop'].flatMap(cat => data[cat].map(m => `${cat}|${m}`)));

// Weighted random selection based on inverse pickrate
function weightedPick(missions, buffer, isAnyMission = false) {
    // Count occurrences
    const counts = {};
    for (const m of missions) counts[m] = 0;
    for (const pick of buffer) {
        let key = pick;
        if (isAnyMission) {
            // pick is "cat|mission"
            const [, mission] = pick.split('|');
            key = mission;
        }
        if (counts[key] !== undefined) counts[key]++;
    }
    const total = buffer.length;
    // Calculate base weights (inverse pickrate)
    let weights = missions.map(m => total === 0 ? 1 : 1 - (counts[m] / total));
    // Set a minimum weight to avoid zeroing out any mission
    const MIN_WEIGHT = 0.01;
    weights = weights.map(w => w > 0 ? w : MIN_WEIGHT);
    // Normalize weights so their sum is 1
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const normWeights = weights.map(w => w / weightSum);
    // Weighted random pick
    let r = Math.random();
    for (let i = 0; i < missions.length; i++) {
        if (r < normWeights[i]) return missions[i];
        r -= normWeights[i];
    }
    return missions[missions.length - 1];
}

function getMissionChances(missions, buffer, isAnyMission = false) {
    // Count occurrences
    const counts = {};
    for (const m of missions) counts[m] = 0;
    for (const pick of buffer) {
        let key = pick;
        if (isAnyMission) {
            // pick is "cat|mission"
            const [, mission] = pick.split('|');
            key = mission;
        }
        if (counts[key] !== undefined) counts[key]++;
    }
    const total = buffer.length;
    let weights = missions.map(m => total === 0 ? 1 : 1 - (counts[m] / total));
    const MIN_WEIGHT = 0.01;
    weights = weights.map(w => w > 0 ? w : MIN_WEIGHT);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const normWeights = weights.map(w => w / weightSum);
    return missions.map((m, i) => ({
        mission: m,
        percent: +(normWeights[i] * 100).toFixed(2)
    }));
}

function setupInteractionCreate(client) {
    client.on('interactionCreate', async interaction => {
        if (interaction.isCommand()) {
            const { commandName } = interaction;
            if (commandName === 'ping') {
                return interaction.reply(`Latency is ${Date.now() - interaction.createdTimestamp}ms.`);
            }
            if (commandName === 'toggleverification') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: 'You do not have permission to use this command.', flags: 1 << 6 });
                }
                await interaction.deferReply();
                setAutoVerify(interaction.options.getBoolean('enabled'));
                await interaction.editReply({
                    content: interaction.options.getBoolean('enabled')
                        ? 'Automatic verification is now enabled. New users will be assigned the verified role.'
                        : 'Automatic verification is now disabled. New users will be assigned the unverified role.'
                });
            }
            if (commandName === 'membercount') {
                const guild = interaction.guild;
                if (!guild) return interaction.reply('This command can only be used in a server.');
                const embed = new EmbedBuilder()
                    .setTitle('Server Member Count')
                    .setDescription(`👥 **${guild.memberCount.toLocaleString()}** Server Members`)
                    .setColor(0x5865F2)
                    .setThumbnail(guild.iconURL({ dynamic: true }))
                    .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
                return;
            }
            /* 
            if (['assault', 'skirmish', 'coop'].includes(commandName)) {
                // Pick a random mission (allow repeats)
                const randomMission = data[commandName][Math.floor(Math.random() * data[commandName].length)];
                const imageFilename = randomMission.replace(/\s+/g, '_') + '.png';
                const fullImagePath = path.join(imagePath, commandName, imageFilename);
                if (fs.existsSync(fullImagePath)) {
                    const embed = new EmbedBuilder().setTitle(randomMission).setImage(`attachment://${imageFilename}`);
                    await interaction.reply({ embeds: [embed], files: [fullImagePath] });
                } else {
                    await interaction.reply(randomMission);
                }
            }
            */
            if (['assault', 'skirmish', 'coop'].includes(commandName)) {
                const baseCommand = commandName;
                const missions = data[baseCommand];
                // Weighted pick
                const pick = weightedPick(missions, pickBuffers[baseCommand]);
                // Update buffer
                pickBuffers[baseCommand].push(pick);
                if (pickBuffers[baseCommand].length > PICK_BUFFER_SIZE[baseCommand]) pickBuffers[baseCommand].shift();
                const imageFilename = pick.replace(/\s+/g, '_') + '.png';
                const fullImagePath = path.join(imagePath, baseCommand, imageFilename);
                if (fs.existsSync(fullImagePath)) {
                    const embed = new EmbedBuilder().setTitle(pick).setImage(`attachment://${imageFilename}`);
                    await interaction.reply({ embeds: [embed], files: [fullImagePath] });
                } else {
                    await interaction.reply(pick);
                }
            }
            /* 
            if (commandName === 'anymission') {
                const missionCategories = ['assault', 'skirmish', 'coop'];
                const allMissions = missionCategories.flatMap(category =>
                    data[category].map(mission => ({ mission, category }))
                );
                if (!allMissions.length) return interaction.reply('No missions available.');
                // Pick a random mission (allow repeats)
                const randomSelection = allMissions[Math.floor(Math.random() * allMissions.length)];
                const imageFilename = randomSelection.mission.replace(/\s+/g, '_') + '.png';
                const fullImagePath = path.join(imagePath, randomSelection.category, imageFilename);
                if (fs.existsSync(fullImagePath)) {
                    const embed = new EmbedBuilder().setTitle(randomSelection.mission).setImage(`attachment://${imageFilename}`);
                    await interaction.reply({ embeds: [embed], files: [fullImagePath] });
                } else {
                    await interaction.reply(randomSelection.mission);
                }
            }
            */
            if (commandName === 'anymission') {
                const missionCategories = ['assault', 'skirmish', 'coop'];
                const allMissions = missionCategories.flatMap(category =>
                    data[category].map(mission => ({ mission, category }))
                );
                const missionKeys = allMissions.map(obj => `${obj.category}|${obj.mission}`);
                // Weighted pick
                const pickKey = weightedPick(missionKeys, pickBuffers.anymission, true);
                pickBuffers.anymission.push(pickKey);
                if (pickBuffers.anymission.length > PICK_BUFFER_SIZE.anymission) pickBuffers.anymission.shift();
                const [category, mission] = pickKey.split('|');
                const imageFilename = mission.replace(/\s+/g, '_') + '.png';
                const fullImagePath = path.join(imagePath, category, imageFilename);
                if (fs.existsSync(fullImagePath)) {
                    const embed = new EmbedBuilder().setTitle(mission).setImage(`attachment://${imageFilename}`);
                    await interaction.reply({ embeds: [embed], files: [fullImagePath] });
                } else {
                    await interaction.reply(mission);
                }
            }
            if (commandName === 'missionchances') {
                let reply = '';
                // assault
                reply += '**assault Chances:**\n';
                getMissionChances(data.assault, pickBuffers.assault).forEach(obj => {
                    reply += `- ${obj.mission}: ${obj.percent.toFixed(2)}%\n`;
                });
                // skirmish
                reply += '\n**skirmish Chances:**\n';
                getMissionChances(data.skirmish, pickBuffers.skirmish).forEach(obj => {
                    reply += `- ${obj.mission}: ${obj.percent.toFixed(2)}%\n`;
                });
                // coop
                reply += '\n**coop Chances:**\n';
                getMissionChances(data.coop, pickBuffers.coop).forEach(obj => {
                    reply += `- ${obj.mission}: ${obj.percent.toFixed(2)}%\n`;
                });
                // anymission
                const missionCategories = ['assault', 'skirmish', 'coop'];
                const allMissions = missionCategories.flatMap(category =>
                    data[category].map(mission => ({ mission, category }))
                );
                const missionKeys = allMissions.map(obj => `${obj.category}|${obj.mission}`);
                // Group by category for display
                const chances = getMissionChances(missionKeys, pickBuffers.anymission, true);
                reply += '\n**anymission Chances:**\n';
                for (const cat of missionCategories) {
                    reply += `*${cat.charAt(0).toUpperCase() + cat.slice(1)}*\n`;
                    chances.filter(obj => obj.mission.startsWith(cat + '|')).forEach(obj => {
                        const [, mission] = obj.mission.split('|');
                        reply += `- ${mission}: ${obj.percent.toFixed(2)}%\n`;
                    });
                }
                await interaction.reply({ content: reply, flags: 1 << 6 });
                return;
            }
            if (commandName === 'testmissions') {
                const missionCategories = [
                    { name: 'Assault', key: 'assault' },
                    { name: 'Skirmish', key: 'skirmish' },
                    { name: 'Co-op', key: 'coop' }
                ];
                let embeds = [];
                let files = [];
                for (const cat of missionCategories) {
                    for (const mission of data[cat.key]) {
                        const imageFilename = mission.replace(/\s+/g, '_') + '.png';
                        const fullImagePath = path.join(imagePath, cat.key, imageFilename);
                        if (fs.existsSync(fullImagePath)) {
                            embeds.push(
                                new EmbedBuilder()
                                    .setTitle(`${cat.name}: ${mission}`)
                                    .setImage(`attachment://${imageFilename}`)
                            );
                            files.push({ attachment: fullImagePath, name: imageFilename });
                        } else {
                            embeds.push(
                                new EmbedBuilder()
                                    .setTitle(`${cat.name}: ${mission}`)
                                    .setDescription('No image found.')
                            );
                        }
                    }
                }
                // Send an initial reply to acknowledge the interaction (ephemeral)
                await interaction.reply({ content: 'All missions listed below.', flags: 1 << 6 });
                // Send in batches of 10 embeds and 10 files per message
                for (let i = 0; i < embeds.length; i += 10) {
                    const embedBatch = embeds.slice(i, i + 10);
                    // Only include files for embeds that have images in this batch
                    const fileBatch = [];
                    for (let k = 0; k < embedBatch.length; k++) {
                        const embed = embedBatch[k];
                        const img = embed.data.image?.url;
                        if (img) {
                            // Find the file object by name
                            const fileObj = files.find(f => `attachment://${f.name}` === img);
                            if (fileObj && !fileBatch.some(f => f.name === fileObj.name)) {
                                fileBatch.push(fileObj);
                            }
                        }
                    }
                    await interaction.channel.send({
                        embeds: embedBatch,
                        files: fileBatch
                    });
                }
                return;
            }
            if (commandName === 'debugbuffer') {
                // Use getString for the option, which will be restricted to the choices set in ready.js
                const category = interaction.options.getString('category');
                const buffer = pickBuffers[category];
                if (!buffer || buffer.length === 0) {
                    return interaction.reply({ content: `Buffer for ${category} is empty.`, ephemeral: true });
                }
                let reply = `**Buffer for \`${category}\` (${buffer.length} slots):**\n`;
                // Count how many times each mission appears in the buffer
                const counts = {};
                buffer.forEach(item => {
                    let key = item;
                    if (category === 'anymission') {
                        const [, mission] = item.split('|');
                        key = mission;
                    }
                    counts[key] = (counts[key] || 0) + 1;
                });
                // For each slot, show the mission and the negative percent chance it contributes
                buffer.forEach((item, idx) => {
                    let label = item;
                    let key = item;
                    if (category === 'anymission') {
                        const [cat, mission] = item.split('|');
                        label = `[${cat}] ${mission}`;
                        key = mission;
                    }
                    // Each slot for a mission reduces its chance by (1/buffer.length) * 100%
                    const slotPercent = (100 / buffer.length);
                    reply += `Slot ${idx + 1}: ${label} (−${slotPercent.toFixed(2)}% for this mission)\n`;
                });
                // Optionally, show total negative percent for each mission
                reply += `\nTotal negative % per mission in buffer:\n`;
                Object.entries(counts).forEach(([mission, count]) => {
                    reply += `- ${mission}: −${(count * 100 / buffer.length).toFixed(2)}%\n`;
                });
                await interaction.reply({ content: reply, ephemeral: true });
                return;
            }
            if (commandName === 'forceunverify') {
                // Permission check: Administrator only
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                }

                // Defer the reply immediately to avoid "Unknown interaction" if operations take time
                await interaction.deferReply({ ephemeral: true }).catch(() => { /* ignore */ });

                const user = interaction.options.getUser('member');
                const reason = interaction.options.getString('reason') || 'No reason provided';
                if (!user) {
                    // If we deferred, use editReply; otherwise reply
                    try { return await interaction.editReply({ content: 'No member specified.' }); } catch (e) { return interaction.reply({ content: 'No member specified.', ephemeral: true }); }
                }
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (!member) {
                    try { return await interaction.editReply({ content: 'Member not found in this guild.' }); } catch (e) { return interaction.reply({ content: 'Member not found in this guild.', ephemeral: true }); }
                }

                try {
                    // Remove verified role and add unverified role
                    await member.roles.remove(VERIFIED_ROLE_ID).catch(() => {});
                    await member.roles.add(UNVERIFIED_ROLE_ID).catch(() => {});

                    // swap language roles to -v versions (if any)
                    await swapLangToVRoles(member).catch(() => {});

                    // Log to channel if available
                    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
                    if (logChannel) {
                        logChannel.send(`${interaction.user.tag} forced unverified: ${member.user.tag}. Reason: ${reason}`).catch(() => {});
                    }

                    // Reply (edit the deferred reply)
                    try {
                        await interaction.editReply({ content: `${member.user.tag} has been marked unverified.` });
                    } catch (err) {
                        // If interaction is unknown/expired, attempt a followUp, otherwise swallow
                        try { await interaction.followUp({ content: `${member.user.tag} has been marked unverified.`, ephemeral: true }); } catch (e) { /* ignore */ }
                    }
                } catch (e) {
                    console.error('Error in forceunverify:', e);
                    try {
                        await interaction.editReply({ content: 'An error occurred while trying to mark the member unverified.' });
                    } catch (err) {
                        try { await interaction.followUp({ content: 'An error occurred while trying to mark the member unverified.', ephemeral: true }); } catch (e2) { /* ignore */ }
                    }
                }
                return;
            }
        } else if (interaction.isButton() && interaction.customId.startsWith('verify-')) {
            const memberId = interaction.customId.split('-')[1];
            const member = interaction.guild.members.cache.get(memberId);
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            const rolesToRemove = [
                '1242967391177015428', '1242967518562488392', '1242967468335435777',
                '1242967312349266021', '1242967590385614890', '1242967426006646856', UNVERIFIED_ROLE_ID
            ];
            if (member) {
                try {
                    await member.roles.remove(rolesToRemove);
                    await member.roles.add(VERIFIED_ROLE_ID);
                    await interaction.reply({ content: `${member.user.tag} has been verified.`, flags: 1 << 6 });
                    if (logChannel) await logChannel.send(`<@${interaction.user.tag}> has verified <@${member.id}> (${member.user.tag}).`);
                    await interaction.channel.delete().catch(console.error);
                } catch (e) {
                    await interaction.reply({ content: 'There was an error removing the roles.', flags: 1 << 6 });
                }
            } else {
                await interaction.reply({
                    content: 'Member not found. Manual Role Removal Required remove any roles with -v and unverified and add verifyed.',
                    flags: 1 << 6,
                });
            }
        }
    });
}
module.exports = { setupInteractionCreate };