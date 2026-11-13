import { indexFields } from './status.js';
import { escapeHtml, gaugeDisplay, themeVariableNames } from './theme.js';

export const THEME_PRESETS = {
    white: {
        label: '화이트', scheme: 'light', swatch: '#fff',
        background: '#f8f8f8', text: '#28292c', muted: '#656970', scene: '#ffffff', thought: '#f2f2f2',
        gaugeText: '#384451', gaugeAccent: '#657589', gaugeTrack: '#e5e7e9',
    },
    dark: {
        label: '다크', scheme: 'dark', swatch: '#24262b',
        background: '#202227', text: '#eef0f3', muted: '#b0b7c2', scene: '#2b2e34', thought: '#292c33',
        gaugeText: '#d5e0ed', gaugeAccent: '#9db3cd', gaugeTrack: '#3c444f',
    },
};

export const THEME_GROUPS = ['1', '2', '3'];
const ALIGNMENTS = ['left', 'center', 'right'];
const TOP_FIELDS = new Set(['날짜', '시간', '날씨', '기온']);
const DEFAULT_ORDER = ['날짜', '시간', '날씨', '기온', '장소', '옷차림'];
const HEX_COLOR = /^#[\da-f]{6}$/i;

function defaultItems(fields) {
    const byKey = indexFields(fields);
    const standard = [...DEFAULT_ORDER, '호감도', '속마음'].map(key => byKey.get(key)).filter(Boolean);
    const extra = fields.filter(field => !standard.includes(field));
    return [
        ...DEFAULT_ORDER.map(key => byKey.get(key)).filter(Boolean),
        ...extra.filter(field => field.type !== 'gauge'),
        byKey.get('호감도'),
        ...extra.filter(field => field.type === 'gauge'),
        byKey.get('속마음'),
    ].filter(Boolean);
}

function defaultGroup(field, byKey) {
    if (field === byKey.get('날짜') || field === byKey.get('시간')) return '1';
    if (field === byKey.get('날씨') || field === byKey.get('기온')) return '2';
    if (field === byKey.get('속마음') || field === byKey.get('호감도')) return '';
    if (field === byKey.get('장소') || field === byKey.get('옷차림')) return '3';
    return field.type === 'gauge' ? '' : '3';
}

function colorSettings(saved) {
    const background = saved?.background === 'transparent' || HEX_COLOR.test(saved?.background) ? saved.background : undefined;
    const text = HEX_COLOR.test(saved?.text) ? saved.text : undefined;
    return {
        ...(background && { background }),
        ...(text && { text }),
    };
}

export function normalizeThemeLayout(fields, saved) {
    const byKey = indexFields(fields);
    const available = new Map(defaultItems(fields).map(field => [field.key, field]));
    const items = [];
    const savedByKey = new Map((Array.isArray(saved?.items) ? saved.items : []).filter(item => item?.key).map(item => [item.key, item]));
    function add(field, existing) {
        const group = THEME_GROUPS.includes(existing?.group) || existing?.group === '' ? existing.group : defaultGroup(field, byKey);
        const align = ALIGNMENTS.includes(existing?.align) ? existing.align : field === byKey.get('속마음') ? 'center' : 'left';
        const label = typeof existing?.label === 'boolean' ? existing.label : !TOP_FIELDS.has(field.key);
        items.push({ key: field.key, group, align, label, ...colorSettings(existing) });
        available.delete(field.key);
    }
    for (const key of savedByKey.keys()) {
        if (available.has(key)) add(available.get(key), savedByKey.get(key));
    }
    for (const field of available.values()) {
        const group = defaultGroup(field, byKey);
        const index = group ? items.findLastIndex(item => item.group === group) : -1;
        add(field);
        if (index >= 0) items.splice(index + 1, 0, items.pop());
    }
    return { items, groups: Object.fromEntries(THEME_GROUPS.map(id => [id, colorSettings(saved?.groups?.[id])])) };
}

export function layoutBlocks(items) {
    const blocks = [];
    const groups = new Map();
    for (const item of items) {
        if (!item.group) {
            blocks.push([item]);
            continue;
        }
        let block = groups.get(item.group);
        if (!block) {
            block = [];
            groups.set(item.group, block);
            blocks.push(block);
        }
        block.push(item);
    }
    return blocks;
}

export function moveThemeItem(items, key, direction, visibleKeys) {
    const blocks = layoutBlocks(items);
    const index = blocks.findIndex(block => block.some(item => item.key === key));
    if (index < 0) return items;
    const block = blocks[index];
    const member = block.findIndex(item => item.key === key);
    let adjacent = member + direction;
    while (block[adjacent] && !visibleKeys.has(block[adjacent].key)) adjacent += direction;
    if (block[adjacent]) {
        [block[member], block[adjacent]] = [block[adjacent], block[member]];
    } else {
        let next = index + direction;
        while (blocks[next] && !blocks[next].some(item => visibleKeys.has(item.key))) next += direction;
        if (!blocks[next]) return items;
        [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
    }
    return blocks.flat();
}

export function itemThemeColors(palette, field, item) {
    return {
        background: item.background ?? (field.key === '속마음' ? palette.thought : 'transparent'),
        text: item.text ?? (field.type === 'gauge' ? palette.gaugeText : palette.text),
    };
}

export function groupThemeColors(palette, layout, id) {
    return {
        background: layout.groups[id]?.background ?? (id === '3' ? palette.scene : 'transparent'),
        text: layout.groups[id]?.text ?? palette.text,
    };
}

export function getThemePreset(code) {
    const root = /^\s*<section\b[^>]*>/i.exec(code ?? '')?.[0] ?? '';
    if (/\sdata-rp-status-custom\b/.test(root)) return undefined;
    return /\bdata-rp-status-preset="(white|dark)"/.exec(root)?.[1];
}

export function getLegacyThemePreset(code) {
    const root = /^\s*<section\b[^>]*>/i.exec(code ?? '')?.[0] ?? '';
    if (root.includes('data-rp-status-') || !root.includes('aria-label="상태 정보"') || !root.includes('font:12px/1.55 system-ui')) return undefined;
    return Object.keys(THEME_PRESETS).find(key => {
        const palette = THEME_PRESETS[key];
        return root.includes(`background:${palette.background};color:${palette.text};color-scheme:${palette.scheme}`);
    });
}

export function useCustomThemeCode(code) {
    return code.replace(/^(\s*<section\b)(?![^>]*\sdata-rp-status-custom\b)/i, '$1 data-rp-status-custom');
}

function renderPresetField(palette, field, item, groupColors, compact = false, distributes = false) {
    const customText = item.group ? groupColors.text !== palette.text : Boolean(item.text);
    const { background, text } = groupColors ?? itemThemeColors(palette, field, item);
    const [valueName, barName] = themeVariableNames(field).map(escapeHtml);
    let value = `{{${valueName}}}`;
    if (barName) {
        value = gaugeDisplay(`{{${barName}}}`, `{{${valueName}}}%`);
        if (item.align !== 'left') value = `<span style="display:inline-block;width:min(100%,14rem);vertical-align:middle">${value}</span>`;
    }
    const centeredLabel = item.align !== 'left' || field.key === '속마음';
    const inlineLabel = compact || !centeredLabel;
    const labelColumn = compact ? 'max-content' : 'minmax(40px,max-content)';
    const rowLayout = item.label && inlineLabel ? `display:grid;grid-template-columns:${labelColumn} minmax(0,1fr);align-items:baseline;gap:8px;` : '';
    const colors = groupColors ? '' : `background:${background};color:${text};border-radius:12px;padding:${background === 'transparent' ? '1px 12px' : '11px 12px'};`;
    const font = compact && !item.label && ['날짜', '날씨'].includes(field.key) ? 'font-weight:650;' : '';
    const color = customText ? 'inherit' : palette.muted;
    const label = item.label ? `<dt data-rp-status-field-label style="font-size:10px;font-weight:600;color:${color}">${escapeHtml(field.label || field.key)}</dt>` : '';
    const gauge = barName ? `--rp-gauge-accent:${palette.gaugeAccent};--rp-gauge-track:${palette.gaugeTrack};` : '';
    const width = !item.group && field.key === '속마음' ? 'max-width:60ch;' : '';
    const margin = !inlineLabel ? (item.label ? '4px auto 0' : '0 auto') : '0';
    const muted = compact && !customText && ['시간', '기온'].includes(field.key) ? `color:${palette.muted};` : '';
    const flex = distributes || (compact && barName) ? 'flex:1 1 6rem;' : '';
    return `<dl data-rp-status-field="${escapeHtml(field.key)}" data-rp-status-hide-empty style="${rowLayout}${colors}${font}${flex}margin:0;min-width:0;text-align:${item.align}">
      ${label}
      <dd style="margin:${margin};${width}min-width:0;white-space:pre-wrap;${gauge}${muted}">${value}</dd>
    </dl>`;
}

export function makeThemePreset(palette, fields, savedLayout) {
    const layout = normalizeThemeLayout(fields, savedLayout);
    const byKey = new Map(fields.filter(field => field.enabled).map(field => [field.key, field]));
    const blocks = [];
    for (const members of layoutBlocks(layout.items.filter(item => byKey.has(item.key)))) {
        const [item] = members;
        if (!item.group) {
            blocks.push({ html: renderPresetField(palette, byKey.get(item.key), item) });
            continue;
        }
        const compact = item.group !== '3';
        const distributes = compact && members.some(member => member.align !== 'left' || byKey.get(member.key).type === 'gauge');
        const colors = groupThemeColors(palette, layout, item.group);
        const grid = compact ? 'display:flex;flex-wrap:wrap;align-items:baseline;gap:5px 8px' : 'display:grid;grid-template-columns:minmax(0,1fr);gap:5px';
        const pad = colors.background === 'transparent' ? '1px 12px' : '10px 12px';
        const markup = members.map(member => renderPresetField(palette, byKey.get(member.key), member, colors, compact, distributes)).join('\n    ');
        const flex = distributes ? 'flex:1 1 min(100%,14rem);' : '';
        blocks.push({ group: item.group, html: `<div data-rp-status-group style="${grid};${flex}min-width:0;padding:${pad};border-radius:12px;background:${colors.background};color:${colors.text}">
    ${markup}
  </div>` });
    }
    const firstGroups = blocks[0]?.group === '1' && blocks[1]?.group === '2';
    if (firstGroups) {
        const header = `<div data-rp-status-group style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px 16px;font-variant-numeric:tabular-nums">
    ${blocks[0].html}
    ${blocks[1].html}
  </div>`;
        blocks.splice(0, 2, { html: header });
    }
    const preset = palette.scheme === 'dark' ? 'dark' : 'white';
    return `<section lang="ko" aria-label="상태 정보" data-rp-status-preset="${preset}" style="box-sizing:border-box;width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:14px;border-radius:18px;background:${palette.background};color:${palette.text};color-scheme:${palette.scheme};font:12px/1.55 system-ui,sans-serif;overflow-wrap:anywhere">
  ${blocks.map(block => block.html).join('\n  ')}
</section>`;
}
