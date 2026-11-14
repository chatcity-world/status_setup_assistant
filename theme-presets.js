import { indexFields } from './status.js';
import { escapeHtml, gaugeDisplay, PRESET_FONT_SIZE, themeVariableNames } from './theme.js';
import { slackRail, THEME_PRESETS } from './theme-preset-styles.js';

export { THEME_PRESETS };

export const THEME_GROUPS = ['1', '2', '3'];
const COMPACT_GROUPS = ['1', '2'];
const ALIGNMENTS = ['left', 'center', 'right'];
const TOP_FIELDS = new Set(['날짜', '시간', '날씨', '기온']);
const DEFAULT_ORDER = ['날짜', '시간', '날씨', '기온', '장소', '옷차림'];
const HEX_COLOR = /^#[\da-f]{6}$/i;
const GROUP_ID = /^[1-9]\d*$/;
const SLACK_LAYOUT_VERSION = 2;

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

function defaultGroup(field, byKey, slack) {
    if (field === byKey.get('날짜') || field === byKey.get('시간')) return '1';
    if (field === byKey.get('날씨') || field === byKey.get('기온')) return '2';
    if (field === byKey.get('속마음') || field === byKey.get('호감도')) return '';
    if (field === byKey.get('장소') || field === byKey.get('옷차림')) return slack ? '' : '3';
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

export function normalizeThemeLayout(fields, saved, palette) {
    const byKey = indexFields(fields);
    const slack = Boolean(palette?.slack);
    const migrateSlack = slack && (saved?.version ?? 1) < SLACK_LAYOUT_VERSION;
    const available = new Map(defaultItems(fields).map(field => [field.key, field]));
    const groups = new Set([...THEME_GROUPS, ...Object.keys(saved?.groups ?? {}).filter(id => GROUP_ID.test(id))]);
    const items = [];
    const savedByKey = new Map((Array.isArray(saved?.items) ? saved.items : []).filter(item => item?.key).map(item => [item.key, item]));
    function add(field, existing) {
        const defaultId = defaultGroup(field, byKey, slack);
        // Earlier Slack presets put both fields in group 3 and displayed the location in the header.
        const isOldSlackSceneItem = migrateSlack && existing?.group === '3'
            && (field === byKey.get('장소') || field === byKey.get('옷차림'));
        const group = !isOldSlackSceneItem && typeof existing?.group === 'string' && (existing.group === '' || GROUP_ID.test(existing.group))
            ? existing.group : defaultId;
        const align = ALIGNMENTS.includes(existing?.align) ? existing.align : field === byKey.get('속마음') ? 'center' : 'left';
        const label = typeof existing?.label === 'boolean' ? existing.label : !TOP_FIELDS.has(field.key);
        const gaugeColor = existing?.gaugeColor;
        if (group) groups.add(group);
        items.push({
            key: field.key, group, align, label,
            ...(isOldSlackSceneItem && colorSettings(saved?.groups?.['3'])),
            ...colorSettings(existing),
            ...(typeof gaugeColor === 'string' && HEX_COLOR.test(gaugeColor) && { gaugeColor }),
        });
        available.delete(field.key);
    }
    for (const key of savedByKey.keys()) {
        if (available.has(key)) add(available.get(key), savedByKey.get(key));
    }
    for (const field of available.values()) {
        const group = defaultGroup(field, byKey, slack);
        const index = group ? items.findLastIndex(item => item.group === group) : -1;
        add(field);
        if (index >= 0) items.splice(index + 1, 0, items.pop());
    }
    const orderedGroups = [...groups].sort((left, right) => left.length - right.length || left.localeCompare(right));
    return {
        items,
        groups: Object.fromEntries(orderedGroups.map(id => [id, colorSettings(saved?.groups?.[id])])),
        ...(slack && { version: SLACK_LAYOUT_VERSION }),
        ...(HEX_COLOR.test(saved?.background) && { background: saved.background }),
    };
}

export function addThemeGroup(layout) {
    const last = Object.keys(layout.groups).at(-1);
    const id = String(BigInt(last) + 1n);
    layout.groups[id] = {};
    return id;
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
        background: item.background ?? (field.key === '속마음' ? palette.thought
            : field.type === 'gauge' ? palette.gaugeBackground ?? 'transparent' : 'transparent'),
        text: item.text ?? (field.type === 'gauge' ? palette.gaugeText : palette.text),
        gaugeColor: item.gaugeColor ?? palette.gaugeAccent,
    };
}

export function groupThemeColors(palette, layout, id) {
    const compact = COMPACT_GROUPS.includes(id);
    const slackWeather = palette.slack && id === '2';
    const background = compact ? (slackWeather ? 'transparent' : palette.headerBackground ?? 'transparent') : palette.scene;
    const text = compact ? (slackWeather ? palette.muted : palette.headerText ?? palette.text) : palette.text;
    return {
        background: layout.groups[id]?.background ?? background,
        text: layout.groups[id]?.text ?? text,
    };
}

export function getThemePreset(code) {
    const root = /^\s*<section\b[^>]*>/i.exec(code ?? '')?.[0] ?? '';
    if (/\sdata-rp-status-custom\b/.test(root)) return undefined;
    const id = /\sdata-rp-status-preset="([a-z-]+)"/.exec(root)?.[1];
    return Object.hasOwn(THEME_PRESETS, id) ? id : undefined;
}

export function getLegacyThemePreset(code) {
    const root = /^\s*<section\b[^>]*>/i.exec(code ?? '')?.[0] ?? '';
    if (root.includes('data-rp-status-') || !root.includes('aria-label="상태 정보"') || !root.includes('font:12px/1.55 system-ui')) return undefined;
    // Earlier white presets were saved without a preset identifier.
    if (root.includes('background:#f8f8f8;color:#28292c;color-scheme:light')) return 'white';
    return ['white', 'dark'].find(key => {
        const palette = THEME_PRESETS[key];
        return root.includes(`background:${palette.background};color:${palette.text};color-scheme:${palette.scheme}`);
    });
}

export function useCustomThemeCode(code) {
    return code.replace(/^(\s*<section\b)(?![^>]*\sdata-rp-status-custom\b)/i, '$1 data-rp-status-custom');
}

function renderPresetField(palette, field, item, { groupColors, compact = false, distributes = false, channel = false } = {}) {
    const skin = palette.skin ?? {};
    const customText = item.group ? groupColors.customText : Boolean(item.text);
    const itemColors = itemThemeColors(palette, field, item);
    const { background, text } = groupColors ?? itemColors;
    const [valueName, barName] = themeVariableNames(field).map(escapeHtml);
    let value = `{{${valueName}}}`;
    if (barName) {
        value = gaugeDisplay(`{{${barName}}}`, `{{${valueName}}}%`, skin.gaugeTrack, skin.gaugeValue);
        if (item.align !== 'left') value = `<span style="display:inline-block;width:min(100%,14rem);vertical-align:middle">${value}</span>`;
    }
    const centeredLabel = item.align !== 'left' || field.key === '속마음';
    const inlineLabel = compact || !centeredLabel;
    const cell = skin.cellLine && groupColors && !compact;
    const labelColumn = compact ? 'max-content' : skin.labelColumn ?? 'minmax(40px,max-content)';
    const rowLayout = item.label && inlineLabel ? `display:grid;grid-template-columns:${labelColumn} minmax(0,1fr);align-items:baseline;gap:${cell ? 0 : 8}px;` : '';
    const roleStyle = channel ? `padding:${background === 'transparent' ? '0' : '2px 6px'};`
        : field.key === '속마음' ? skin.thought : barName ? skin.gauge : '';
    const padding = background === 'transparent' ? '1px 12px' : '11px 12px';
    const colors = groupColors ? '' : `background:${background};color:${text};border-radius:12px;padding:${padding};${skin.item ?? ''}${roleStyle ?? ''}`;
    const labelTone = compact ? palette.headerMuted ?? palette.muted : palette.muted;
    const color = customText || channel ? 'inherit' : labelTone;
    const labelName = escapeHtml(field.label || field.key);
    const labelStyle = `color:${color};${skin.label ?? ''}${cell ? 'padding:6px 9px;' : ''}`;
    const label = !item.label ? '' : channel
        ? `<dt style="${labelStyle}"><span aria-hidden="true"># </span><span data-rp-status-field-label>${labelName}</span></dt>`
        : `<dt data-rp-status-field-label style="${labelStyle}">${labelName}</dt>`;
    const gaugeFill = palette.gaugeFill && !item.gaugeColor ? `--rp-gauge-fill:${palette.gaugeFill};` : '';
    const gaugeGlow = skin.gaugeGlow ? `--rp-gauge-glow:${skin.gaugeGlow};` : '';
    const gauge = barName ? `--rp-gauge-accent:${itemColors.gaugeColor};--rp-gauge-track:${palette.gaugeTrack};${gaugeFill}${gaugeGlow}` : '';
    const width = !item.group && field.key === '속마음' ? 'max-width:60ch;' : '';
    const margin = !inlineLabel ? (item.label ? skin.stackedValueMargin ?? '4px auto 0' : '0 auto') : '0';
    const numeric = compact && ['시간', '기온'].includes(field.key);
    const valueColor = numeric ? palette.headerMuted ?? palette.muted : field.key === '장소' ? palette.locationText : undefined;
    const valueTone = valueColor && !customText ? `color:${valueColor};` : '';
    const flex = distributes || (compact && barName) ? 'flex:1 1 6rem;' : '';
    const channelStyle = channel ? 'flex:1 1 148px;' : '';
    const cellStyle = cell ? `background:${background};` : '';
    const cellValue = cell ? `padding:6px 9px;${item.label && inlineLabel ? `border-inline-start:1px solid ${skin.cellLine};` : ''}` : '';
    const groupRow = groupColors && !compact ? skin.groupRow ?? '' : '';
    return `<dl data-rp-status-field="${escapeHtml(field.key)}" data-rp-status-hide-empty style="${rowLayout}${colors}${cellStyle}${flex}${channelStyle}${groupRow}margin:0;min-width:0;text-align:${item.align}">
      ${label}
      <dd style="margin:${margin};${width}min-width:0;white-space:pre-wrap;${cellValue}${gauge}${valueTone}">${value}</dd>
    </dl>`;
}

function renderGroup(palette, members, byKey, layout) {
    const id = members[0].group;
    const compact = COMPACT_GROUPS.includes(id);
    const skin = palette.skin ?? {};
    const distributes = compact && members.some(member => member.align !== 'left' || byKey.get(member.key).type === 'gauge');
    const colors = groupThemeColors(palette, layout, id);
    colors.customText = Boolean(layout.groups[id]?.text);
    const grid = compact ? 'display:flex;flex-wrap:wrap;align-items:baseline;gap:5px 8px' : 'display:grid;grid-template-columns:minmax(0,1fr);gap:5px';
    const pad = colors.background === 'transparent' ? '1px 12px' : '10px 12px';
    const markup = members.map(member => renderPresetField(palette, byKey.get(member.key), member, {
        groupColors: colors, compact, distributes,
    })).join('\n    ');
    const flex = distributes ? 'flex:1 1 min(100%,14rem);' : '';
    const backgroundOverride = layout.groups[id]?.background;
    const surface = compact ? backgroundOverride ?? palette.headerGroupBackground ?? colors.background
        : colors.background === 'transparent' ? colors.background
            : skin.cellLine ?? backgroundOverride ?? palette.sceneBackground ?? colors.background;
    const weatherStyle = id === '2' ? skin.weatherGroup ?? '' : '';
    return `<div data-rp-status-group style="${grid};${flex}min-width:0;padding:${pad};border-radius:12px;background:${surface};color:${colors.text};${compact ? skin.headerGroup ?? '' : skin.scene ?? ''}${weatherStyle}">
    ${markup}
  </div>`;
}

function renderSlack(palette, blocks, byKey) {
    const { header, divider } = palette.slack;
    const [dates, weather, location, ...remaining] = blocks;
    const [channel] = location.members;
    const title = renderPresetField(palette, byKey.get(channel.key), channel, { compact: true, channel: true });
    const head = `<div data-rp-status-group style="display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:8px 11px;background:${header};border-bottom:1px solid ${divider}">
    ${title}
    <div data-rp-status-group style="margin-inline-start:auto">${weather.html}</div>
  </div>`;
    const dateLine = `<div data-rp-status-group style="display:flex;justify-content:center;background:linear-gradient(${divider},${divider}) center/100% 1px no-repeat">${dates.html}</div>`;
    const body = [dateLine, ...remaining.map(block => block.html)].join('\n    ');
    return `${slackRail(palette.slack)}
  <div style="min-width:0">
    ${head}
    <div data-rp-status-group style="display:grid;gap:7px;padding:8px 11px 10px">
      ${body}
    </div>
  </div>`;
}

export function makeThemePreset(palette, fields, savedLayout) {
    const layout = normalizeThemeLayout(fields, savedLayout, palette);
    const byKey = new Map(fields.filter(field => field.enabled).map(field => [field.key, field]));
    const blocks = layoutBlocks(layout.items.filter(item => byKey.has(item.key))).map(members => {
        const [item] = members;
        const html = item.group ? renderGroup(palette, members, byKey, layout) : renderPresetField(palette, byKey.get(item.key), item);
        return { group: item.group, members, html };
    });
    const skin = palette.skin ?? {};
    const firstGroups = blocks[0]?.group === '1' && blocks[1]?.group === '2';
    const slackHeader = palette.slack && firstGroups && blocks[2]?.group === '' && blocks[2].members[0].key === '장소';
    if (firstGroups && !slackHeader) {
        const header = `<div data-rp-status-group style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px 16px;${skin.header ?? ''}">
    ${blocks[0].html}
    ${blocks[1].html}
  </div>`;
        blocks.splice(0, 2, { html: header });
    }
    const body = blocks.map(block => block.html).join('\n  ');
    const content = slackHeader ? renderSlack(palette, blocks, byKey)
        : palette.slack ? `${slackRail(palette.slack)}<div style="display:grid;grid-template-columns:minmax(0,1fr);gap:7px;min-width:0;padding:8px 11px 10px">${body}</div>`
            : [body, skin.footer].filter(Boolean).join('\n  ');
    const preset = palette.id ?? (palette.scheme === 'dark' ? 'dark' : 'white');
    const typography = skin.typography ?? `font-size:${PRESET_FONT_SIZE};`;
    const fixedTypography = skin.typography ? ' data-rp-status-fixed-typography' : '';
    return `<section aria-label="상태 정보" data-rp-status-preset="${preset}"${fixedTypography} style="box-sizing:border-box;width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:14px;border-radius:18px;background:${layout.background ?? palette.cardBackground ?? palette.background};color:${palette.text};color-scheme:${palette.scheme};${typography}overflow-wrap:anywhere;${skin.card ?? ''}">
  ${content}
</section>`;
}
