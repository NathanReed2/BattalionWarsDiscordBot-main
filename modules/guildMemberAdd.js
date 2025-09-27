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

    // Helper: determine how this member joined (returns 'invite', 'vanity', or 'unknown')
    async function determineJoinMethod(guild) {
        try {
            const currentInvites = await guild.invites.fetch();
            const prevMap = inviteCache.get(guild.id) || new Map();
            
            // Check if any invite usage increased
            for (const inv of currentInvites.values()) {
                const prevUses = prevMap.get(inv.code) ?? 0;
                const currUses = inv.uses ?? 0;
                if (currUses > prevUses) {
                    // Update cache and return invite join
                    const newMap = new Map();
                    currentInvites.forEach(i => newMap.set(i.code, i.uses ?? 0));
                    inviteCache.set(guild.id, newMap);
                    return 'invite';
                }
            }
            
            // No invite usage increased, update cache
            const newMap = new Map();
            currentInvites.forEach(i => newMap.set(i.code, i.uses ?? 0));
            inviteCache.set(guild.id, newMap);
            
            // Check if guild has vanity URL
            if (guild.vanityURLCode) {
                return 'vanity';
            }
            
            return 'unknown';
        } catch (e) {
            console.warn(`Could not determine join method for guild ${guild.id}:`, e.message || e);
            return 'unknown';
        }
    }

    client.on('guildMemberAdd', async member => {
        const verifiedRole = member.guild.roles.cache.get(VERIFIED_ROLE_ID);
        const unverifiedRole = member.guild.roles.cache.get(UNVERIFIED_ROLE_ID);

        // Check account age
        const accountAgeMs = Date.now() - member.user.createdTimestamp;
        const isTooNew = accountAgeMs < MIN_ACCOUNT_AGE_MS;

        try {
            // If account is too new, check how they joined
            if (isTooNew) {
                const joinMethod = await determineJoinMethod(member.guild);
                
                // Force unverified for vanity URL joins, non-invite joins, or unknown joins
                if (joinMethod === 'vanity' || joinMethod === 'unknown') {
                    // Remove roles and assign unverified
                    if (verifiedRole) await member.roles.remove(verifiedRole).catch(() => {});
                    if (unverifiedRole) {
                        await member.roles.add(unverifiedRole);
                        // swap language roles to -v versions (if any)
                        await swapLangToVRoles(member).catch(() => {});
                        
                        const joinMethodText = joinMethod === 'vanity' ? 'vanity URL' : 'unknown method';
                        console.log(`Assigned unverified to ${member.user.tag} (account age ${(accountAgeMs / (1000*60*60*24)).toFixed(1)} days) — joined via ${joinMethodText}`);
                    } else {
                        console.warn('Unverified role not found; cannot assign to new account:', member.user.tag);
                    }
                    return;
                }
                // if joinMethod === 'invite' -> allow normal behavior below
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
