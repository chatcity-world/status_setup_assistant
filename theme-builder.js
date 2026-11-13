import { DEFAULT_HTML } from './theme.js';

export function validateTheme(code, fields) {
    const clean = String(code ?? '').trim().replace(/^```(?:html)?\s*([\s\S]*?)\s*```$/i, '$1');
    if (!clean.startsWith('<') || !clean.endsWith('>')) throw new Error('완성된 HTML이 생성되지 않았습니다. 다시 생성해 주세요.');
    const template = document.createElement('template');
    template.innerHTML = clean;
    if (template.content.querySelector('script,style,iframe,link,object,embed')) {
        throw new Error('style 속성으로 작성한 HTML만 사용할 수 있습니다. 다시 생성해 주세요.');
    }
    const missing = fields.filter(field => field.enabled && !clean.includes(`{{${field.key}}}`) && !clean.includes(`{{${field.key}_게이지}}`));
    if (missing.length && !clean.includes('{{항목들}}')) throw new Error(`변수가 빠졌습니다: ${missing.map(field => field.key).join(', ')}`);
    return clean;
}

export async function generateTheme(description, fields) {
    const context = SillyTavern.getContext();
    if (context.onlineStatus === 'no_connection') throw new Error('실리태번의 AI 연결을 먼저 설정해 주세요.');
    const active = fields.filter(field => field.enabled).map(({key,label,type}) => ({key,label,type}));
    const prompt = [
        'Create a compact, polished roleplay status card as an HTML fragment. Return only complete HTML.',
        'Use inline style attributes for ALL styling. No style tags, scripts, external resources, event handlers, forms, document wrapper, fixed positioning or viewport units. Use responsive wrapping layouts that fit 280px. Make background match the requested theme using CSS colors, gradients and shadows. Ensure readable contrast.',
        'Include EVERY provided field with its exact display label and placeholder. Placeholder syntax is two opening braces + key + two closing braces, e.g. key 장소 becomes the token with 장소 between double braces. Put placeholders in text nodes only, never attributes. Do not fill in actual values. For gauge fields include the numeric placeholder followed by % and optionally a second placeholder with _게이지 appended to the key. Use no other tokens. No character dialogue.',
        'Fields: '+JSON.stringify(active),
        'Theme request: '+description,
    ].join('\n');
    const answer = await context.generateRaw({prompt, responseLength:4096, trimNames:false});
    return validateTheme(answer, fields);
}

export function combinedCode(settings) {
    if (!settings.css) return settings.html || DEFAULT_HTML;
    return `<style>\n${settings.css}\n</style>\n${settings.html}`;
}
