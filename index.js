import {
    AI_KEY, STORE_KEY, aiPatch, isAssistant, promptFor, stripStatus, timeline,
} from './status.js';
import {
    deleteCharacterProfile, getActiveSettings, loadRpSettings, profileKey, saveCharacterProfile, saveProfileSettings,
} from './settings.js';
import { applyCardTypography, createCardRenderer } from './theme.js';
import { mountSettings } from './ui.js';

const getContext = () => SillyTavern.getContext();
const { eventSource, eventTypes: events, messageFormatter } = getContext();
let sharedSettings;
const renderCard = createCardRenderer();

let chatRoot;
let updateSettingsPanel;
let frame = 0;
let generation;
let lockedScroll = false;
let pendingSwipe;
let messageCards = [];
let alignmentFrame = 0;
const observedColumns = new Set();
const textResizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(requestAlignment) : null;

function contentEdges(element, style = getComputedStyle(element)) {
    const { left, right } = element.getBoundingClientRect();
    const pixels = property => Number.parseFloat(style[property]) || 0;
    return {
        left: left + pixels('borderLeftWidth') + pixels('paddingLeft'),
        right: right - pixels('borderRightWidth') - pixels('paddingRight'),
    };
}

function textEdges(body, columns) {
    let left = Infinity;
    let right = -Infinity;
    let typography;
    for (const paragraph of body.querySelectorAll('p')) {
        if (!paragraph.textContent.trim() || !paragraph.getClientRects().length) continue;
        if (body.contains(paragraph.closest('blockquote, details, table, li, [data-type="assistant_note"]'))) continue;
        const style = getComputedStyle(paragraph);
        const edges = contentEdges(paragraph, style);
        if (edges.right <= edges.left) continue;
        columns?.add(paragraph);
        typography ??= style;
        left = Math.min(left, edges.left);
        right = Math.max(right, edges.right);
    }
    if (!typography) {
        typography = getComputedStyle(body);
        return { ...contentEdges(body, typography), typography };
    }
    return { left, right, typography };
}

function previewTypography() {
    const body = messageCards.at(-1)?.body
        ?? chatRoot?.querySelector('.mes[is_user="false"] .mes_text')
        ?? chatRoot?.querySelector('.mes_text');
    if (!body) return getComputedStyle(document.body);
    return textEdges(body).typography;
}

function alignMessageCards() {
    const columns = new Set();
    const insets = [];
    // Measure the prose after all cards have been placed, then apply the new insets together.
    for (const { body, frame } of messageCards) {
        if (!frame.isConnected) continue;
        columns.add(body);
        const prose = textEdges(body, columns);
        const available = contentEdges(frame);
        if (Math.min(prose.right, available.right) <= Math.max(prose.left, available.left)) continue;
        insets.push({ frame, left: Math.max(0, prose.left - available.left), right: Math.max(0, available.right - prose.right), typography: prose.typography });
    }
    for (const { frame, left, right, typography } of insets) {
        frame.style.setProperty('--rp-status-text-left', `${left}px`);
        frame.style.setProperty('--rp-status-text-right', `${right}px`);
        applyCardTypography(frame, typography);
    }
    if (!textResizeObserver) return;
    for (const column of observedColumns) {
        if (columns.has(column)) continue;
        textResizeObserver.unobserve(column);
        observedColumns.delete(column);
    }
    for (const column of columns) {
        if (observedColumns.has(column)) continue;
        textResizeObserver.observe(column);
        observedColumns.add(column);
    }
}

function requestAlignment() {
    if (alignmentFrame) return;
    alignmentFrame = requestAnimationFrame(() => {
        alignmentFrame = 0;
        alignMessageCards();
        updateSettingsPanel?.refreshPreview();
    });
}

function getChatKey(context) {
    const id = context.getCurrentChatId();
    if (id == null) return null;
    const character = context.characters?.[context.characterId];
    return context.groupId ? JSON.stringify(['group', context.groupId, id])
        : JSON.stringify(['character', character?.avatar ?? context.characterId, id]);
}

function currentAvatar(context) {
    if (context.groupId || context.getCurrentChatId() == null) return undefined;
    return context.characters?.[context.characterId]?.avatar;
}

function settingsFor(context) {
    return getActiveSettings(sharedSettings, currentAvatar(context));
}

function streamingId(context) {
    const stream = context.streamingProcessor;
    return stream && !stream.isFinished && !stream.isStopped ? stream.messageId : -1;
}

function getTimeline(context, settings) {
    const stream = streamingId(context);
    const locked = new Map();
    if (pendingSwipe) {
        const { message, patch } = pendingSwipe;
        const awaitingSwipe = (message.swipe_id ?? 0) >= (message.swipes?.length ?? 0) || context.chat[stream] === message;
        if (awaitingSwipe && context.chat.includes(message)) locked.set(message, patch);
        else pendingSwipe = undefined;
    }
    if (stream >= 0 && generation?.continued && context.chat[stream] === generation.continued) {
        locked.set(generation.continued, generation.base);
    }
    return timeline(context.chat, settings.fields, stream, locked);
}

function render() {
    frame = 0;
    const context = getContext();
    const chatKey = getChatKey(context);
    const settings = settingsFor(context);
    const enabled = Boolean(chatKey && settings.enabled);
    const cards = enabled ? getTimeline(context, settings).cards : new Map();
    const wasAtBottom = chatRoot && chatRoot.scrollHeight - chatRoot.scrollTop - chatRoot.clientHeight < 45;
    const shouldFollow = wasAtBottom && !lockedScroll;
    lockedScroll = false;

    messageCards = [];
    for (const message of chatRoot?.children ?? []) {
        if (!message.matches('.mes[mesid]')) continue;
        const body = message.querySelector('.mes_text');
        const existing = [...message.querySelectorAll('.rp-status-message')];
        const row = cards.get(Number(message.getAttribute('mesid')));
        const shouldShow = enabled && row && (settings.mode === 'each' || row.changed);
        if (!body || !shouldShow) {
            existing.forEach(card => card.remove());
            continue;
        }

        let frame = existing.find(item => item.parentElement === body.parentElement
            && item.firstElementChild?.classList.contains('rp-status-message-card'));
        for (const item of existing) {
            if (item !== frame) item.remove();
        }
        if (!frame) {
            frame = document.createElement('div');
            frame.className = 'rp-status-message';
            const card = document.createElement('div');
            card.className = 'rp-status-message-card';
            frame.append(card);
        }
        const above = settings.position === 'above';
        if (above && frame.nextElementSibling !== body) body.before(frame);
        if (!above && frame.previousElementSibling !== body) body.after(frame);
        renderCard(frame.firstElementChild, settings.fields, row.values, settings.html, settings.css);
        messageCards.push({ body, frame });
    }
    alignMessageCards();

    updateSettingsPanel?.({ shared: sharedSettings, activeAvatar: currentAvatar(context) });
    if (shouldFollow) chatRoot.scrollTop = chatRoot.scrollHeight;
}

function requestRender() {
    if (!frame) frame = requestAnimationFrame(render);
}

function clearPrompt(context) {
    delete context.extensionPrompts[STORE_KEY];
}

function persistSettings(context) {
    const settings = settingsFor(context);
    if (!settings.enabled) clearPrompt(context);
    context.saveSettingsDebounced();
    requestRender();
}

function updateSettings(avatar, changes) {
    const context = getContext();
    if (avatar && !context.characters?.some(character => character?.avatar === avatar)) return false;
    if (!saveProfileSettings(sharedSettings, avatar, changes)) return false;
    persistSettings(context);
    return true;
}

function saveCurrentCharacter(avatar) {
    const context = getContext();
    if (avatar !== currentAvatar(context) || !saveCharacterProfile(sharedSettings, avatar)) return false;
    persistSettings(context);
    return true;
}

function removeCharacterProfile(avatar) {
    if (!sharedSettings || !deleteCharacterProfile(sharedSettings, avatar)) return false;
    const context = getContext();
    persistSettings(context);
    return true;
}

function writeDecision(extra, decision) {
    if (decision) extra[AI_KEY] = decision;
    else delete extra[AI_KEY];
}

function lockSwipe(id) {
    const context = getContext();
    const message = context.chat[id];
    const settings = settingsFor(context);
    if (!settings || !isAssistant(message) || !Array.isArray(message.swipes)) return;
    const candidate = message.swipes[message.swipe_id];
    if (candidate !== undefined) {
        if (pendingSwipe?.message === message) pendingSwipe = undefined;
    } else {
        pendingSwipe = { message, patch: aiPatch(message, settings.fields) };
    }
    requestRender();
}

globalThis.gamjaRpStatusPrepareGeneration = (coreChat, _maxTokens, _abort, type) => {
    const context = getContext();
    clearPrompt(context);
    for (const message of coreChat) {
        if (isAssistant(message)) message.mes = stripStatus(message.mes);
    }

    const settings = settingsFor(context);
    if (!settings || type === 'quiet' || type === 'impersonate') return;
    const chatKey = getChatKey(context);
    if (!chatKey) return;

    const previous = context.chat.at(-1);
    const reused = ['continue', 'swipe'].includes(type) && isAssistant(previous) ? previous : undefined;
    const continued = type === 'continue' ? reused : undefined;
    generation = {
        chatKey, enabled: settings.enabled,
        reused, swipeCount: reused?.swipes?.length ?? 0,
        continued, base: continued ? aiPatch(continued, settings.fields) : undefined,
    };

    if (!settings.enabled) return;
    const values = type === 'swipe' && isAssistant(previous)
        ? timeline(context.chat, settings.fields, -1, new Map([[previous, {}]])).values
        : getTimeline(context, settings).values;
    const prompt = promptFor(values, settings.fields, { character: context.name2, user: context.name1 });
    if (prompt) {
        // SillyTavern uses 1 for an in-chat prompt and 0 for the system role.
        context.setExtensionPrompt(STORE_KEY, prompt, 1, 0, false, 0, () => {
            const current = getContext();
            return settings.enabled && getChatKey(current) === chatKey
                && settingsFor(current) === settings;
        });
    }
};

function onReply(id, type) {
    const context = getContext();
    const message = context.chat[id];
    const chatKey = getChatKey(context);
    const settings = settingsFor(context);
    if (!settings || !chatKey || !isAssistant(message)) return;
    if (type !== 'first_message' && typeof message.mes === 'string') {
        const request = generation?.chatKey === chatKey ? generation : undefined;
        const automatic = settings.enabled && request?.enabled !== false;
        const base = request ? (request.continued === message ? request.base : undefined) : message.extra?.[AI_KEY]?.base;
        const decision = !automatic || (base && Object.keys(base).length) ? { ignore: !automatic, base } : undefined;
        writeDecision(message.extra ??= {}, decision);
        if (context.streamingProcessor?.messageId === Number(id) && Array.isArray(message.swipe_info)) {
            const start = request?.reused === message ? request.swipeCount : 0;
            const active = message.swipe_id ?? 0;
            for (const [index, swipe] of message.swipe_info.entries()) {
                if (swipe?.extra && (index === active || (request && index >= start))) writeDecision(swipe.extra, decision);
            }
        }
        generation = undefined;
        if (pendingSwipe?.message === message) pendingSwipe = undefined;
        clearPrompt(context);
    }
    requestRender();
}

function formatMessage(text, meta) {
    if (meta.isUser || meta.isSystem || meta.isReasoning || typeof text !== 'string') return text;
    const context = getContext();
    if (context.chat[meta.messageId] && !isAssistant(context.chat[meta.messageId])) return text;
    const streaming = context.streamingProcessor?.messageId === Number(meta.messageId) && !context.streamingProcessor.isFinished;
    return stripStatus(text, Boolean(streaming));
}

function initialize() {
    if (sharedSettings) return;
    const context = getContext();
    sharedSettings = context.extensionSettings[STORE_KEY] = loadRpSettings(context.extensionSettings[STORE_KEY]);
    chatRoot = document.querySelector('#chat');
    const extensionTab = document.querySelector('#extensions_settings2');
    if (extensionTab) {
        updateSettingsPanel = mountSettings(extensionTab, {
            getCharacters: () => getContext().characters ?? [],
            update: updateSettings,
            saveCurrent: saveCurrentCharacter,
            removeProfile: removeCharacterProfile,
            renderCard: createCardRenderer({ preview: true }),
            getPreviewTypography: previewTypography,
        });
    }
    if (chatRoot) {
        const observer = new MutationObserver(records => {
            for (const record of records) {
                if (record.target === chatRoot || record.target.parentElement === chatRoot
                    || (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].some(node =>
                        node.matches?.('.mes_text, .rp-status-message') || node.querySelector?.('.mes_text, .rp-status-message')))) {
                    requestRender();
                    return;
                }
            }
            if (records.some(record => record.target.closest?.('.mes_text'))) requestAlignment();
        });
        observer.observe(chatRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['mesid', 'swipeid'] });
        window.addEventListener('resize', requestAlignment);
    }
    requestRender();
}

messageFormatter.addHook(formatMessage, { stage: messageFormatter.stage.BEFORE_REGEX, order: messageFormatter.order.EARLY });
eventSource.on(events.APP_INITIALIZED, initialize);
eventSource.on(events.MESSAGE_RECEIVED, onReply);
eventSource.on(events.MESSAGE_DELETED, requestRender);
eventSource.on(events.MESSAGE_SWIPED, lockSwipe);
if (events.SETTINGS_UPDATED) eventSource.on(events.SETTINGS_UPDATED, requestAlignment);
eventSource.on(events.CHARACTER_RENAMED, (oldAvatar, newAvatar) => {
    const profiles = sharedSettings?.characterProfiles;
    const oldKey = profileKey(oldAvatar);
    if (!profiles || oldAvatar === newAvatar || !Object.hasOwn(profiles, oldKey)) return;
    profiles[profileKey(newAvatar)] = profiles[oldKey];
    delete profiles[oldKey];
    getContext().saveSettingsDebounced();
});
eventSource.on(events.CHARACTER_DELETED, ({ character }) => {
    removeCharacterProfile(character?.avatar);
});
eventSource.on(events.CHAT_CHANGED, () => {
    generation = undefined;
    pendingSwipe = undefined;
    clearPrompt(getContext());
    requestRender();
});
eventSource.on(events.MORE_MESSAGES_LOADED, () => {
    lockedScroll = true;
    requestRender();
});
eventSource.on(events.GENERATION_STOPPED, () => {
    generation = undefined;
    clearPrompt(getContext());
    requestRender();
});
for (const name of [
    'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED',
    'MESSAGE_SWIPE_DELETED', 'GENERATION_ENDED',
]) {
    eventSource.on(events[name], requestRender);
}
