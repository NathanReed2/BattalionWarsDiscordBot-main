const LANG_TO_VROLE = {
	'1242912525243387965': '1242967391177015428', // Spanish -> Spanish-v
	'1242912483501670400': '1242967518562488392', // Italian -> Italian-v
	'1242912446738464778': '1242967468335435777', // English -> English-v
	'1242912415570595891': '1242967312349266021', // Japanese -> Japanese-v
	'1242912381441675294': '1242967590385614890', // French -> French-v
	'1242912264244428800': '1242967426006646856'  // German -> German-v
};

async function swapLangToVRoles(member) {
	// No-op if member missing
	if (!member || !member.roles) return;
	for (const [langRoleId, vRoleId] of Object.entries(LANG_TO_VROLE)) {
		try {
			if (member.roles.cache.has(langRoleId)) {
				await member.roles.remove(langRoleId).catch(() => {});
				await member.roles.add(vRoleId).catch(() => {});
			}
		} catch (e) {
			console.warn(`swapLangToVRoles failed for ${member.user?.tag}:`, e?.message || e);
		}
	}
}

module.exports = { LANG_TO_VROLE, swapLangToVRoles };
