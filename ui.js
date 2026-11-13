import { generateTheme, combinedCode, setThemeBackground, syncThemeFields, themeBackground } from './theme-builder.js';
import { getCharacterProfile } from './settings.js';
import { DEFAULT_HTML, themeVariableNames } from './theme.js';
import { addThemeGroup, getLegacyThemePreset, getThemePreset, makeThemePreset, moveThemeItem, normalizeThemeLayout, THEME_PRESETS, useCustomThemeCode } from './theme-presets.js';
import { mountThemeLayout } from './theme-layout-ui.js';
import { createFieldKey, indexFields } from './status.js';

const DISPLAY_OPTIONS = `
    <div class="rp-status-selects">
        <label>표시 시점
            <select class="text_pole" data-setting="mode">
                <option value="each">AI 메시지마다</option>
                <option value="changes">상태가 바뀔 때만</option>
            </select>
        </label>
        <label>표시 위치
            <select class="text_pole" data-setting="position">
                <option value="above">AI 메시지 위</option>
                <option value="below">AI 메시지 아래</option>
            </select>
        </label>
    </div>`;

const FIELD_OPTIONS = `
    <form data-fields>
        <p class="rp-status-hint">값의 형식이나 길이를 정하고 싶은 항목에만 AI 작성 규칙을 적으세요.</p>
        <div class="rp-status-fields" data-field-list></div>
        <div class="rp-status-actions rp-status-field-actions">
            <button class="menu_button" type="button" data-action="add-field">항목 추가</button>
            <button class="menu_button" type="submit">항목 저장</button>
        </div>
    </form>`;

const HTML_OPTIONS = `
    <div class="rp-status-preview">
        <div class="rp-status-preview-label" data-preview-label>미리보기</div>
        <div data-preview-card></div>
    </div>
    <details class="rp-status-variables">
        <summary>사용할 수 있는 변수</summary>
        <p class="rp-status-hint">표시 이름으로 값 변수를 만들어요. 게이지 형식에는 막대 변수도 생겨요.</p>
        <dl data-theme-variables></dl>
    </details>
    <fieldset class="rp-status-theme-presets">
        <legend>테마</legend>
        <div class="rp-status-theme-choices">
            ${Object.entries(THEME_PRESETS).map(([key, preset]) => `
                <button class="rp-status-theme-choice" type="button" data-theme-preset="${key}" aria-pressed="false" title="${preset.label} 기본값으로 초기화">
                    <span class="rp-status-theme-swatch" style="background:${preset.swatch}" aria-hidden="true"></span>
                    ${preset.label}
                </button>`).join('')}
        </div>
    </fieldset>
    <fieldset class="rp-status-layout" data-theme-layout>
        <legend>배치·색상</legend>
        <p class="rp-status-hint" data-layout-hint hidden>기본 테마를 선택하면 항목의 배치를 편집할 수 있어요.</p>
        <label class="rp-status-layout-surface rp-status-layout-color" data-layout-surface hidden>
            <span>전체 배경</span>
            <span class="rp-status-color-chip"><input type="color" aria-label="상태창 전체 배경색"></span>
        </label>
        <div class="rp-status-layout-list" data-layout-items></div>
    </fieldset>
    <div class="rp-status-code-editor">
        <div class="rp-status-code-heading">
            <div class="rp-status-code-title">
                <label for="rp-status-html">상태창 테마 코드</label>
                <button class="menu_button rp-status-code-expand" type="button" data-action="expand-code"
                    aria-label="테마 코드 전체 보기" title="전체 보기" aria-haspopup="dialog" aria-controls="rp-status-code-dialog">
                    <i class="fa-solid fa-expand" aria-hidden="true"></i>
                </button>
            </div>
            <button class="menu_button" type="button" data-action="open-builder" aria-expanded="false" aria-controls="rp-status-theme-builder">직접 만들기</button>
        </div>
        <form id="rp-status-theme-builder" data-builder hidden>
            <label for="rp-theme-request">원하는 테마</label>
            <textarea id="rp-theme-request" class="text_pole" rows="3" placeholder="예: 별이 빛나는 밤하늘, 남색 배경과 은색 글자" required></textarea>
            <p class="rp-status-hint">저장한 항목의 변수를 넣어 만듭니다. 현재 연결된 AI를 사용하며 API 사용량이 발생할 수 있습니다.</p>
            <button type="submit" class="menu_button">테마 생성</button>
            <p class="rp-status-result rp-status-theme-result" role="status" data-theme-result></p>
        </form>
        <div data-code-slot>
            <textarea class="text_pole rp-status-code" id="rp-status-html" rows="12" wrap="soft" spellcheck="false"
                aria-label="상태창 테마 코드"></textarea>
        </div>
        <div class="rp-status-actions rp-status-code-actions">
            <button class="menu_button" type="button" data-action="apply-html">저장 및 적용</button>
            <button class="menu_button" type="button" data-action="copy-html">코드 복사</button>
        </div>
        <dialog id="rp-status-code-dialog" class="rp-status-code-dialog" aria-labelledby="rp-status-code-dialog-title">
            <div class="rp-status-code-heading">
                <strong id="rp-status-code-dialog-title">상태창 테마 코드</strong>
                <button class="menu_button" type="button" data-action="close-code" autofocus>닫기</button>
            </div>
        </dialog>
    </div>`;

const TABS = [
    ['display', '표시', DISPLAY_OPTIONS],
    ['fields', '항목', FIELD_OPTIONS],
    ['html', '테마 코드', HTML_OPTIONS],
];

function setupTabs(root, onSelect) {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    function select(index, focus = false) {
        tabs.forEach((tab, i) => {
            const active = i === index;
            tab.tabIndex = active ? 0 : -1;
            tab.setAttribute('aria-selected', String(active));
            root.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = !active;
        });
        root.querySelector('[data-editor-result]').textContent = '';
        if (focus) tabs[index].focus();
        onSelect();
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(index));
        tab.addEventListener('keydown', (event) => {
            const indexes = {
                ArrowLeft: (index - 1 + tabs.length) % tabs.length,
                ArrowRight: (index + 1) % tabs.length,
                Home: 0,
                End: tabs.length - 1,
            };
            if (!Object.hasOwn(indexes, event.key)) return;
            event.preventDefault();
            select(indexes[event.key], true);
        });
    });
    select(0);
}

function addFieldRow(container, field = { label: '', type: 'text', enabled: true }) {
    const row = document.createElement('div');
    row.className = 'rp-status-field-editor';
    row.setAttribute('role', 'group');
    if (field.key) row.dataset.key = field.key;
    row.innerHTML = `
        <div class="rp-status-field-header">
            <strong data-field-title></strong>
            <div class="rp-status-field-tools">
                <label class="rp-status-field-enabled"><input type="checkbox" data-field="enabled"> 표시</label>
                <button class="menu_button" type="button" data-field-delete>삭제</button>
            </div>
        </div>
        <label>표시 이름<input class="text_pole" data-field="label" maxlength="48" required autocomplete="off"></label>
        <label>형식<select class="text_pole" data-field="type"><option value="text">텍스트</option><option value="gauge">게이지</option></select></label>
        <label class="rp-status-field-rule">AI 작성 규칙 (선택)<textarea class="text_pole" data-field="rule" rows="2" placeholder="AI에게 전달할 해당 변수에 대한 짧은 설명"></textarea></label>`;
    for (const input of row.querySelectorAll('[data-field]')) {
        const value = field[input.dataset.field];
        if (input.type === 'checkbox') input.checked = value;
        else input.value = value ?? '';
    }
    const label = row.querySelector('[data-field="label"]');
    const heading = row.querySelector('[data-field-title]');
    const remove = row.querySelector('[data-field-delete]');
    const updateHeading = () => {
        const name = label.value.trim() || '새 항목';
        heading.textContent = name;
        row.setAttribute('aria-label', name);
        remove.setAttribute('aria-label', name + ' 삭제');
    };
    updateHeading();
    label.addEventListener('input', () => {
        label.setCustomValidity('');
        updateHeading();
    });
    remove.addEventListener('click', () => {
        const next = row.nextElementSibling ?? row.previousElementSibling;
        const focusTarget = next?.querySelector('[data-field="label"]')
            ?? container.closest('form').querySelector('[data-action="add-field"]');
        row.remove();
        focusTarget.focus();
    });
    container.append(row);
    return label;
}

function showThemeVariables(list, fields) {
    const entries = [['값이 있는 표시 항목 전체', ['항목들']]];
    for (const field of fields) {
        if (field.enabled) entries.push([field.label, themeVariableNames(field)]);
    }
    list.replaceChildren(...entries.flatMap(([label, keys]) => {
        const name = document.createElement('dt');
        name.textContent = label;
        const value = document.createElement('dd');
        for (const key of keys) {
            const token = document.createElement('code');
            token.textContent = '{{' + key + '}}';
            value.append(token);
        }
        return [name, value];
    }));
}

const SAMPLE_VALUES = {
    날짜: '2026년 11월 13일', 시간: '19:30', 날씨: '☀️ 맑음', 기온: '12°C',
    장소: '타로점', 옷차림: '검은 재킷', 호감도: 65, 속마음: '조금 더 같이 있고 싶다.',
};

async function copyText(textarea) {
    try {
        await navigator.clipboard.writeText(textarea.value);
        return true;
    } catch {
        textarea.focus();
        textarea.select();
        try {
            return document.execCommand('copy');
        } catch {
            return false;
        }
    }
}

export function mountSettings(target, { getCharacters, update, saveCurrent, removeProfile, renderCard }) {
    const drawer = document.createElement('div');
    drawer.className = 'inline-drawer';
    drawer.innerHTML = `
        <div class="inline-drawer-toggle inline-drawer-header" role="button" tabindex="0" aria-expanded="false" aria-controls="rp-status-drawer-content">
            <b>📊 헬프미상태창</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down" aria-hidden="true"></div>
        </div>
        <div class="inline-drawer-content" id="rp-status-drawer-content"></div>`;
    const header = drawer.firstElementChild;
    const icon = header.querySelector('.inline-drawer-icon');
    const content = drawer.lastElementChild;
    const root = document.createElement('div');
    root.className = 'rp-status-settings';
    root.innerHTML = `
        <div class="rp-status-settings-body">
            <label class="rp-status-switch">
                <span>상태창 사용</span>
                <input type="checkbox" role="switch" data-setting="enabled" disabled>
                <span class="rp-status-switch-track" aria-hidden="true"></span>
            </label>
            <div class="rp-status-scope">
                <fieldset id="rp-status-scope" class="rp-status-scope-switch">
                    <legend>설정 범위</legend>
                    <div class="rp-status-scope-options">
                        <label class="rp-status-scope-choice">
                            <input type="radio" name="rp-status-scope" value="shared" checked>
                            <span>공통</span>
                        </label>
                        <label class="rp-status-scope-choice">
                            <input type="radio" name="rp-status-scope" value="character">
                            <span>캐릭터별</span>
                        </label>
                    </div>
                </fieldset>
                <div class="rp-status-character-picker" data-character-picker hidden>
                    <div class="rp-status-saved-profile" data-saved-profile hidden>
                        <label for="rp-status-character">저장된 캐릭터</label>
                        <div class="rp-status-character-controls">
                            <select class="text_pole" id="rp-status-character"></select>
                            <button class="rp-status-profile-button rp-status-profile-delete" type="button" data-profile-delete>삭제</button>
                        </div>
                    </div>
                    <p class="rp-status-hint" data-no-profiles hidden>저장된 상태창이 없어요.</p>
                    <div class="rp-status-delete-confirm" data-delete-confirm hidden>
                        <p class="rp-status-delete-title" id="rp-status-delete-title" data-delete-message></p>
                        <p class="rp-status-hint">삭제하면 공통 설정으로 돌아가요.</p>
                        <div class="rp-status-actions">
                            <button class="rp-status-profile-button" type="button" data-cancel-delete>취소</button>
                            <button class="rp-status-profile-button rp-status-confirm-button" type="button" aria-describedby="rp-status-delete-title" data-confirm-delete>삭제</button>
                        </div>
                    </div>
                    <div class="rp-status-current-character" data-current-row hidden>
                        <p class="rp-status-hint" data-current-character></p>
                        <button class="rp-status-profile-button rp-status-profile-save" type="button" data-profile-save hidden>상태창 저장</button>
                    </div>
                </div>
                <p class="rp-status-announcement" role="status" data-profile-result></p>
            </div>
            <div class="rp-status-profile-editor" data-profile-editor hidden>
                <div class="rp-status-tabs" role="tablist" aria-label="상태창 설정">
                    ${TABS.map(([key, label]) => `<button type="button" role="tab" id="rp-status-tab-${key}" aria-controls="rp-status-panel-${key}">${label}</button>`).join('')}
                </div>
                ${TABS.map(([key, , content]) => `<section role="tabpanel" id="rp-status-panel-${key}" aria-labelledby="rp-status-tab-${key}" hidden>${content}</section>`).join('')}
                <p class="rp-status-result" role="status" data-editor-result></p>
            </div>
        </div>`;
    content.append(root);
    target.append(drawer);

    const scope = root.querySelector('#rp-status-scope');
    const characterScopeInput = scope.querySelector('[value="character"]');
    const enabledSwitch = root.querySelector('[data-setting="enabled"]');
    const characterPicker = root.querySelector('[data-character-picker]');
    const savedProfile = root.querySelector('[data-saved-profile]');
    const noProfiles = root.querySelector('[data-no-profiles]');
    const characterSelect = root.querySelector('#rp-status-character');
    const profileSave = root.querySelector('[data-profile-save]');
    const profileDelete = root.querySelector('[data-profile-delete]');
    const deleteConfirm = root.querySelector('[data-delete-confirm]');
    const deleteMessage = root.querySelector('[data-delete-message]');
    const confirmDelete = root.querySelector('[data-confirm-delete]');
    const cancelDelete = root.querySelector('[data-cancel-delete]');
    const currentRow = root.querySelector('[data-current-row]');
    const currentCharacterLabel = root.querySelector('[data-current-character]');
    const profileResult = root.querySelector('[data-profile-result]');
    const profileEditor = root.querySelector('[data-profile-editor]');
    const html = root.querySelector('#rp-status-html');
    const codeSlot = root.querySelector('[data-code-slot]');
    const codeDialog = root.querySelector('#rp-status-code-dialog');
    const expandCode = root.querySelector('[data-action="expand-code"]');
    const themePanel = root.querySelector('#rp-status-panel-html');
    const previewCard = root.querySelector('[data-preview-card]');
    const previewLabel = root.querySelector('[data-preview-label]');
    const result = root.querySelector('[data-editor-result]');
    const fields = root.querySelector('[data-field-list]');
    const variables = root.querySelector('[data-theme-variables]');
    const builder = root.querySelector('[data-builder]');
    const builderToggle = root.querySelector('[data-action="open-builder"]');
    const presetButtons = [...root.querySelectorAll('[data-theme-preset]')];
    const layoutEditor = root.querySelector('[data-theme-layout]');
    const themeDescription = root.querySelector('#rp-theme-request');
    const generateButton = builder.querySelector('button');
    const themeResult = builder.querySelector('[data-theme-result]');
    let state;
    let settings;
    let editedAvatar;
    let selectedAvatar;
    let deleteAvatar;
    let characterList = '';
    let themeGeneration;
    let previewValues = {};
    let previewFrame = 0;
    let draftPreset;
    let draftLayouts = {};
    const renderLayoutEditor = mountThemeLayout(layoutEditor, changeLayout);

    function paintPreview() {
        if (!settings || themePanel.hidden || !icon.classList.contains('up') || previewFrame) return;
        previewFrame = requestAnimationFrame(() => {
            previewFrame = 0;
            if (!settings || themePanel.hidden || !icon.classList.contains('up')) return;
            const enabled = settings.fields.filter(field => field.enabled);
            const hasValues = enabled.some(field => Object.hasOwn(previewValues, field.key));
            const sample = Object.fromEntries(enabled.map(field => {
                const fallback = field.type === 'gauge' ? 50 : '예시';
                const sampleKey = field.variable ?? field.key;
                return [field.key, Object.hasOwn(SAMPLE_VALUES, sampleKey) ? SAMPLE_VALUES[sampleKey] : fallback];
            }));
            const previewingPreset = Boolean(draftPreset);
            const values = !hasValues || previewingPreset ? { ...sample, ...previewValues } : previewValues;
            const hasSample = (!hasValues || previewingPreset) && enabled.some(field => !Object.hasOwn(previewValues, field.key));
            previewLabel.textContent = hasSample ? '미리보기 · 예시 값 포함' : '미리보기';
            renderCard(previewCard, settings.fields, values, html.value || DEFAULT_HTML, '');
        });
    }

    function syncPresetSelection() {
        for (const button of presetButtons) {
            button.setAttribute('aria-pressed', String(button.dataset.themePreset === draftPreset));
        }
        const background = settings && !draftPreset ? themeBackground(html.value || DEFAULT_HTML) : undefined;
        renderLayoutEditor(draftPreset, draftLayouts[draftPreset], settings?.fields, Boolean(themeGeneration), background);
    }

    function updateThemeDraft(code) {
        html.value = code;
        draftPreset = getThemePreset(code) ?? getLegacyThemePreset(code);
        if (draftPreset) draftLayouts[draftPreset] = normalizeThemeLayout(settings.fields, draftLayouts[draftPreset]);
        syncPresetSelection();
        paintPreview();
    }

    function showPreset(preset) {
        updateThemeDraft(makeThemePreset(THEME_PRESETS[preset], settings.fields, draftLayouts[preset]));
    }

    function changeLayout({ key, direction, group, property, value }) {
        if (!settings || themeGeneration) return;
        if (!draftPreset) {
            if (!key && !group && property === 'background') {
                updateThemeDraft(setThemeBackground(html.value || DEFAULT_HTML, value));
                showResult('');
            }
            return;
        }
        const layout = draftLayouts[draftPreset];
        const item = layout.items.find(item => item.key === key);
        if (direction) {
            const visibleKeys = new Set(settings.fields.filter(field => field.enabled).map(field => field.key));
            layout.items = moveThemeItem(layout.items, key, direction, visibleKeys);
        } else if (group) {
            layout.groups[group][property] = value;
        } else if (item) {
            item[property] = property === 'group' && value === 'new' ? addThemeGroup(layout) : value;
        } else if (!key && property === 'background') {
            layout.background = value;
        }
        showPreset(draftPreset);
        showResult('');
    }

    function syncControls() {
        for (const input of root.querySelectorAll('[data-setting]')) {
            const key = input.dataset.setting;
            if (input.type === 'checkbox') input.checked = settings[key];
            else input.value = settings[key];
        }
    }

    function showResult(message) {
        result.textContent = message;
    }

    function syncThemeBuilder() {
        generateButton.disabled = Boolean(themeGeneration);
        generateButton.textContent = themeGeneration ? '생성 중…' : '테마 생성';
        html.readOnly = Boolean(themeGeneration);
        for (const button of presetButtons) button.disabled = Boolean(themeGeneration);
        layoutEditor.disabled = Boolean(themeGeneration);
    }

    function syncCharacters() {
        const characters = getCharacters().filter(character => character?.avatar);
        const current = characters.find(character => character.avatar === state.activeAvatar);
        const saved = characters.filter(({ avatar }) => getCharacterProfile(state.shared, avatar));
        const options = saved.map(({ avatar, name }) => [avatar, name || avatar]);
        const signature = JSON.stringify(options);
        if (signature !== characterList) {
            characterList = signature;
            const names = new Map();
            for (const [, name] of options) names.set(name, (names.get(name) ?? 0) + 1);
            characterSelect.replaceChildren(...options.map(([avatar, name]) => {
                const option = document.createElement('option');
                option.value = avatar;
                option.textContent = names.get(name) > 1 ? name + ' (' + avatar + ')' : name;
                return option;
            }));
        }
        const selected = saved.find(character => character.avatar === selectedAvatar)
            ?? saved.find(character => character.avatar === state.activeAvatar)
            ?? saved[0];
        selectedAvatar = selected?.avatar;
        characterSelect.value = selectedAvatar ?? '';
        characterSelect.disabled = !selected;
        savedProfile.hidden = !selected;
        noProfiles.hidden = Boolean(selected);
        const alreadySaved = Boolean(getCharacterProfile(state.shared, current?.avatar));
        const canSave = Boolean(current && !alreadySaved);
        profileSave.hidden = !canSave;
        profileSave.disabled = !canSave;
        currentRow.hidden = Boolean(current && alreadySaved && current.avatar === selectedAvatar);
        currentCharacterLabel.textContent = current
            ? '현재 채팅: ' + (current.name || current.avatar)
            : '1:1 채팅을 열면 상태창을 저장할 수 있어요.';
        return selected;
    }

    function syncPanel() {
        if (!state) return;
        const characterScope = characterScopeInput.checked;
        characterPicker.hidden = !characterScope;
        const character = characterScope ? syncCharacters() : undefined;
        const avatar = character?.avatar;
        const profile = getCharacterProfile(state.shared, avatar);
        const next = characterScope ? profile?.settings : state.shared;
        profileEditor.hidden = !next;
        enabledSwitch.disabled = !next;
        enabledSwitch.checked = Boolean(next?.enabled);
        if (!characterScope || deleteAvatar !== avatar) deleteAvatar = undefined;
        profileDelete.disabled = Boolean(deleteAvatar);
        deleteConfirm.hidden = !deleteAvatar;
        if (character) {
            const name = character.name || character.avatar;
            profileDelete.setAttribute('aria-label', name + ' 상태창 삭제');
            if (deleteAvatar) deleteMessage.textContent = '‘' + name + '’의 상태창을 삭제할까요?';
        }

        if (settings !== next || editedAvatar !== avatar) {
            if (codeDialog.open) codeDialog.close();
            editedAvatar = avatar;
            settings = next;
            draftLayouts = structuredClone(next?.themeLayouts ?? {});
            updateThemeDraft(next ? combinedCode(next) : '');
            fields.replaceChildren();
            if (next) {
                for (const field of next.fields) addFieldRow(fields, field);
                showThemeVariables(variables, next.fields);
                syncControls();
            }
            themeGeneration = undefined;
            themeDescription.value = '';
            themeResult.textContent = '';
            builder.hidden = true;
            builderToggle.setAttribute('aria-expanded', 'false');
            syncThemeBuilder();
            showResult('');
        }
        previewValues = !characterScope || avatar === state.activeAvatar ? state.values : {};
        paintPreview();
    }

    function saveChanges(changes) {
        if (!settings || !update(editedAvatar, changes)) return false;
        syncPanel();
        return true;
    }

    scope.addEventListener('change', () => {
        profileResult.textContent = '';
        syncPanel();
    });
    characterSelect.addEventListener('change', () => {
        profileResult.textContent = '';
        selectedAvatar = characterSelect.value;
        syncPanel();
    });
    profileSave.addEventListener('click', () => {
        const avatar = state?.activeAvatar;
        if (!avatar || !saveCurrent(avatar)) return;
        deleteAvatar = undefined;
        selectedAvatar = avatar;
        syncPanel();
        profileResult.textContent = '현재 캐릭터에 상태창을 저장했어요.';
        characterSelect.focus();
    });
    profileDelete.addEventListener('click', () => {
        if (!editedAvatar) return;
        deleteAvatar = editedAvatar;
        profileResult.textContent = '';
        syncPanel();
        cancelDelete.focus();
    });
    function cancelRemoval() {
        deleteAvatar = undefined;
        syncPanel();
        profileDelete.focus();
    }
    cancelDelete.addEventListener('click', cancelRemoval);
    deleteConfirm.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        cancelRemoval();
    });
    confirmDelete.addEventListener('click', () => {
        if (!deleteAvatar || deleteAvatar !== editedAvatar || !removeProfile(deleteAvatar)) return;
        deleteAvatar = undefined;
        syncPanel();
        profileResult.textContent = '캐릭터의 상태창을 삭제했어요.';
        if (!characterSelect.disabled) characterSelect.focus();
        else if (!profileSave.disabled) profileSave.focus();
        else characterScopeInput.focus();
    });

    for (const input of root.querySelectorAll('[data-setting]')) {
        input.addEventListener('change', () => {
            if (saveChanges({ [input.dataset.setting]: input.type === 'checkbox' ? input.checked : input.value })) syncControls();
        });
    }
    header.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!event.repeat) header.click();
    });
    // SillyTavern toggles the icon and body through its shared drawer handler.
    const drawerObserver = new MutationObserver(() => {
        const open = icon.classList.contains('up');
        header.setAttribute('aria-expanded', String(open));
        if (open) syncPanel();
        else if (codeDialog.open) codeDialog.close();
    });
    drawerObserver.observe(icon, { attributes: true, attributeFilter: ['class'] });
    html.addEventListener('input', () => {
        if (draftPreset || getThemePreset(html.value) || getLegacyThemePreset(html.value)) {
            const code = html.value;
            const start = html.selectionStart;
            const end = html.selectionEnd;
            html.value = useCustomThemeCode(code);
            const marker = html.value.indexOf(' data-rp-status-custom');
            const added = html.value.length - code.length;
            if (added > 0 && marker >= 0 && typeof html.setSelectionRange === 'function') {
                const shift = position => position < marker ? position : position + added;
                html.setSelectionRange(shift(start), shift(end));
            }
            draftPreset = undefined;
        }
        syncPresetSelection();
        paintPreview();
    });
    codeDialog.addEventListener('close', () => {
        if (!codeDialog.open) codeSlot.append(html);
    });
    codeDialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') event.stopPropagation();
    });
    for (const button of presetButtons) {
        button.addEventListener('click', () => {
            if (!settings || themeGeneration) return;
            const preset = button.dataset.themePreset;
            delete draftLayouts[preset];
            showPreset(preset);
            showResult('');
        });
    }
    builder.addEventListener('submit', async event => {
        event.preventDefault();
        if (!settings || themeGeneration) return;
        const description = themeDescription.value.trim();
        if (!description) {
            themeResult.textContent = '원하는 배경이나 색감을 한 줄로 적어 주세요.';
            return;
        }
        const original = html.value;
        const fieldSnapshot = JSON.stringify(settings.fields);
        const request = {};
        themeGeneration = request;
        syncThemeBuilder();
        themeResult.textContent = '테마를 생성하고 있어요…';
        try {
            const code = await generateTheme(description, settings.fields);
            if (themeGeneration !== request) return;
            if (fieldSnapshot !== JSON.stringify(settings.fields)) throw new Error('생성 중 항목이 변경되었습니다. 다시 생성해 주세요.');
            if (html.value !== original) throw new Error('코드가 변경되었습니다. 다시 생성해 주세요.');
            updateThemeDraft(code);
            themeResult.textContent = '테마를 만들었어요. 코드를 확인하고 저장 및 적용을 누르세요.';
        } catch (error) {
            if (themeGeneration === request) {
                themeResult.textContent = error.message || '테마 생성에 실패했어요. 다시 시도해 주세요.';
            }
        } finally {
            if (themeGeneration === request) {
                themeGeneration = undefined;
                syncThemeBuilder();
            }
        }
    });

    root.querySelector('[data-fields]').addEventListener('submit', event => {
        event.preventDefault();
        if (!settings) return;
        const rows = [...fields.children];
        const existing = indexFields(settings.fields, false);
        const previousFields = settings.fields;
        const used = new Set(existing.keys());
        const newFields = [];
        for (const row of rows) {
            const inputs = Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input]));
            const label = inputs.label.value.trim();
            if (!label) {
                inputs.label.setCustomValidity('표시 이름을 입력해 주세요.');
                inputs.label.reportValidity();
                return;
            }
            const key = row.dataset.key || createFieldKey(label, used);
            const rule = inputs.rule.value.trim();
            used.add(key);
            const field = { ...existing.get(key), key, label, type: inputs.type.value, enabled: inputs.enabled.checked };
            if (rule) field.rule = rule;
            else delete field.rule;
            newFields.push(field);
        }
        const savedCode = combinedCode(settings);
        const editedCode = html.value;
        const editedPreset = draftPreset;
        if (!saveChanges({ fields: newFields })) return;
        rows.forEach((row, index) => { row.dataset.key = settings.fields[index].key; });
        showThemeVariables(variables, settings.fields);
        if (editedPreset && getThemePreset(editedCode)) showPreset(editedPreset);
        else updateThemeDraft(editedCode === savedCode ? combinedCode(settings) : syncThemeFields(editedCode, previousFields, settings.fields));
        showResult('항목을 저장했습니다.');
    });

    const actions = {
        'add-field': () => addFieldRow(fields).focus(),
        'expand-code': () => {
            if (codeDialog.open) return;
            expandCode.focus();
            codeDialog.showModal();
            codeDialog.append(html);
        },
        'close-code': () => codeDialog.close(),
        'apply-html': () => {
            if (!html.value.trim()) {
                showResult('저장할 HTML을 입력해 주세요.');
                html.focus();
                return;
            }
            if (draftPreset) showPreset(draftPreset);
            if (saveChanges({ html: html.value, css: '', themeLayouts: structuredClone(draftLayouts) })) {
                draftLayouts = structuredClone(settings.themeLayouts);
                updateThemeDraft(combinedCode(settings));
                showResult('HTML을 저장했습니다.');
            }
        },
        'open-builder': () => {
            builder.hidden = !builder.hidden;
            builderToggle.setAttribute('aria-expanded', String(!builder.hidden));
            if (!builder.hidden) themeDescription.focus();
        },
        'copy-html': async () => {
            const editedSettings = settings;
            const avatar = editedAvatar;
            const copied = await copyText(html);
            if (settings === editedSettings && editedAvatar === avatar) showResult(copied ? '코드를 복사했습니다.' : '코드를 선택했습니다. 복사해 주세요.');
        },
    };
    for (const button of root.querySelectorAll('[data-action]')) {
        button.addEventListener('click', actions[button.dataset.action]);
    }
    setupTabs(root, paintPreview);

    return next => {
        state = next;
        syncPanel();
    };
}
