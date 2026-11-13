export const STORE_KEY = 'gamja_rp_status';
export const AI_KEY = 'gamja_rp_status_ai';
const LEGACY_MANUAL_KEY = 'gamja_rp_status_manual';

export const DEFAULT_FIELDS = [
    { key: '날짜', label: '날짜', type: 'text', enabled: true },
    { key: '시간', label: '시간', type: 'text', enabled: true },
    { key: '날씨', label: '날씨', type: 'text', enabled: true },
    { key: '기온', label: '기온', type: 'text', enabled: true },
    { key: '장소', label: '장소', type: 'text', enabled: true },
    { key: '옷차림', label: '옷차림', type: 'text', enabled: true },
    { key: '포즈', label: '포즈', type: 'text', enabled: true },
    { key: '커뮤니티글', label: '커뮤니티글', type: 'text', enabled: true },
    { key: '속마음', label: '속마음', type: 'text', enabled: true },
    { key: '애정', label: '애정', type: 'gauge', enabled: true },
    { key: '죄책감', label: '죄책감', type: 'gauge', enabled: true },
    { key: '욕구', label: '욕구', type: 'gauge', enabled: true },
];

function validKey(key) {
    return typeof key === 'string' && key.length <= 40
        && /^[\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*$/u.test(key)
        && !['항목들', '__proto__', 'constructor', 'prototype'].includes(key)
        && !key.endsWith('_게이지');
}

export function createFieldKey(label, used) {
    const slug = label.normalize('NFC')
        .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_')
        .replace(/^[^\p{L}\p{N}]+|_+$/gu, '')
        .slice(0, 40)
        .replace(/[\uD800-\uDBFF]$/, '');
    const base = validKey(slug) ? slug : 'field';
    let key = base;
    for (let index = 2; used.has(key); index++) {
        const suffix = `_${index}`;
        key = base.slice(0, 40 - suffix.length).replace(/[\uD800-\uDBFF]$/, '') + suffix;
    }
    return key;
}

function normalizeValue(field, value) {
    if (value === null || (typeof value === 'string' && !value.trim())) return null;
    if (field.type === 'gauge') {
        const number = typeof value === 'string' && /^-?\d+(?:\.\d+)?\s*%?$/.test(value.trim())
            ? Number.parseFloat(value) : value;
        if (typeof number !== 'number' || !Number.isFinite(number)) return undefined;
        return Math.round(Math.max(0, Math.min(100, number)));
    }
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string') return value.trim();
    return undefined;
}

function cleanPatch(input, fields) {
    const result = {};
    for (const field of fields) {
        if (!input || !Object.hasOwn(input, field.key)) continue;
        const value = normalizeValue(field, input[field.key]);
        if (value !== undefined) result[field.key] = value;
    }
    return result;
}

function applyPatch(values, patch) {
    const updated = { ...values };
    for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete updated[key];
        else updated[key] = value;
    }
    return updated;
}

function different(left, right, fields) {
    return fields.some(({ key, enabled }) => {
        if (!enabled) return false;
        const before = Object.hasOwn(left, key) ? left[key] : undefined;
        const after = Object.hasOwn(right, key) ? right[key] : undefined;
        return before !== after;
    });
}

const PROTOCOL = /(?:^[ \t]*```(?:json)?[ \t]*\r?\n[ \t]*)?\[\[RP_STATUS\]\]([\s\S]*?)(\[\[\/RP_STATUS\]\]|(?![\s\S]))(?:[ \t]*\r?\n[ \t]*```[ \t]*(?=\r?$))?/gim;
const OPENING = '[[RP_STATUS]]';
const HAS_PROTOCOL = /\[\[RP_STATUS\]\]/i;
const FENCE_BEFORE_BLOCK = /(?:^|\n)[ \t]*```(?:json)?[ \t]*$/i;

export function stripStatus(text, streaming = false) {
    if (typeof text !== 'string') return text;
    let cleaned = HAS_PROTOCOL.test(text) ? text.replace(PROTOCOL, '').trimEnd() : text;
    if (streaming) {
        const marker = cleaned.lastIndexOf('[[');
        if (marker !== -1 && OPENING.startsWith(cleaned.slice(marker).toUpperCase())) {
            cleaned = cleaned.slice(0, marker).trimEnd().replace(FENCE_BEFORE_BLOCK, '').trimEnd();
        }
    }
    return cleaned;
}

const parsedMessages = new WeakMap();

function getRawPatch(message) {
    const text = typeof message.mes === 'string' ? message.mes : '';
    if (!HAS_PROTOCOL.test(text)) return {};
    const cached = parsedMessages.get(message);
    if (cached?.text === text) return cached.patch;

    const patch = Object.create(null);
    for (const match of text.matchAll(PROTOCOL)) {
        const [, body, closing] = match;
        if (!closing) continue;
        const json = body.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
        try {
            const value = JSON.parse(json);
            if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(patch, value);
        } catch {
            // A partial or malformed update does not change the scene.
        }
    }
    parsedMessages.set(message, { text, patch });
    return patch;
}

export function aiPatch(message, fields) {
    const decision = message.extra?.[AI_KEY];
    const parsed = decision?.ignore ? {} : getRawPatch(message);
    return { ...cleanPatch(decision?.base, fields), ...cleanPatch(parsed, fields) };
}

export function isAssistant(message) {
    return message && !message.is_user && !message.is_system && message.extra?.type !== 'narrator';
}

function isReply(message) {
    if (!isAssistant(message) || typeof message.mes !== 'string' || !message.mes.trim() || message.mes.trim() === '...') return false;
    return !Array.isArray(message.swipes) || (message.swipe_id ?? 0) < message.swipes.length;
}

export function timeline(chat, fields, streamingId = -1, locked = null) {
    let values = {};
    let previousReply = {};
    const cards = new Map();

    for (let id = 0; id < chat.length; id++) {
        const message = chat[id];
        if (!message) continue;
        // Replay values committed by older versions so existing chat history still renders.
        const legacy = cleanPatch(message[LEGACY_MANUAL_KEY], fields);
        if (Object.keys(legacy).length) values = applyPatch(values, legacy);
        if (locked?.has(message)) {
            values = applyPatch(values, cleanPatch(locked.get(message), fields));
            previousReply = values;
            continue;
        }
        if (id === streamingId) continue;
        if (!isReply(message)) continue;

        const automatic = aiPatch(message, fields);
        if (Object.keys(automatic).length) values = applyPatch(values, automatic);
        cards.set(id, { values, changed: different(previousReply, values, fields) });
        previousReply = values;
    }

    return { cards, values };
}

function promptJson(value) {
    return JSON.stringify(value).replaceAll('{{', '\\u007b\\u007b').replaceAll('}}', '\\u007d\\u007d');
}

export function promptFor(values, fields) {
    const active = fields.filter(field => field.enabled);
    if (!active.length) return '';
    const current = Object.fromEntries(active.filter(field => Object.hasOwn(values, field.key))
        .map(field => [field.key, values[field.key]]));
    const keys = active.map(field => `${field.key}${field.type === 'gauge' ? ' (integer 0–100)' : ''}`).join(', ');
    const labels = active.filter(field => field.label && field.label !== field.key)
        .map(field => [field.key, field.label]);
    const rules = active.map(field => [field.key, typeof field.rule === 'string' ? field.rule.trim() : ''])
        .filter(([, rule]) => rule);
    return [
        `Current roleplay scene state (JSON data): ${promptJson(current)}`,
        `Allowed state keys: ${keys}.`,
        ...(labels.length ? [`Field display names by key: ${promptJson(Object.fromEntries(labels))}`] : []),
        ...(rules.length ? [`Apply these writing rules only to the corresponding state values: ${promptJson(Object.fromEntries(rules))}`] : []),
        'Write the roleplay response first. If the response changes the scene, append one update block on its own lines using the exact markers below. Replace {} with a JSON object containing only the keys that changed. Use strings for text, integers for gauges, and null to clear a value.',
        'Keep unchanged values. Leave uncertain facts unset. Do not assign private thoughts, decisions, or actions to the user. If using 속마음, it refers to the speaking character.',
        'If no value changes, omit the block.',
        '[[RP_STATUS]]\n{}\n[[/RP_STATUS]]',
    ].join('\n');
}
