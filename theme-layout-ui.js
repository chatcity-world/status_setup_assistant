import { escapeHtml, themeVariableNames } from './theme.js';
import { groupThemeColors, itemThemeColors, layoutBlocks, THEME_PRESETS } from './theme-presets.js';

const ALIGN_OPTIONS = [['left', '왼쪽 정렬'], ['center', '가운데 정렬'], ['right', '오른쪽 정렬']];

function colorInput(property, label, color, { fallback = color, ariaLabel = label + ' 색상' } = {}) {
    const transparent = color === 'transparent';
    return `<label class="rp-status-layout-color">
        <span>${label}</span>
        <span class="rp-status-color-chip${transparent ? ' rp-status-color-transparent' : ''}" style="--rp-swatch:${color}">
            <input type="color" data-layout-color="${property}" value="${transparent ? fallback : color}" aria-label="${ariaLabel}">
        </span>
    </label>`;
}

function colorControls(colors, defaultBackground) {
    return `<div class="rp-status-layout-colors">
        ${colorInput('background', '배경', colors.background, { fallback: defaultBackground })}
        <button class="rp-status-layout-clear" type="button" data-layout-clear aria-pressed="${colors.background === 'transparent'}">배경 없음</button>
        ${colorInput('text', '글자', colors.text)}
    </div>`;
}

export function mountThemeLayout(container, update) {
    const list = container.querySelector('[data-layout-items]');
    const hint = container.querySelector('[data-layout-hint]');
    const surface = container.querySelector('[data-layout-surface]');
    const surfaceColor = surface.querySelector('input');
    const surfaceChip = surfaceColor.parentElement;

    function restoreFocus(key, group, selector) {
        const rows = [...container.querySelectorAll('[data-layout-item], [data-layout-group-style]')];
        const row = rows.find(element => group ? element.dataset.layoutGroupStyle === group : element.dataset.layoutItem === key);
        const control = row?.querySelector(selector);
        if (control && !control.disabled) control.focus();
        else row?.querySelector('[data-layout-property="group"]')?.focus();
    }

    container.addEventListener('click', event => {
        const button = event.target.closest('[data-layout-move], [data-layout-clear]');
        if (!button || button.disabled) return;
        const { layoutItem: key, layoutGroupStyle: group } = button.closest('[data-layout-item], [data-layout-group-style]').dataset;
        if (button.hasAttribute('data-layout-clear')) {
            update({ key, group, property: 'background', value: 'transparent' });
            restoreFocus(key, group, '[data-layout-clear]');
            return;
        }
        const direction = Number(button.dataset.layoutMove);
        update({ key, direction });
        restoreFocus(key, group, `[data-layout-move="${direction}"]`);
    });
    container.addEventListener('change', event => {
        const input = event.target.closest('[data-layout-property], [data-layout-color]');
        if (!input || input.disabled) return;
        const { layoutItem: key, layoutGroupStyle: group } = input.closest('[data-layout-item], [data-layout-group-style]').dataset;
        const property = input.dataset.layoutProperty ?? input.dataset.layoutColor;
        update({
            key, group, property,
            value: input.type === 'checkbox' ? input.checked : input.value,
        });
        const attr = input.dataset.layoutProperty ? 'property' : 'color';
        restoreFocus(key, group, `[data-layout-${attr}="${property}"]`);
    });
    surfaceColor.addEventListener('change', () => update({ property: 'background', value: surfaceColor.value }));

    return (preset, layout, fields, disabled, customBackground) => {
        hint.hidden = Boolean(preset);
        surface.hidden = !fields;
        list.hidden = !preset;
        container.disabled = disabled;
        const palette = THEME_PRESETS[preset];
        const background = layout?.background ?? palette?.background ?? customBackground;
        surfaceColor.value = background ?? '#808080';
        surfaceChip.classList.toggle('rp-status-color-transparent', !background);
        surfaceChip.style.setProperty('--rp-swatch', background ?? 'transparent');
        if (!preset) return;
        const groupOptions = [['', '단독'], ...Object.keys(layout.groups).map(id => [id, `그룹 ${id}`])];
        const byKey = new Map(fields.filter(field => field.enabled).map(field => [field.key, field]));
        const blocks = layoutBlocks(layout.items.filter(item => byKey.has(item.key)));
        const first = blocks[0]?.[0];
        const last = blocks.at(-1)?.at(-1);
        function renderItem(item) {
            const field = byKey.get(item.key);
            const name = escapeHtml(field.label || field.key);
            const variable = escapeHtml(themeVariableNames(field)[0]);
            const identity = item.group ? ` role="group" aria-label="${name}" data-layout-item="${escapeHtml(item.key)}"` : '';
            const gaugeColor = field.type === 'gauge'
                ? colorInput('gaugeColor', '게이지 색', itemThemeColors(palette, field, item).gaugeColor, { ariaLabel: name + ' 게이지 색상' })
                : '';
            return `<div class="rp-status-layout-row"${identity}>
                <div class="rp-status-layout-heading">
                    <code>{{${variable}}}</code>
                    <div class="rp-status-layout-order">
                        <button type="button" data-layout-move="-1" aria-label="${name} 위로 이동" ${item === first ? 'disabled' : ''}>↑</button>
                        <button type="button" data-layout-move="1" aria-label="${name} 아래로 이동" ${item === last ? 'disabled' : ''}>↓</button>
                    </div>
                </div>
                <div class="rp-status-layout-controls">
                    <label class="rp-status-layout-label">
                        <input type="checkbox" role="switch" data-layout-property="label" ${item.label ? 'checked' : ''}>
                        <span class="rp-status-layout-track" aria-hidden="true"></span> 라벨
                    </label>
                    <select class="text_pole" data-layout-property="group" aria-label="${name} 그룹">
                        ${groupOptions.map(([id, label]) => `<option value="${id}" ${item.group === id ? 'selected' : ''}>${label}</option>`).join('')}
                        <option value="new">+ 새 그룹</option>
                    </select>
                    <select class="text_pole" data-layout-property="align" aria-label="${name} 텍스트 정렬">
                        ${ALIGN_OPTIONS.map(([id, label]) => `<option value="${id}" ${item.align === id ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                    ${gaugeColor}
                </div>
            </div>`;
        }
        list.innerHTML = blocks.map(members => {
            const [item] = members;
            const { group, key } = item;
            const field = byKey.get(key);
            const title = group ? `그룹 ${group}` : '단독';
            const name = group ? title : `${escapeHtml(field.label || key)} 단독`;
            const identity = group ? `data-layout-group-style="${group}"` : `data-layout-item="${escapeHtml(key)}"`;
            const colors = group ? groupThemeColors(palette, layout, group) : itemThemeColors(palette, field, item);
            return `<div class="rp-status-layout-card" ${identity} role="group" aria-label="${name}">
                <div class="rp-status-layout-card-heading">
                    <strong>${title}</strong>
                    ${colorControls(colors, background)}
                </div>
                ${members.map(renderItem).join('')}
            </div>`;
        }).join('');
    };
}
