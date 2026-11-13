import { escapeHtml, themeVariableNames } from './theme.js';
import { groupThemeColors, itemThemeColors, layoutBlocks, THEME_GROUPS, THEME_PRESETS } from './theme-presets.js';

const ALIGN_OPTIONS = [['left', '왼쪽 정렬'], ['center', '가운데 정렬'], ['right', '오른쪽 정렬']];

function colorControls(colors, defaultBackground) {
    const transparent = colors.background === 'transparent';
    return `<div class="rp-status-layout-colors">
        <label class="rp-status-layout-color">
            <span>배경</span>
            <span class="rp-status-color-chip${transparent ? ' rp-status-color-transparent' : ''}" style="--rp-swatch:${transparent ? 'transparent' : colors.background}">
                <input type="color" data-layout-color="background" value="${transparent ? defaultBackground : colors.background}" aria-label="배경 색상">
            </span>
        </label>
        <button class="rp-status-layout-clear" type="button" data-layout-clear aria-pressed="${transparent}">배경 없음</button>
        <label class="rp-status-layout-color">
            <span>글자</span>
            <span class="rp-status-color-chip" style="--rp-swatch:${colors.text}">
                <input type="color" data-layout-color="text" value="${colors.text}" aria-label="글자 색상">
            </span>
        </label>
    </div>`;
}

export function mountThemeLayout(container, update) {
    const list = container.querySelector('[data-layout-items]');
    const hint = container.querySelector('[data-layout-hint]');
    const surface = container.querySelector('[data-layout-surface]');
    const surfaceColor = surface.querySelector('input');
    const surfaceChip = surfaceColor.parentElement;
    const groupOptions = [['', '단독'], ...THEME_GROUPS.map(id => [id, `그룹 ${id}`])];

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
        const byKey = new Map(fields.filter(field => field.enabled).map(field => [field.key, field]));
        const blocks = layoutBlocks(layout.items.filter(item => byKey.has(item.key)));
        const first = blocks[0]?.[0];
        const last = blocks.at(-1)?.at(-1);
        function renderItem(item) {
            const field = byKey.get(item.key);
            const name = escapeHtml(field.label || field.key);
            const variable = escapeHtml(themeVariableNames(field)[0]);
            return `<div class="rp-status-layout-row" role="group" aria-label="${name}" data-layout-item="${escapeHtml(item.key)}">
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
                    </select>
                    <select class="text_pole" data-layout-property="align" aria-label="${name} 텍스트 정렬">
                        ${ALIGN_OPTIONS.map(([id, label]) => `<option value="${id}" ${item.align === id ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                </div>
                ${item.group ? '' : colorControls(itemThemeColors(palette, field, item), background)}
            </div>`;
        }
        list.innerHTML = blocks.map(members => {
            const group = members[0].group;
            const rows = members.map(renderItem).join('');
            if (!group) return rows;
            return `<div class="rp-status-layout-group" data-layout-group-style="${group}" role="group" aria-label="그룹 ${group}">
                <div class="rp-status-layout-group-heading">
                    <strong>그룹 ${group}</strong>
                    ${colorControls(groupThemeColors(palette, layout, group), background)}
                </div>
                ${rows}
            </div>`;
        }).join('');
    };
}
