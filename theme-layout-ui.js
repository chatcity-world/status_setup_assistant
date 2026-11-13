import { escapeHtml, themeVariableNames } from './theme.js';
import { groupThemeColors, itemThemeColors, layoutBlocks, THEME_PRESETS } from './theme-presets.js';

const LAYOUT_TARGET = '[data-layout-item], [data-layout-group-style], [data-layout-gauge-item]';

function colorInput(property, label, color, { fallback = color, ariaLabel = label + ' 색상', gaugeKey } = {}) {
    const transparent = color === 'transparent';
    const identity = gaugeKey ? ` data-layout-gauge-item="${escapeHtml(gaugeKey)}"` : '';
    return `<label class="rp-status-layout-color"${identity}>
        <span>${label}</span>
        <span class="rp-status-color-chip${transparent ? ' rp-status-color-transparent' : ''}" style="--rp-swatch:${color}">
            <input type="color" data-layout-color="${property}" value="${transparent ? fallback : color}" aria-label="${ariaLabel}">
        </span>
    </label>`;
}

function colorControls(colors, defaultBackground, gaugeColors) {
    return `<div class="rp-status-layout-colors">
        ${colorInput('background', '배경', colors.background, { fallback: defaultBackground })}
        <button class="rp-status-layout-clear" type="button" data-layout-clear aria-pressed="${colors.background === 'transparent'}">배경 없음</button>
        <div class="rp-status-layout-foreground">
            ${colorInput('text', '글자', colors.text)}
            ${gaugeColors}
        </div>
    </div>`;
}

export function mountThemeLayout(container, update) {
    const list = container.querySelector('[data-layout-items]');
    const hint = container.querySelector('[data-layout-hint]');
    const surface = container.querySelector('[data-layout-surface]');
    const surfaceColor = surface.querySelector('input');
    const surfaceChip = surfaceColor.parentElement;

    function restoreFocus(key, group, selector) {
        const targets = [...container.querySelectorAll(LAYOUT_TARGET)];
        const target = targets.find(element => {
            const { layoutItem, layoutGroupStyle, layoutGaugeItem } = element.dataset;
            const matches = group ? layoutGroupStyle === group : (layoutItem ?? layoutGaugeItem) === key;
            return matches && element.querySelector(selector);
        });
        const control = target?.querySelector(selector);
        if (control && !control.disabled) control.focus();
        else target?.querySelector('[data-layout-property="group"]')?.focus();
    }

    container.addEventListener('click', event => {
        const button = event.target.closest('[data-layout-move], [data-layout-clear]');
        if (!button || button.disabled) return;
        const { layoutItem: key, layoutGroupStyle: group } = button.closest(LAYOUT_TARGET).dataset;
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
        const { layoutItem, layoutGaugeItem, layoutGroupStyle: group } = input.closest(LAYOUT_TARGET).dataset;
        const key = layoutItem ?? layoutGaugeItem;
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
            return `<div class="rp-status-layout-row"${identity}>
                <div class="rp-status-layout-heading">
                    <code>{{${variable}}}</code>
                    <label class="rp-status-layout-label">
                        <input type="checkbox" role="switch" data-layout-property="label" ${item.label ? 'checked' : ''}>
                        <span class="rp-status-layout-track" aria-hidden="true"></span> 라벨
                    </label>
                </div>
                <div class="rp-status-layout-order">
                    <select class="text_pole" data-layout-property="group" aria-label="${name} 그룹">
                        ${groupOptions.map(([id, label]) => `<option value="${id}" ${item.group === id ? 'selected' : ''}>${label}</option>`).join('')}
                        <option value="new">+ 새 그룹</option>
                    </select>
                    <button type="button" data-layout-move="-1" aria-label="${name} 위로 이동" ${item === first ? 'disabled' : ''}>↑</button>
                    <button type="button" data-layout-move="1" aria-label="${name} 아래로 이동" ${item === last ? 'disabled' : ''}>↓</button>
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
            const gauges = members.filter(member => byKey.get(member.key).type === 'gauge');
            const gaugeColors = gauges.map(member => {
                const gauge = byKey.get(member.key);
                const gaugeName = escapeHtml(gauge.label || member.key);
                const label = gauges.length > 1 ? `${gaugeName} 게이지 색` : '게이지 색';
                return colorInput('gaugeColor', label, itemThemeColors(palette, gauge, member).gaugeColor, {
                    ariaLabel: `${gaugeName} 게이지 색상`,
                    gaugeKey: member.key,
                });
            }).join('');
            return `<div class="rp-status-layout-card" ${identity} role="group" aria-label="${name}">
                <div class="rp-status-layout-card-heading">
                    <strong>${title}</strong>
                    ${colorControls(colors, background, gaugeColors)}
                </div>
                ${members.map(renderItem).join('')}
            </div>`;
        }).join('');
    };
}
