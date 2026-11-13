export const DEFAULT_HTML = `<section class="rp-card" aria-label="상태창" style="padding:14px;border-radius:12px;background:#fff3d9;color:#26110e;font:14px/1.5 system-ui,sans-serif">
  <div style="font-weight:700;margin-bottom:10px">상태창</div>
  {{항목들}}
</section>`;

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

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ESCAPES[char]);
}

function gauge(label, value) {
    return `<progress class="rp-gauge" style="width:100%;height:6px;accent-color:currentColor" value="${value}" max="100" aria-label="${escapeHtml(label)}">${value}%</progress>`;
}

function htmlFor(template, fields, values) {
    const filled = fields.filter(field => field.enabled && Object.hasOwn(values, field.key));
    const rows = filled.map(({ key, label, type }) => {
        const value = values[key];
        const detail = type === 'gauge' ? `${value}%${gauge(label, value)}` : escapeHtml(value);
        return `<div class="rp-field"><dt class="rp-label" style="font-size:12px;opacity:.75">${escapeHtml(label)}</dt><dd class="rp-value" style="margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere">${detail}</dd></div>`;
    }).join('');
    const variables = new Map(fields.filter(field => field.enabled).map(field => [field.key, field]));
    const source = document.createElement('template');
    source.innerHTML = template;
    const walker = document.createTreeWalker(source.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        if (walker.currentNode.data.includes('{{')) nodes.push(walker.currentNode);
    }
    function resolve(key) {
        if (key === '항목들') return rows ? `<dl class="rp-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(118px,100%),1fr));gap:8px 14px;margin:0">${rows}</dl>` : '<p class="rp-empty">아직 입력된 상태가 없어요.</p>';
        if (key.endsWith('_게이지')) {
            const valueKey = key.slice(0, -'_게이지'.length);
            const field = variables.get(valueKey);
            return field?.type === 'gauge' && Object.hasOwn(values, valueKey) ? gauge(field.label, values[valueKey]) : '';
        }
        if (!variables.has(key)) return '';
        return Object.hasOwn(values, key) ? escapeHtml(values[key]) : '—';
    }
    for (const node of nodes) {
        const replacement = document.createElement('template');
        replacement.innerHTML = escapeHtml(node.data).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key) => resolve(key));
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
    const baseCSS = ':host{display:block;min-width:0;color:inherit;font:inherit}*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}';

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
        const fragment = SillyTavern.libs.DOMPurify.sanitize(htmlFor(wrapper.innerHTML, fields, values), {
            ALLOWED_TAGS: HTML_TAGS,
            ALLOWED_ATTR: HTML_ATTRIBUTES,
            ALLOW_DATA_ATTR: false,
            RETURN_DOM_FRAGMENT: true,
        });
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
