const UNVERIFIED_ROLE_ID = '830119466967760957';

function setupGuildMemberUpdate(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (oldMember.roles.cache.equals(newMember.roles.cache)) return;
        const roleMap = {
            '1242912525243387965': '1242967391177015428', // Spanish
            '1242912483501670400': '1242967518562488392', // Italian
            '1242912446738464778': '1242967468335435777', // English
            '1242912415570595891': '1242967312349266021', // Japanese
            '1242912381441675294': '1242967590385614890', // French
            '1242912264244428800': '1242967426006646856'  // German
        };
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
