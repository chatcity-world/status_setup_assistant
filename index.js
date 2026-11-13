import {
    AI_KEY, STORE_KEY, aiPatch, isAssistant, promptFor, stripStatus, timeline,
} from './status.js';
import {
    deleteCharacterProfile, getActiveSettings, loadRpSettings, profileKey, saveCharacterProfile, saveProfileSettings,
} from './settings.js';
import { createCardRenderer } from './theme.js';
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
    const model = enabled ? getTimeline(context, settings) : { cards: new Map(), values: {} };
    const wasAtBottom = chatRoot && chatRoot.scrollHeight - chatRoot.scrollTop - chatRoot.clientHeight < 45;
    const shouldFollow = wasAtBottom && !lockedScroll;
    lockedScroll = false;

    for (const message of chatRoot?.children ?? []) {
        if (!message.matches('.mes[mesid]')) continue;
        const body = message.querySelector('.mes_text');
        let card = body?.parentElement.querySelector(':scope > .rp-status-message');
        const row = model.cards.get(Number(message.getAttribute('mesid')));
        const shouldShow = enabled && row && (settings.mode === 'each' || row.changed);
        if (!body || !shouldShow) {
            card?.remove();
            continue;
        }

        if (!card) {
            card = document.createElement('div');
            card.className = 'rp-status-message';
        }
        const above = settings.position === 'above';
        if (above && card.nextElementSibling !== body) body.before(card);
        if (!above && card.previousElementSibling !== body) body.after(card);
        renderCard(card, settings.fields, row.values, settings.html, settings.css);
    }

    updateSettingsPanel?.({ shared: sharedSettings, activeAvatar: currentAvatar(context), values: model.values });
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
    const prompt = promptFor(values, settings.fields);
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
            renderCard: createCardRenderer(),
        });
    }
    if (chatRoot) {
        const observer = new MutationObserver(records => {
            if (records.some(record => record.target === chatRoot || record.target.parentElement === chatRoot)) requestRender();
        });
        observer.observe(chatRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['mesid', 'swipeid'] });
    }
    requestRender();
}

messageFormatter.addHook(formatMessage, { stage: messageFormatter.stage.BEFORE_REGEX, order: messageFormatter.order.EARLY });
eventSource.on(events.APP_INITIALIZED, initialize);
eventSource.on(events.MESSAGE_RECEIVED, onReply);
eventSource.on(events.MESSAGE_DELETED, requestRender);
eventSource.on(events.MESSAGE_SWIPED, lockSwipe);
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
