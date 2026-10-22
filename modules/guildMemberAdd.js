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
// Vanity cache: guildId -> vanity uses count (null when unavailable)
const vanityUsesCache = new Map();
const { swapLangToVRoles } = require('./langRoles');

function setupGuildMemberAdd(client) {
    async function fetchInviteMap(guild) {
        const invites = await guild.invites.fetch();
        const map = new Map();
        invites.forEach(inv => map.set(inv.code, inv.uses ?? 0));
        return map;
    }

    async function fetchVanityUses(guild) {
        if (!guild.vanityURLCode) return null;
        try {
            const vanityData = await guild.fetchVanityData();
            return vanityData?.uses ?? 0;
        } catch (e) {
            // Missing permissions can block vanity data reads; treat as unknown.
            console.warn(`Could not fetch vanity data for guild ${guild.id}:`, e.message || e);
            return null;
        }
    }

    // Populate invite cache on ready
    client.on('ready', async () => {
        for (const [, guild] of client.guilds.cache) {
            try {
                inviteCache.set(guild.id, await fetchInviteMap(guild));
                vanityUsesCache.set(guild.id, await fetchVanityUses(guild));
            } catch (e) {
                console.warn(`Could not fetch invites for guild ${guild.id}:`, e.message || e);
            }
        }
    });

    // Update cache on invite create/delete (best-effort)
    client.on('inviteCreate', async invite => {
        try {
            inviteCache.set(invite.guild.id, await fetchInviteMap(invite.guild));
            vanityUsesCache.set(invite.guild.id, await fetchVanityUses(invite.guild));
        } catch (e) {
            console.warn(`Could not update invites cache on create for guild ${invite.guild.id}:`, e.message || e);
        }
    });
    client.on('inviteDelete', async invite => {
        try {
            const guild = invite.guild;
            inviteCache.set(guild.id, await fetchInviteMap(guild));
            vanityUsesCache.set(guild.id, await fetchVanityUses(guild));
        } catch (e) {
            console.warn(`Could not update invites cache on delete for guild ${invite.guild.id}:`, e.message || e);
        }
    });

    // Helper: determine how this member joined (returns 'invite', 'vanity', 'discovery', 'vanity_or_discovery', or 'unknown')
    async function determineJoinMethod(guild) {
        try {
            const currentInviteMap = await fetchInviteMap(guild);
            const currentVanityUses = await fetchVanityUses(guild);
            const prevMap = inviteCache.get(guild.id);
            const prevVanityUses = vanityUsesCache.get(guild.id);

            // Always refresh caches with latest snapshots.
            inviteCache.set(guild.id, currentInviteMap);
            vanityUsesCache.set(guild.id, currentVanityUses);

            // Without an invite baseline, do not infer join source from historical totals.
            if (!prevMap) {
                return 'unknown';
            }

            // Check if any tracked invite usage increased.
            for (const [code, currUses] of currentInviteMap.entries()) {
                const prevUses = prevMap.get(code);
                if (typeof prevUses !== 'number') continue;
                if (currUses > prevUses) {
                    return 'invite';
                }
            }

            // No invite increase: check vanity use delta.
            if (guild.vanityURLCode) {
                if (typeof prevVanityUses === 'number' && typeof currentVanityUses === 'number' && currentVanityUses > prevVanityUses) {
                    return 'vanity';
                }

                // Could not read vanity stats but member wasn't from tracked invites.
                if (currentVanityUses === null || typeof prevVanityUses !== 'number') {
                    return 'vanity_or_discovery';
                }
            }

            // No invite or vanity increase: most likely discovery/direct join.
            return 'discovery';
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
                
                // Force unverified for vanity/discovery-style joins when account is under minimum age.
                if (joinMethod === 'vanity' || joinMethod === 'discovery' || joinMethod === 'vanity_or_discovery') {
                    // Remove roles and assign unverified
                    if (verifiedRole) await member.roles.remove(verifiedRole).catch(() => {});
                    if (unverifiedRole) {
                        await member.roles.add(unverifiedRole);
                        // swap language roles to -v versions (if any)
                        await swapLangToVRoles(member).catch(() => {});
                        
                        const joinMethodText =
                            joinMethod === 'vanity'
                                ? 'vanity URL'
                                : joinMethod === 'discovery'
                                    ? 'discovery/direct join'
                                    : 'vanity or discovery (vanity data unavailable)';
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
