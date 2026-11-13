import { generateTheme, combinedCode } from './theme-builder.js';
import { getCharacterProfile } from './settings.js';
import { DEFAULT_HTML } from './theme.js';
import { createFieldKey } from './status.js';

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
        <div class="rp-status-actions">
            <button class="menu_button" type="button" data-action="add-field">항목 추가</button>
            <button class="menu_button" type="submit">항목 저장</button>
        </div>
    </form>`;

const HTML_OPTIONS = `
    <div class="rp-status-actions"><button class="menu_button" type="button" data-action="open-builder">직접 만들기</button></div>
    <form data-builder hidden>
        <label for="rp-theme-request">원하는 테마</label>
        <textarea id="rp-theme-request" class="text_pole" rows="3" placeholder="예: 별이 빛나는 밤하늘, 남색 배경과 은색 글자" required></textarea>
        <p class="rp-status-hint">저장한 항목의 변수를 넣어 만듭니다. 현재 연결된 AI를 사용하며 API 사용량이 발생할 수 있습니다.</p>
        <button type="submit" class="menu_button">테마 생성</button>
    </form>
    <label class="rp-status-code-label" for="rp-status-html">상태창 테마 코드</label>
    <textarea class="text_pole rp-status-code" id="rp-status-html" rows="12" spellcheck="false"></textarea>
    <p class="rp-status-hint">HTML 태그의 style 속성에 디자인을 작성합니다. 변수는 {{장소}}처럼 넣습니다.</p>
    <div class="rp-status-actions">
        <button class="menu_button" type="button" data-action="apply-html">저장 및 적용</button>
        <button class="menu_button" type="button" data-action="copy-html">코드 복사</button>
        <button class="menu_button" type="button" data-action="reset-html">기본 코드</button>
    </div>
    <details class="rp-status-variables">
        <summary>사용할 수 있는 변수</summary>
        <dl data-theme-variables></dl>
    </details>`;

const TABS = [
    ['display', '표시', DISPLAY_OPTIONS],
    ['fields', '항목', FIELD_OPTIONS],
    ['html', '테마 코드', HTML_OPTIONS],
];

function setupTabs(root) {
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
    if (field.key) row.dataset.key = field.key;
    row.innerHTML = `
        <label>표시 이름<input class="text_pole" data-field="label" maxlength="48" required autocomplete="off"></label>
        <label>형식<select class="text_pole" data-field="type"><option value="text">텍스트</option><option value="gauge">게이지</option></select></label>
        <label class="rp-status-field-rule">AI 작성 규칙 (선택)<input class="text_pole" data-field="rule" autocomplete="off"></label>
        <label class="rp-status-field-enabled"><input type="checkbox" data-field="enabled"> 표시</label>
        <button class="menu_button" type="button">삭제</button>`;
    for (const input of row.querySelectorAll('[data-field]')) {
        const value = field[input.dataset.field];
        if (input.type === 'checkbox') input.checked = value;
        else input.value = value ?? '';
    }
    const label = row.querySelector('[data-field="label"]');
    label.addEventListener('input', () => label.setCustomValidity(''));
    const rule = row.querySelector('[data-field="rule"]');
    rule.placeholder = field.key === '날짜' ? '예: YYYY년 MM월 DD일' : '예: 한 문장 이내';
    row.querySelector('button').addEventListener('click', () => row.remove());
    container.append(row);
    return label;
}

function showThemeVariables(list, fields) {
    const entries = [['값이 있는 표시 항목 전체', ['항목들']]];
    for (const { key, label, type, enabled } of fields) {
        if (enabled) entries.push([label, type === 'gauge' ? [key, key + '_게이지'] : [key]]);
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
    날짜: '11월 13일', 시간: '오후 7:30', 날씨: '비', 기온: '12°C',
    장소: '타로점', 옷차림: '검은 재킷', 포즈: '의자에 앉아 있음',
    커뮤니티글: '시장에 새 가게가 열렸대요.', 속마음: '조금 더 같이 있고 싶다.',
    애정: 65, 죄책감: 20, 욕구: 35,
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
    const root = document.createElement('details');
    root.className = 'rp-status-settings';
    root.innerHTML = `
        <summary>RP 상태창</summary>
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
                <div class="rp-status-preview">
                    <div class="rp-status-preview-label" data-preview-label>미리보기</div>
                    <div data-preview-card></div>
                </div>
            </div>
        </div>`;
    target.append(root);
    setupTabs(root);

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
    const previewCard = root.querySelector('[data-preview-card]');
    const previewLabel = root.querySelector('[data-preview-label]');
    const result = root.querySelector('[data-editor-result]');
    const fields = root.querySelector('[data-field-list]');
    const variables = root.querySelector('[data-theme-variables]');
    const builder = root.querySelector('[data-builder]');
    const themeDescription = root.querySelector('#rp-theme-request');
    const generateButton = builder.querySelector('button');
    let state;
    let settings;
    let editedAvatar;
    let selectedAvatar;
    let deleteAvatar;
    let characterList = '';
    let themeGeneration;
    let previewValues = {};
    let previewFrame = 0;

    function paintPreview() {
        if (!settings || !root.open || previewFrame) return;
        previewFrame = requestAnimationFrame(() => {
            previewFrame = 0;
            if (!settings) return;
            const hasValues = settings.fields.some(field => field.enabled && Object.hasOwn(previewValues, field.key));
            previewLabel.textContent = hasValues ? '미리보기' : '미리보기 · 예시 값';
            const values = hasValues ? previewValues : Object.fromEntries(settings.fields.filter(field => field.enabled).map(field => {
                const fallback = field.type === 'gauge' ? 50 : '예시';
                return [field.key, Object.hasOwn(SAMPLE_VALUES, field.key) ? SAMPLE_VALUES[field.key] : fallback];
            }));
            renderCard(previewCard, settings.fields, values, html.value || DEFAULT_HTML, '');
        });
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
        html.readOnly = Boolean(themeGeneration);
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
            editedAvatar = avatar;
            settings = next;
            html.value = next ? combinedCode(next) : '';
            fields.replaceChildren();
            if (next) {
                for (const field of next.fields) addFieldRow(fields, field);
                showThemeVariables(variables, next.fields);
                syncControls();
            }
            themeGeneration = undefined;
            themeDescription.value = '';
            builder.hidden = true;
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
    root.addEventListener('toggle', () => { if (root.open) syncPanel(); });
    html.addEventListener('input', paintPreview);
    builder.addEventListener('submit', async event => {
        event.preventDefault();
        if (!settings || themeGeneration) return;
        const description = themeDescription.value.trim();
        if (!description) return;
        const original = html.value;
        const fieldSnapshot = JSON.stringify(settings.fields);
        const request = {};
        themeGeneration = request;
        syncThemeBuilder();
        showResult('테마를 생성하고 있습니다…');
        try {
            const code = await generateTheme(description, settings.fields);
            if (themeGeneration !== request) return;
            if (fieldSnapshot !== JSON.stringify(settings.fields)) throw new Error('생성 중 항목이 변경되었습니다. 다시 생성해 주세요.');
            if (html.value !== original) throw new Error('코드가 변경되었습니다. 다시 생성해 주세요.');
            html.value = code;
            paintPreview();
            showResult('생성했습니다. 미리보기를 확인한 뒤 저장 및 적용을 누르세요.');
        } catch (error) {
            if (themeGeneration === request) {
                showResult(error.message || '테마 생성에 실패했습니다. AI 연결을 확인해 주세요.');
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
        const used = new Set(settings.fields.map(field => field.key));
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
            newFields.push({ key, label, type: inputs.type.value, enabled: inputs.enabled.checked, ...(rule && { rule }) });
        }
        if (!saveChanges({ fields: newFields })) return;
        rows.forEach((row, index) => { row.dataset.key = newFields[index].key; });
        showThemeVariables(variables, newFields);
        showResult('항목을 저장했습니다.');
        paintPreview();
    });

    const actions = {
        'add-field': () => addFieldRow(fields).focus(),
        'apply-html': () => {
            if (!html.value.trim()) {
                showResult('저장할 HTML을 입력해 주세요.');
                html.focus();
                return;
            }
            if (saveChanges({ html: html.value, css: '' })) showResult('HTML을 저장했습니다.');
        },
        'reset-html': () => {
            html.value = DEFAULT_HTML;
            paintPreview();
            showResult('기본 HTML을 불러왔습니다.');
        },
        'open-builder': () => {
            builder.hidden = !builder.hidden;
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

    return next => {
        state = next;
        syncPanel();
    };
}
