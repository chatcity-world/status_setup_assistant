import { DEFAULT_FIELDS } from './status.js';
import { DEFAULT_HTML, DEFAULT_THEME } from './theme.js';

const defaults = {
    enabled: true,
    mode: 'each',
    position: 'below',
    fields: DEFAULT_FIELDS,
    html: DEFAULT_HTML,
    css: '',
    theme: DEFAULT_THEME,
};

const previousDefaultKeys = ['날짜', '시간', '날씨', '기온', '장소', '옷차림', '포즈', '커뮤니티글', '속마음', '애정', '죄책감', '욕구'];
const previousGauges = new Set(['애정', '죄책감', '욕구']);

function usesPreviousDefaults(settings) {
    return settings.html === DEFAULT_HTML && !settings.css && Array.isArray(settings.fields)
        && settings.fields.length === previousDefaultKeys.length
        && settings.fields.every(({ key, label, type, enabled, rule }, index) =>
            key === previousDefaultKeys[index] && label === key && enabled === true && !rule
            && type === (previousGauges.has(key) ? 'gauge' : 'text'));
}

function copySettings(saved) {
    const settings = {};
    for (const [key, value] of Object.entries(defaults)) {
        settings[key] = structuredClone(saved?.[key] ?? value);
    }
    if (usesPreviousDefaults(settings)) {
        // Keep the original affection key so previously recorded values still render.
        settings.fields = DEFAULT_FIELDS.map(field => ({
            ...field, key: field.key === '호감도' ? '애정' : field.key,
        }));
    }
    return settings;
}

export function loadRpSettings(saved) {
    const settings = copySettings(saved);
    settings.characterProfiles = {};
    for (const [key, profile] of Object.entries(saved?.characterProfiles ?? {})) {
        if (key.startsWith('avatar:') && profile?.settings) {
            settings.characterProfiles[key] = { active: profile.active !== false, settings: copySettings(profile.settings) };
        }
    }
    return settings;
}

export const profileKey = avatar => `avatar:${avatar}`;

export function getCharacterProfile(shared, avatar) {
    const profile = avatar ? shared?.characterProfiles[profileKey(avatar)] : undefined;
    return profile?.active ? profile : undefined;
}

export function getActiveSettings(shared, avatar) {
    return getCharacterProfile(shared, avatar)?.settings ?? shared;
}

export function saveCharacterProfile(shared, avatar) {
    if (!avatar || getCharacterProfile(shared, avatar)) return false;
    const key = profileKey(avatar);
    const existing = shared.characterProfiles[key];
    // Restore a profile turned off by an older version when its owner saves it again.
    if (existing) existing.active = true;
    else shared.characterProfiles[key] = { active: true, settings: copySettings(shared) };
    return true;
}

export function saveProfileSettings(shared, avatar, changes) {
    const settings = avatar ? getCharacterProfile(shared, avatar)?.settings : shared;
    if (!settings) return false;
    Object.assign(settings, changes);
    return true;
}

export function deleteCharacterProfile(shared, avatar) {
    if (!avatar || !Object.hasOwn(shared.characterProfiles, profileKey(avatar))) return false;
    delete shared.characterProfiles[profileKey(avatar)];
    return true;
}
