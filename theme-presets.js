import { indexFields } from './status.js';
import { escapeHtml } from './theme.js';
import { syncThemeFields } from './theme-builder.js';

export const THEME_PRESETS = {
    white: {
        label: '화이트', scheme: 'light', swatch: '#fff',
        background: '#f8f8f8', text: '#28292c', muted: '#656970', scene: '#fff', thought: '#f2f2f2',
        gaugeText: '#384451', gaugeAccent: '#657589', gaugeTrack: '#e5e7e9',
    },
    dark: {
        label: '다크', scheme: 'dark', swatch: '#24262b',
        background: '#202227', text: '#eef0f3', muted: '#b0b7c2', scene: '#2b2e34', thought: '#292c33',
        gaugeText: '#d5e0ed', gaugeAccent: '#9db3cd', gaugeTrack: '#3c444f',
    },
};

export function makeThemePreset(palette, fields) {
    const byKey = indexFields(fields);
    const binding = field => `data-rp-status-field="${escapeHtml(field.key)}"`;
    const value = field => `{{표시:${escapeHtml(field.variable ?? field.key)}}}`;
    const label = field => `<dt data-rp-status-field-label style="font-size:10px;font-weight:600;color:${palette.muted}">${escapeHtml(field.label || field.key)}</dt>`;
    const column = 'grid-template-columns:40px minmax(0,1fr)';
    const pairs = [['날짜', '시간'], ['날씨', '기온']].map(keys => keys.map(key => byKey.get(key)))
        .filter(pair => pair.some(Boolean));

    function pair([primary, secondary]) {
        return `<div data-rp-status-group style="display:flex;align-items:baseline;gap:8px;min-width:0">
      ${primary ? `<strong ${binding(primary)} style="font-weight:650">${value(primary)}</strong>` : ''}
      ${secondary ? `<span ${binding(secondary)} style="color:${palette.muted};white-space:nowrap">${value(secondary)}</span>` : ''}
    </div>`;
    }

    const sceneFields = ['장소', '옷차림'].map(key => byKey.get(key)).filter(Boolean);
    const scene = sceneFields.map(field =>
        `<div ${binding(field)} style="display:contents">
      ${label(field)}
      <dd style="margin:0">${value(field)}</dd>
    </div>`).join('\n    ');
    const affection = byKey.get('호감도');
    const thought = byKey.get('속마음');
    const code = `<section lang="ko" aria-label="상태 정보" style="box-sizing:border-box;width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:14px;border-radius:18px;background:${palette.background};color:${palette.text};color-scheme:${palette.scheme};font:12px/1.55 system-ui,sans-serif;text-align:start;overflow-wrap:anywhere">
  ${pairs.length ? `<div data-rp-status-group style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:5px 16px;padding-inline:12px;font-variant-numeric:tabular-nums">
    ${pairs.map(pair).join('\n    ')}
  </div>` : ''}

  ${scene ? `<dl data-rp-status-group style="display:grid;${column};align-items:baseline;gap:5px 8px;margin:0;padding:10px 12px;border-radius:12px;background:${palette.scene}">
    ${scene}
  </dl>` : ''}

  ${affection ? `<dl ${binding(affection)} style="display:grid;${column};align-items:center;gap:8px;margin:0;padding:1px 12px">
    ${label(affection)}
    <dd style="margin:0;color:${palette.gaugeText};--rp-gauge-accent:${palette.gaugeAccent};--rp-gauge-track:${palette.gaugeTrack}">${value(affection)}</dd>
  </dl>` : ''}

  ${thought ? `<dl ${binding(thought)} style="margin:0;padding:11px 12px;border-radius:12px;background:${palette.thought};text-align:center">
    ${label(thought)}
    <dd style="max-width:60ch;margin:4px auto 0;white-space:pre-wrap">${value(thought)}</dd>
  </dl>` : ''}
</section>`;

    return syncThemeFields(code, [], fields);
}
