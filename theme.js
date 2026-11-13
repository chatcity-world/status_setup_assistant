import { indexFields, normalizeValue } from './status.js';

export const DEFAULT_HTML = `<section class="rp-card" aria-label="상태창" style="padding:14px;border-radius:12px;background:#fff3d9;color:#26110e;font:14px/1.5 system-ui,sans-serif">
  {{항목들}}
</section>`;
export const LEGACY_DEFAULT_HTML = DEFAULT_HTML.replace('  {{항목들}}', '  <div style="font-weight:700;margin-bottom:10px">상태창</div>\n  {{항목들}}');

export const PALETTES = {
    cream: { label: '버터 크림', background: '#fff3d9', accent: '#8b4b31' },
    charcoal: { label: '차콜', background: '#231e23', accent: '#e6a58b' },
    sage: { label: '세이지', background: '#edf2e7', accent: '#4b7156' },
};

function luminance(hex) {
    const rgb = hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
    const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function makeTheme({ background, accent, radius, layout }) {
    const dark = luminance(background) < 0.179;
    const foreground = dark ? '#fff8f2' : '#26110e';
    const columns = layout === 'list' ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(118px, 100%), 1fr))';
    return `.rp-card {
  --rp-bg: ${background};
  --rp-ink: ${foreground};
  --rp-accent: ${accent};
  --rp-radius: ${radius}px;
  padding: 12px 14px;
  border-radius: var(--rp-radius);
  background: var(--rp-bg);
  color: var(--rp-ink);
  font: 500 .875rem/1.45 system-ui, sans-serif;
  text-shadow: none;
}

.rp-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  font-weight: 750;
}

.rp-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--rp-accent);
}

.rp-grid {
  display: grid;
  grid-template-columns: ${columns};
  gap: 8px 14px;
  margin: 0;
}

.rp-field { min-width: 0; }
.rp-label { font-size: .75em; opacity: .75; }
.rp-value { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }

.rp-gauge {
  display: block;
  width: 100%;
  height: 5px;
  margin-top: 4px;
  border: 0;
  border-radius: 99px;
  overflow: hidden;
  appearance: none;
  accent-color: var(--rp-accent);
  color: var(--rp-accent);
}
.rp-gauge::-webkit-progress-bar { background: color-mix(in srgb, var(--rp-ink) 15%, transparent); }
.rp-gauge::-webkit-progress-value { background: var(--rp-accent); border-radius: 99px; }
.rp-gauge::-moz-progress-bar { background: var(--rp-accent); border-radius: 99px; }

.rp-empty { margin: 0; opacity: .75; }
`;
}

export const DEFAULT_THEME = { palette: 'cream', ...PALETTES.cream, radius: 12, layout: 'grid' };
export const DEFAULT_CSS = makeTheme(DEFAULT_THEME);

const HTML_TAGS = [
    'a', 'abbr', 'article', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'details', 'div', 'dl', 'dt', 'em',
    'figure', 'figcaption', 'h2', 'h3', 'h4', 'header', 'hr', 'i', 'img', 'li', 'meter', 'ol', 'p', 'pre',
    'progress', 's', 'section', 'small', 'span', 'strong', 'summary', 'table', 'tbody', 'td', 'th', 'thead',
    'tr', 'ul',
];
const HTML_ATTRIBUTES = ['style', 'alt', 'class', 'colspan', 'height', 'href', 'loading', 'max', 'min', 'open', 'role',
    'rowspan', 'src', 'title', 'value', 'width'];
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ESCAPES[char]);
}

function gauge(label, value, compact = false) {
    const layout = compact ? 'display:inline-block;width:40px;max-width:100%;vertical-align:middle' : 'width:100%';
    return `<progress class="rp-gauge" style="${layout};min-width:0;height:6px;accent-color:var(--rp-gauge-accent,currentColor)" value="${value}" max="100" aria-label="${escapeHtml(label)}">${value}%</progress>`;
}

export function gaugeDisplay(bar, percent, trackStyle = '', valueStyle = '') {
    return `<span class="rp-gauge-display" style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px">
        <span style="display:flex;align-items:center;min-width:0;height:6px;overflow:hidden;border-radius:999px;background:var(--rp-gauge-track,transparent);${trackStyle}">${bar}</span>
        <span style="font-variant-numeric:tabular-nums;white-space:nowrap;${valueStyle}">${percent}</span>
    </span>`;
}

const DISPLAY_PREFIX = '표시:';
const GAUGE_SUFFIX = '_게이지';

export function themeVariableNames(field) {
    const name = field.variable ?? field.key;
    return field.type === 'gauge' ? [name, name + GAUGE_SUFFIX] : [name];
}

export function resolveThemeField(token, byKey, includeHidden = false) {
    let format = 'value';
    let key = token;
    if (token.startsWith(DISPLAY_PREFIX)) {
        format = 'display';
        key = token.slice(DISPLAY_PREFIX.length).trim();
    } else if (token.endsWith(GAUGE_SUFFIX)) {
        format = 'gauge';
        key = token.slice(0, -GAUGE_SUFFIX.length);
    }
    const field = byKey.get(key);
    if (!field || (!includeHidden && !field.enabled) || (format === 'gauge' && field.type !== 'gauge')) return undefined;
    return { field, format };
}

function formatValue(field, value, compact = false) {
    if (value == null) return '—';
    if (field.type !== 'gauge') return escapeHtml(value);
    const percent = normalizeValue(field, value);
    if (percent == null) return '—';
    const bar = gauge(field.label, percent, compact);
    if (compact) return `${percent}% ${bar}`;
    return gaugeDisplay(bar, `${percent}%`);
}

function htmlFor(template, fields, values) {
    const filled = fields.filter(field => field.enabled && Object.hasOwn(values, field.key));
    const rows = filled.map(field => {
        const detail = formatValue(field, values[field.key], true);
        return `<div class="rp-field" style="display:flex;align-items:baseline;gap:6px;min-width:0;max-width:100%">
            <dt class="rp-label" style="flex:none;max-width:45%;font-size:.85em;opacity:.75;overflow-wrap:anywhere">${escapeHtml(field.label)}</dt>
            <dd class="rp-value" style="min-width:0;margin:0;white-space:pre-wrap;overflow-wrap:anywhere">${detail}</dd>
        </div>`;
    }).join('');
    const variables = indexFields(fields);
    const source = document.createElement('template');
    source.innerHTML = template;
    for (const row of source.content.querySelectorAll('[data-rp-status-field]')) {
        const key = row.dataset.rpStatusField;
        const field = variables.get(key);
        const missingValue = row.hasAttribute('data-rp-status-hide-empty')
            && (!Object.hasOwn(values, key) || values[key] == null || values[key] === '');
        if (!field?.enabled || field.key !== key || missingValue) row.remove();
    }
    for (const group of [...source.content.querySelectorAll('[data-rp-status-group]')].reverse()) {
        if (!group.childElementCount) group.remove();
    }
    const walker = document.createTreeWalker(source.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        if (walker.currentNode.data.includes('{{')) nodes.push(walker.currentNode);
    }
    let renderedFields = false;
    function resolve(key, percent = '') {
        if (key === '항목들') {
            if (renderedFields) return '';
            renderedFields = true;
            return rows ? `<dl class="rp-grid" style="display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:0">${rows}</dl>` : '<p class="rp-empty">아직 입력된 상태가 없어요.</p>';
        }
        const resolved = resolveThemeField(key, variables);
        if (!resolved) return '';
        const { field, format } = resolved;
        const value = Object.hasOwn(values, field.key) ? values[field.key] : undefined;
        if (format === 'gauge') {
            const percent = normalizeValue(field, value);
            return percent == null ? '' : gauge(field.label, percent);
        }
        if (format === 'display') return formatValue(field, value);
        return value == null ? '—' : escapeHtml(String(value) + percent);
    }
    for (const node of nodes) {
        const replacement = document.createElement('template');
        replacement.innerHTML = escapeHtml(node.data).replace(/\{\{\s*([^{}]+?)\s*\}\}(\s*%)?/g, (_, key, percent) => resolve(key, percent));
        node.replaceWith(replacement.content);
    }
    return source.innerHTML;
}

export function createCardRenderer() {
    const painted = new WeakMap();
    const canShareCSS = typeof CSSStyleSheet === 'function'
        && 'adoptedStyleSheets' in ShadowRoot.prototype && 'replaceSync' in CSSStyleSheet.prototype;
    const sheet = canShareCSS ? new CSSStyleSheet() : null;
    let currentCSS;
    const baseCSS = ':host{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;color:inherit;font:inherit}*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}';
    const outerStyles = Object.entries({
        width: '100%', 'min-width': '0', 'max-width': '100%',
        'inline-size': '100%', 'min-inline-size': '0', 'max-inline-size': '100%',
        'margin-inline': '0', 'box-sizing': 'border-box',
    });

    return (host, fields, values, html, css) => {
        const signature = JSON.stringify(values);
        const old = painted.get(host);
        if (old?.fields === fields && old.signature === signature && old.html === html && old.css === css) return;
        const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
        const legacy = document.createElement('template');
        legacy.innerHTML = html;
        const legacyStyles = [...legacy.content.querySelectorAll('style')];
        const embeddedCSS = legacyStyles.map(style => style.textContent).join('\n');
        legacyStyles.forEach(style => style.remove());
        const wrapper = document.createElement('div');
        wrapper.append(legacy.content);
        const outer = wrapper.firstElementChild;
        const headings = wrapper.querySelectorAll('header, h1, h2, h3, h4, .rp-title');
        for (const title of [outer, outer?.firstElementChild, ...headings]) {
            if (title?.textContent.trim() === '상태창') title.remove();
        }
        const fragment = SillyTavern.libs.DOMPurify.sanitize(htmlFor(wrapper.innerHTML, fields, values), {
            ALLOWED_TAGS: HTML_TAGS,
            ALLOWED_ATTR: HTML_ATTRIBUTES,
            ALLOW_DATA_ATTR: false,
            RETURN_DOM_FRAGMENT: true,
        });
        for (const element of fragment.children) {
            // Fit the outer theme to the host column, including older fixed-width themes.
            for (const [property, value] of outerStyles) element.style.setProperty(property, value, 'important');
        }
        const themeStyle = baseCSS + '\n' + (css || '') + '\n' + embeddedCSS;
        if (sheet) {
            if (currentCSS !== themeStyle) {
                sheet.replaceSync(themeStyle);
                currentCSS = themeStyle;
            }
            if (root.adoptedStyleSheets[0] !== sheet) root.adoptedStyleSheets = [sheet];
            root.replaceChildren(fragment);
        } else {
            const style = document.createElement('style');
            style.textContent = themeStyle;
            root.replaceChildren(style, fragment);
        }
        painted.set(host, { fields, signature, html, css });
    };
}
