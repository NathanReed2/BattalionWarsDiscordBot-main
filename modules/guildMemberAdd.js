const VERIFIED_ROLE_ID = '1254576308843970593';
const UNVERIFIED_ROLE_ID = '830119466967760957';

// Minimum account age (days) required to be auto-verified
const MIN_ACCOUNT_AGE_DAYS = 90;
const MIN_ACCOUNT_AGE_MS = MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;

let autoVerifyEnabled = true;
function setAutoVerify(val) { autoVerifyEnabled = val; }
function getAutoVerify() { return autoVerifyEnabled; }

// Invite cache: guildId -> Map(inviteCode -> uses)
const inviteCache = new Map();
const { swapLangToVRoles } = require('./langRoles');

function setupGuildMemberAdd(client) {
    // Populate invite cache on ready
    client.on('ready', async () => {
        for (const [, guild] of client.guilds.cache) {
            try {
                const invites = await guild.invites.fetch();
                const map = new Map();
                invites.forEach(inv => map.set(inv.code, inv.uses ?? 0));
                inviteCache.set(guild.id, map);
            } catch (e) {
                console.warn(`Could not fetch invites for guild ${guild.id}:`, e.message || e);
            }
        }
    });

    // Update cache on invite create/delete (best-effort)
    client.on('inviteCreate', async invite => {
        try {
            const invites = await invite.guild.invites.fetch();
            const map = new Map();
            invites.forEach(inv => map.set(inv.code, inv.uses ?? 0));
            inviteCache.set(invite.guild.id, map);
        } catch (e) {
            console.warn(`Could not update invites cache on create for guild ${invite.guild.id}:`, e.message || e);
        }
    });
    client.on('inviteDelete', async invite => {
        try {
            const guild = invite.guild;
            const invites = await guild.invites.fetch();
            const map = new Map();
            invites.forEach(inv => map.set(inv.code, inv.uses ?? 0));
            inviteCache.set(guild.id, map);
        } catch (e) {
            console.warn(`Could not update invites cache on delete for guild ${invite.guild.id}:`, e.message || e);
        }
    });

    // Helper: determine if this join was via an invite (returns true/false or null on error/unknown)
    async function joinedViaInvite(guild) {
        try {
            const currentInvites = await guild.invites.fetch();
            const prevMap = inviteCache.get(guild.id) || new Map();
            // Compare uses:
            for (const inv of currentInvites.values()) {
                const prevUses = prevMap.get(inv.code) ?? 0;
                const currUses = inv.uses ?? 0;
                if (currUses > prevUses) {
                    // found an invite whose uses increased -> joined via invite
                    // update cache then return true
                    const newMap = new Map();
                    currentInvites.forEach(i => newMap.set(i.code, i.uses ?? 0));
                    inviteCache.set(guild.id, newMap);
                    return true;
                }
            }
            // No invite shows increased uses -> likely join without invite (discovery/other)
            const newMap = new Map();
            currentInvites.forEach(i => newMap.set(i.code, i.uses ?? 0));
            inviteCache.set(guild.id, newMap);
            return false;
        } catch (e) {
            console.warn(`Could not determine invite used for guild ${guild.id}:`, e.message || e);
            return null; // unknown
        }
    }

    client.on('guildMemberAdd', async member => {
        const verifiedRole = member.guild.roles.cache.get(VERIFIED_ROLE_ID);
        const unverifiedRole = member.guild.roles.cache.get(UNVERIFIED_ROLE_ID);

        // Check account age
        const accountAgeMs = Date.now() - member.user.createdTimestamp;
        const isTooNew = accountAgeMs < MIN_ACCOUNT_AGE_MS;

        try {
            // If account is too new, check whether the join was via an invite
            if (isTooNew) {
                const viaInvite = await joinedViaInvite(member.guild);
                // Only force unverified if we determined it's NOT via invite (false).
                // Treat unknown (null) as "no invite" to ensure new accounts that cannot be tied to an invite get unverified.
                if (viaInvite === false || viaInvite === null) {
                    // Remove roles and assign unverified
                    if (verifiedRole) await member.roles.remove(verifiedRole).catch(() => {});
                    if (unverifiedRole) {
                        await member.roles.add(unverifiedRole);
                        // swap language roles to -v versions (if any)
                        await swapLangToVRoles(member).catch(() => {});
                        console.log(`Assigned unverified to ${member.user.tag} (account age ${(accountAgeMs / (1000*60*60*24)).toFixed(1)} days) — joined without invite or invite unknown`);
                    } else {
                        console.warn('Unverified role not found; cannot assign to new account:', member.user.tag);
                    }
                    return;
                }
                // if viaInvite === true -> allow normal behavior below
                // if viaInvite === null -> previously conservative; now treated above as unverified
            }

            // Normal behavior based on autoVerify setting
            // Remove any existing verify/unverify roles first
            if (verifiedRole) await member.roles.remove(verifiedRole).catch(() => {});
            if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(() => {});

            if (autoVerifyEnabled && verifiedRole) {
                await member.roles.add(verifiedRole);
                console.log(`Assigned verified to ${member.user.tag}`);
            } else if (!autoVerifyEnabled && unverifiedRole) {
                await member.roles.add(unverifiedRole);
                console.log(`Assigned unverified to ${member.user.tag} (auto-verify disabled)`);
            }
        } catch (e) {
            console.error(`Error assigning roles to ${member.user.tag}:`, e);
        }
    });
}

module.exports = { setupGuildMemberAdd, setAutoVerify, getAutoVerify };
