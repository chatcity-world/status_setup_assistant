import { assignThemeVariables, DEFAULT_FIELDS } from './status.js';
import { DEFAULT_HTML, DEFAULT_THEME, LEGACY_DEFAULT_HTML, PREVIOUS_DEFAULT_HTML } from './theme.js';
import { syncThemeFields } from './theme-builder.js';
import { getThemePreset, makeThemePreset, normalizeThemeLayout, THEME_PRESETS } from './theme-presets.js';

const defaults = {
    enabled: true,
    mode: 'each',
    position: 'below',
    fields: DEFAULT_FIELDS,
    html: DEFAULT_HTML,
    css: '',
    theme: DEFAULT_THEME,
    themeLayouts: {},
    affinityRuleInitialized: false,
};

const previousDefaultKeys = ['날짜', '시간', '날씨', '기온', '장소', '옷차림', '포즈', '커뮤니티글', '속마음', '애정', '죄책감', '욕구'];
const previousGauges = new Set(['애정', '죄책감', '욕구']);
const previousDefaultRules = [
    ['날짜', '현재 롤플레잉 날짜를 YYYY년 MM월 DD일로 표시'],
    ['날씨', '현재 롤플레잉의 날씨를 짧은 단어로 표시'],
];
const previousAffinityRule = '현재 {{user}}에 대한 {{char}}의 호감도를 퍼센트(%)로 표시';
const defaultAffinityRule = DEFAULT_FIELDS.find(field => field.key === '호감도').rule;

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
    if (settings.html === LEGACY_DEFAULT_HTML || settings.html === PREVIOUS_DEFAULT_HTML) settings.html = DEFAULT_HTML;
    if (usesPreviousDefaults(settings)) {
        settings.fields = DEFAULT_FIELDS.map(field => ({ ...field, key: field.key === '호감도' ? '애정' : field.key }));
    }
    for (const [key, rule] of previousDefaultRules) {
        const field = settings.fields.find(field => field.key === key && field.rule === rule);
        if (field) field.rule = DEFAULT_FIELDS.find(field => field.key === key).rule;
    }
    if (!settings.affinityRuleInitialized) {
        const affinity = settings.fields.find(field => field.key === '호감도')
            ?? settings.fields.find(field => field.key === '애정');
        if (affinity?.type === 'gauge') {
            const rule = typeof affinity.rule === 'string' ? affinity.rule.trim() : '';
            if (!rule || rule === previousAffinityRule) affinity.rule = defaultAffinityRule;
        }
        settings.affinityRuleInitialized = true;
    }
    const fields = assignThemeVariables(settings.fields);
    const preset = getThemePreset(settings.html);
    const palette = THEME_PRESETS[preset];
    if (palette && (settings.themeLayouts[preset] || palette.slack || palette.widget)) {
        settings.themeLayouts[preset] = normalizeThemeLayout(fields, settings.themeLayouts[preset], palette);
        settings.html = makeThemePreset(palette, fields, settings.themeLayouts[preset]);
    } else {
        settings.html = syncThemeFields(settings.html, settings.fields, fields);
    }
    settings.fields = fields;
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
    if (changes.fields || changes.html !== undefined) {
        const fields = changes.fields ? assignThemeVariables(changes.fields) : settings.fields;
        const source = changes.html ?? settings.html;
        const themeLayouts = { ...(changes.themeLayouts ?? settings.themeLayouts) };
        const preset = getThemePreset(source);
        for (const [key, palette] of Object.entries(THEME_PRESETS)) {
            if (themeLayouts[key]) themeLayouts[key] = normalizeThemeLayout(fields, themeLayouts[key], palette);
        }
        const html = preset && themeLayouts[preset]
            ? makeThemePreset(THEME_PRESETS[preset], fields, themeLayouts[preset])
            : syncThemeFields(source, settings.fields, fields);
        changes = { ...changes, fields, html, themeLayouts };
    }
    Object.assign(settings, changes);
    return true;
}

export function deleteCharacterProfile(shared, avatar) {
    if (!avatar || !Object.hasOwn(shared.characterProfiles, profileKey(avatar))) return false;
    delete shared.characterProfiles[profileKey(avatar)];
    return true;
}
