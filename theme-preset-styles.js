const LCD = {
    card: 'padding:11px;border:5px solid;border-radius:22px;box-shadow:inset 0 0 0 5px #fff;gap:5px;',
    header: 'gap:2px;',
    headerGroup: 'flex:1 1 116px;padding:6px 9px;border-radius:7px;',
    weatherGroup: 'justify-content:flex-end;',
    scene: 'padding:8px 9px;border-radius:8px;gap:4px;',
    item: 'border-radius:8px;',
    thought: 'padding:8px 10px 9px;',
    gauge: 'padding:7px 9px;',
    labelColumn: '42px',
    gaugeTrack: '-webkit-mask-image:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 7px);mask-image:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 7px);',
};

function lcdFooter(background, grid, ink) {
    return `<div aria-hidden="true" style="display:grid;place-items:center;min-height:56px;border-radius:8px;color:${ink};background-color:${background};background-image:linear-gradient(to right,${grid} 1px,transparent 1px),linear-gradient(to bottom,${grid} 1px,transparent 1px);background-size:4px 4px;background-position:center">
    <span style="display:block;width:44px;height:40px">
      <span style="display:block;width:3px;height:3px;margin:1px;box-shadow:
        12px 0,16px 0,20px 0,24px 0,28px 0,8px 4px,32px 4px,4px 8px,36px 8px,
        4px 12px,12px 12px,28px 12px,36px 12px,0 16px,12px 16px,28px 16px,40px 16px,
        0 20px,16px 20px,20px 20px,24px 20px,40px 20px,4px 24px,36px 24px,
        8px 28px,32px 28px,12px 32px,16px 32px,20px 32px,24px 32px,28px 32px,12px 36px,28px 36px"></span>
    </span>
  </div>`;
}

const SLACK = {
    card: 'grid-template-columns:40px minmax(0,1fr);padding:0;gap:0;border-radius:12px;overflow:hidden;',
    headerGroup: 'padding:2px 10px;border-radius:999px;',
    scene: 'padding:1px 0;border-radius:0;gap:5px;',
    item: 'border-radius:5px;',
    thought: 'padding:8px 10px;',
    gauge: 'padding:6px 9px;border-radius:999px;',
    labelColumn: '44px',
};

const WIDGET_WEATHER = {
    surface: '#090b10',
    background: 'radial-gradient(ellipse 86% 31% at 51% 106%,#c5edff8c,#77aaff30 53%,transparent 100%),'
        + 'linear-gradient(180deg,#090b10 0%,#0a0f19 54%,#10234a 73%,#234cba 88%,#5a8df8 96%,#8ecbff 100%)',
    edge: 'border:1px solid #92b7ef3b;border-bottom-color:#b9e6ffc4;',
    shadow: 'inset 0 2px 6px #a6caff19,inset 4px 0 12px #7ca9ff29,inset -4px 0 12px #7ca9ff29,inset 0 -2px 8px #baedff70',
};

const WIDGET_CSS = `:host { container-type: inline-size; }

.rp-widget-details:only-child { grid-column: 1 / -1; }
.rp-status-widget .rp-gauge::-webkit-progress-value { border-radius: 0; }
.rp-status-widget .rp-gauge::-moz-progress-bar { border-radius: 0; }

@container (max-width: 470px) {
    .rp-widget-weather {
        --rp-widget-weather-gap: 3px;
        --rp-widget-weather-padding: 7px 9px;
        --rp-widget-place-padding: 2px 6px;
    }
}

@container (max-width: 320px) {
    .rp-widget-columns { --rp-widget-columns: minmax(0, 1fr); }
    .rp-widget-weather { --rp-widget-weather-width: min(100%, 180px); justify-self: center; }
}`;

export const THEME_PRESETS = {
    white: {
        id: 'white', label: '화이트', scheme: 'light', swatch: '#fff',
        background: '#f2f2f2', text: '#28292c', muted: '#656970', scene: '#ffffff', thought: '#ddd',
        gaugeText: '#384451', gaugeAccent: '#657589', gaugeTrack: '#e5e7e9',
    },
    dark: {
        id: 'dark', label: '다크', scheme: 'dark', swatch: '#24262b',
        background: '#202227', text: '#eef0f3', muted: '#b0b7c2', scene: '#2b2e34', thought: '#292c33',
        gaugeText: '#d5e0ed', gaugeAccent: '#9db3cd', gaugeTrack: '#3c444f',
    },
    ocean: {
        id: 'ocean', label: '바다', scheme: 'dark', swatch: 'linear-gradient(180deg,#002C5F,#0A66B1)',
        background: '#002c5f', cardBackground: 'linear-gradient(180deg,#002C5F 0%,#0A66B1 100%)',
        text: '#ffffff', muted: '#e1eeff', scene: '#225c90', sceneBackground: '#e7f4ff17', thought: '#1a64ae',
        gaugeText: '#ffffff', gaugeAccent: '#a8d7ff', gaugeTrack: '#ffffff',
        skin: {
            card: 'padding:13px 13px 9px;gap:9px;overflow:hidden;',
            headerGroup: 'padding:0 2px 2px;',
            scene: 'padding:8px 11px;border:1px solid #ffffff40;box-shadow:inset 0 1px 0 #ffffff1f;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
            thought: 'padding:9px 12px 10px;border:1px solid #ffffff29;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
            labelColumn: '44px',
            footer: '<div aria-hidden="true" style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:5px 11px;padding:2px 0"><span>🐟</span><span>🐠</span><span>🐡</span><span>🦈</span><span>🐬</span><span>🐋</span><span>🐳</span></div>',
        },
    },
    tamagotchi: {
        id: 'tamagotchi', label: '다마고치', scheme: 'light', swatch: '#a4a995',
        background: '#a4a995', text: '#20241a', muted: '#2a3325', headerMuted: '#20241a', headerBackground: '#bec3b0',
        scene: '#b3b9a5', thought: '#c0c5b2',
        gaugeBackground: '#939b84', gaugeText: '#20241a', gaugeAccent: '#20241a', gaugeTrack: '#757e68',
        skin: { ...LCD, card: `${LCD.card}border-color:#6f7562;`, footer: lcdFooter('#989f89', '#dce1d057', '#20241a') },
    },
    'pink-tamagotchi': {
        id: 'pink-tamagotchi', label: '핑크 다마고치', scheme: 'light', swatch: '#c8b2bc',
        background: '#c8b2bc', text: '#392e34', muted: '#643954', headerMuted: '#392e34', headerBackground: '#e1cdd4',
        scene: '#e4d4da', thought: '#eadce1',
        gaugeBackground: '#cfb6c0', gaugeText: '#392e34', gaugeAccent: '#624657', gaugeTrack: '#b69eab',
        skin: { ...LCD, card: `${LCD.card}border-color:#896e7a;`, footer: lcdFooter('#c4abb6', '#eadce168', '#624657') },
    },
    excel: {
        id: 'excel', label: '엑셀', scheme: 'light', swatch: '#216447',
        background: '#d6e0d9', text: '#25372c', muted: '#3f634e', headerBackground: '#216447',
        headerText: '#f5faf7', headerMuted: '#dfede5', scene: '#fafcfb', thought: '#f0f5f1',
        gaugeBackground: '#eaf4ed', gaugeText: '#245c3e', gaugeAccent: '#3c8258', gaugeTrack: '#d1e4d6',
        skin: {
            card: 'gap:1px;padding:0;border:1px solid #5d806b;border-radius:12px;overflow:hidden;',
            header: 'gap:1px;background:#78a78c;',
            headerGroup: 'flex:1 1 114px;padding:7px 9px;border-radius:0;',
            weatherGroup: 'justify-content:flex-end;',
            scene: 'padding:0;gap:1px;border-radius:0;',
            item: 'border-radius:0;',
            thought: 'padding:9px 12px 10px;',
            gauge: 'padding:7px 9px;',
            labelColumn: '56px',
            cellLine: '#d6e0d9',
        },
    },
    'slack-white': {
        id: 'slack-white', label: '슬랙 화이트', scheme: 'light', swatch: '#3f0e40',
        background: '#ffffff', text: '#1d1c1d', muted: '#565356', headerBackground: '#f1eff1',
        scene: '#ffffff', thought: '#eeeeee',
        gaugeBackground: '#eaf4fb', gaugeText: '#1264a3', gaugeAccent: '#1264a3', gaugeTrack: '#cfe2f0',
        skin: { ...SLACK, card: SLACK.card + 'border:1px solid #9c829d;' },
        slack: { rail: '#3f0e40', logo: '#ffffff', channel: '#704771', header: '#ffffff', divider: '#e3e0e3' },
    },
    'slack-dark': {
        id: 'slack-dark', label: '슬랙 다크', scheme: 'dark', swatch: '#27182c',
        background: '#1a1d21', text: '#e8e6eb', muted: '#bdb9c3', headerBackground: '#2d2f36',
        scene: '#1a1d21', thought: '#28252d',
        gaugeBackground: '#233540', gaugeText: '#b9dcf4', gaugeAccent: '#79b7e2', gaugeTrack: '#425866',
        skin: { ...SLACK, card: SLACK.card + 'border:1px solid #534658;' },
        slack: { rail: '#27182c', logo: '#402b46', channel: '#553b5c', header: '#22252a', divider: '#3b3c43' },
    },
    neon: {
        id: 'neon', label: '네온', scheme: 'dark', swatch: 'radial-gradient(ellipse at 75% 100%,#a4dbff,#225bd5 35%,#0b1935 78%)',
        background: '#0b1935', text: '#ecf4ff', muted: '#a0b7da', headerMuted: '#aedbff',
        cardBackground: [
            'linear-gradient(90deg,transparent 6%,#639bff50 40%,#cff0ffd9 77%,transparent) bottom/100% 1px no-repeat',
            'radial-gradient(ellipse 79% 23px at 76% 100%,#a4dbffd9,#478dffc4 22%,#235af38a 46%,#184bd732 70%,transparent)',
            'radial-gradient(ellipse 22px 78% at 100% 83%,#62aaff91,#2866f24d 40%,transparent)',
            'radial-gradient(ellipse 46% 19px at 16% 0%,#559eff78,#215eea42 42%,transparent)',
            'radial-gradient(ellipse 16px 58% at 0 16%,#436df65c,transparent)',
            'linear-gradient(135deg,#0b1935f5,#040a19f7 58%,#08152ff2)',
        ].join(','),
        headerBackground: '#10203e', headerGroupBackground: 'linear-gradient(120deg,#6ba5ff15,#6ba5ff07)',
        scene: '#03091a', sceneBackground: '#03091a52', locationText: '#cce7ff', thought: 'transparent',
        gaugeText: '#aedbff', gaugeAccent: '#70b6ff', gaugeTrack: '#8cbaff29',
        gaugeFill: 'linear-gradient(90deg,#3669d8,#70b6ff 85%,#caf0ff)',
        skin: {
            card: 'padding:11px 12px 14px;gap:7px;border-radius:16px;overflow:hidden;word-break:keep-all;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:inset 0 0 0 1px #5e91ef42,inset 0 0 14px #2865ee29;',
            typography: 'font-family:var(--rp-status-font-family,var(--mainFontFamily,system-ui,sans-serif));font-size:12px;line-height:1.45;',
            header: 'display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:6px;',
            headerGroup: 'justify-content:space-between;gap:2px 8px;padding:4px 8px;border-radius:7px;box-shadow:inset 0 1px 0 #b1d3ff15;font-size:11px;font-variant-numeric:tabular-nums;',
            scene: 'padding:3px 8px;gap:0;border-radius:7px;',
            groupRow: 'padding-block:2px;',
            label: 'font-size:10px;',
            labelColumn: '36px',
            thought: 'display:grid;justify-items:center;gap:2px;padding:6px 8px 0;border-radius:0;border-top:1px solid #a5c7ff1a;font-size:11px;',
            stackedValueMargin: '0 auto',
            gauge: 'align-items:center;padding:0 8px;',
            gaugeTrack: '--rp-gauge-height:3px;height:var(--rp-gauge-height);border-radius:2px;overflow:visible;',
            gaugeValue: 'font-size:11px;',
            gaugeGlow: '0 0 6px #508fff65',
        },
    },
    'iphone-widget': {
        id: 'iphone-widget', label: '위젯', scheme: 'dark', swatch: WIDGET_WEATHER.background,
        background: '#050e08', text: '#f6f8f6', muted: '#b9c1bb', headerMuted: '#bdc3c0', scene: 'transparent',
        thought: '#17211b', gaugeBackground: '#202a24', gaugeText: '#f6f8f6', gaugeAccent: '#fafcfb',
        gaugeTrack: 'repeating-linear-gradient(90deg,#818b83 0 1px,transparent 1px 4px) center/100% 65% no-repeat',
        widget: {
            weather: WIDGET_WEATHER,
            css: WIDGET_CSS,
            detail: {
                background: '#17211b',
                style: 'display:grid;grid-template-columns:minmax(0,1fr);gap:4px;'
                    + 'padding:clamp(9px,2.3cqi,14px) clamp(10px,2.5cqi,16px);border-radius:clamp(12px,3.2cqi,20px);',
            },
        },
        skin: {
            card: 'container-type:inline-size;padding:0;gap:0;border-radius:clamp(20px,4.6cqi,36px);word-break:keep-all;',
            typography: 'font-family:var(--rp-status-font-family,var(--mainFontFamily,-apple-system,system-ui,sans-serif));font-size:12px;line-height:1.45;',
            labelColumn: '3em',
            labelGap: 7,
            scene: 'align-content:start;padding:0;',
            thought: 'display:grid;gap:3px;padding:clamp(7px,1.7cqi,11px) clamp(9px,2.1cqi,15px);border-radius:clamp(10px,2cqi,16px);',
            stackedValueMargin: '0 auto',
            gauge: 'grid-template-columns:max-content minmax(0,1fr);align-items:center;gap:9px;'
                + 'padding:clamp(7px,1.7cqi,11px) clamp(9px,2.1cqi,15px);border-radius:clamp(10px,2cqi,16px);',
            gaugeTrack: '--rp-gauge-height:clamp(5px,1.4cqi,10px);height:var(--rp-gauge-height);',
            gaugeValue: 'font-weight:550;',
        },
    },
};

const SLACK_LOGO = [
    ['#36c5f0', 5, 0, 4, 4], ['#36c5f0', 0, 5, 9, 4],
    ['#2eb67d', 10, 0, 4, 9], ['#2eb67d', 15, 5, 4, 4],
    ['#e01e5a', 0, 10, 4, 4], ['#e01e5a', 5, 10, 4, 9],
    ['#ecb22e', 10, 10, 9, 4], ['#ecb22e', 10, 15, 4, 4],
].map(([color, left, top, width, height]) =>
    `<span style="position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;border-radius:4px;background:${color}"></span>`).join('');

export function slackRail({ rail, logo, channel }) {
    return `<div aria-hidden="true" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0;background:${rail}">
    <span style="display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:${logo}">
      <span style="position:relative;width:19px;height:19px">${SLACK_LOGO}</span>
    </span>
    <span data-rp-status-field="장소" data-rp-status-hide-empty style="display:grid;place-items:center;width:27px;min-height:27px;border-radius:7px;background:${channel};color:#fff">#</span>
  </div>`;
}
