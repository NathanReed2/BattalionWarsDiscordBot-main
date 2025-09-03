const UNVERIFIED_ROLE_ID = '830119466967760957';
const { LANG_TO_VROLE } = require('./langRoles');

function setupGuildMemberUpdate(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (oldMember.roles.cache.equals(newMember.roles.cache)) return;
        const roleMap = LANG_TO_VROLE;
        for (const [langRole, vRole] of Object.entries(roleMap)) {
            if (newMember.roles.cache.has(langRole) && !oldMember.roles.cache.has(langRole) && newMember.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                await newMember.roles.add(vRole).catch(console.error);
            } else if (!newMember.roles.cache.has(langRole) && oldMember.roles.cache.has(langRole)) {
                await newMember.roles.remove(vRole).catch(console.error);
            }
        }
    });
}

module.exports = { setupGuildMemberUpdate };
