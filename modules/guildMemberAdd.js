const VERIFIED_ROLE_ID = '1254576308843970593';
const UNVERIFIED_ROLE_ID = '830119466967760957';

let autoVerifyEnabled = true;
function setAutoVerify(val) { autoVerifyEnabled = val; }
function getAutoVerify() { return autoVerifyEnabled; }

function setupGuildMemberAdd(client) {
    client.on('guildMemberAdd', async member => {
        const verifiedRole = member.guild.roles.cache.get(VERIFIED_ROLE_ID);
        const unverifiedRole = member.guild.roles.cache.get(UNVERIFIED_ROLE_ID);
        try {
            if (verifiedRole) await member.roles.remove(verifiedRole);
            if (unverifiedRole) await member.roles.remove(unverifiedRole);
            if (autoVerifyEnabled && verifiedRole) await member.roles.add(verifiedRole);
            else if (!autoVerifyEnabled && unverifiedRole) await member.roles.add(unverifiedRole);
        } catch (e) { console.error(`Error assigning roles to ${member.user.tag}:`, e); }
    });
}

module.exports = { setupGuildMemberAdd, setAutoVerify, getAutoVerify };
