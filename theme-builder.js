import { DEFAULT_HTML } from './theme.js';

export function validateTheme(code, fields) {
    const text = String(code ?? '').trim()
        .replace(/^(?:\s*<(think|thinking|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>)+\s*/i, '');
    const fenced = text.match(/(?:^|\r?\n)[ \t]*```(?:html)?[ \t]*\r?\n\s*(<[\s\S]*?)\r?\n[ \t]*```(?=[ \t]*(?:\r?\n|$))/i);
    const clean = (fenced?.[1] ?? text.replace(/^```(?:html)?\s*([\s\S]*?)\s*```$/i, '$1')).trim();
    if (!clean) throw new Error('모델이 테마 코드를 보내지 않았어요. 원하는 테마를 짧게 적고 다시 생성해 주세요.');
    if (!clean.startsWith('<') || !clean.endsWith('>')) {
        throw new Error('모델 답변에서 완성된 HTML을 찾지 못했어요. 더 간단한 테마로 다시 생성해 주세요.');
    }
    const template = document.createElement('template');
    template.innerHTML = clean;
    if (!template.content.firstElementChild || template.content.querySelector('script,style,iframe,link,object,embed,form,template')) {
        throw new Error('모델이 사용할 수 없는 HTML을 보냈어요. “인라인 스타일만 사용”을 덧붙여 다시 생성해 주세요.');
    }
    const keys = new Set();
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        for (const [, key] of walker.currentNode.data.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) keys.add(key);
    }
    const missing = fields.filter(field => field.enabled && !keys.has(field.key)
        && !(field.type === 'gauge' && keys.has(field.key + '_게이지')));
    if (missing.length && !keys.has('항목들')) {
        throw new Error('모델이 변수 일부를 빠뜨렸어요: ' + missing.map(field => field.label || field.key).join(', '));
    }
    return clean;
}

function describeRequestError(error) {
    const detail = [typeof error === 'string' ? error : '', error?.message, error?.error?.message, error?.response]
        .filter(value => typeof value === 'string').join(' ');
    const code = String(error?.status ?? error?.statusCode ?? error?.error?.status ?? '');
    if (error?.name === 'AbortError' || /cancelled by stop|cancelled by extension/i.test(detail)) return '테마 생성이 취소됐어요.';
    if (['401', '403'].includes(code) || /\b(?:401|403|unauthorized|forbidden)\b|invalid api key|authentication/i.test(detail)) {
        return 'API가 요청을 거절했어요. 실리태번의 API 연결에서 키와 모델 권한을 확인해 주세요.';
    }
    if (/quota|insufficient credits|insufficient balance|billing/i.test(detail)) {
        return 'API 사용 한도나 잔액을 확인해 주세요.';
    }
    if (code === '429' || /\b429\b|rate limit|too many requests/i.test(detail)) {
        return 'API 요청이 너무 많아요. 잠시 뒤 다시 생성해 주세요.';
    }
    if (/\bno message generated\b/i.test(detail)) return '모델 답변에서 테마 코드를 찾지 못했어요. 테마 설명을 짧게 적고 다시 생성해 주세요.';
    if (/failed to fetch|network error|networkerror/i.test(detail)) {
        return 'AI 요청을 보내지 못했어요. 실리태번 서버 연결을 확인해 주세요.';
    }
    return 'AI 요청이 실패했어요. 일반 채팅에서 답변이 오는지와 실리태번의 API 오류 알림을 확인해 주세요.';
}

export async function generateTheme(description, fields) {
    const context = SillyTavern.getContext();
    if (context.onlineStatus === 'no_connection') throw new Error('실리태번의 AI 연결을 먼저 설정해 주세요.');
    const active = fields.filter(field => field.enabled).map(({key,label,type}) => ({key,label,type}));
    const prompt = [
        'Create a compact, polished roleplay status card. Return only one complete HTML fragment.',
        'Use inline style attributes for ALL styling. No style tags, scripts, external resources, event handlers, forms, document wrapper, fixed positioning or viewport units. Use responsive wrapping layouts that fit 280px. Make background match the requested theme using CSS colors, gradients and shadows. Ensure readable contrast.',
        'Prefer the automatic fields placeholder: write 항목들 between two opening braces and two closing braces, on its own line inside the card. It inserts all fields with their exact labels. Alternatively include every provided field with its exact label and its key between double braces. Put placeholders in text nodes only. For gauges, put % after the numeric placeholder and optionally use a second placeholder with _게이지 appended to the key. Do not invent values or other placeholders.',
        'Fields: '+JSON.stringify(active),
        'Theme request: '+description,
    ].join('\n');
    const options = { prompt, api: context.mainApi, responseLength: 4096 };
    let answer;
    try {
        if (typeof context.generateRawData === 'function' && typeof context.extractMessageFromData === 'function') {
            // generateRaw runs the chat's AI-output regex over the generated HTML.
            const data = await context.generateRawData(options);
            answer = context.extractMessageFromData(data, options.api);
        } else {
            answer = await context.generateRaw({ ...options, trimNames: false });
        }
    } catch (error) {
        throw new Error(describeRequestError(error), { cause: error });
    }
    const parsed = typeof answer === 'string' ? context.parseReasoningFromString?.(answer) : undefined;
    return validateTheme(parsed?.content ?? answer, fields);
}

export function combinedCode(settings) {
    if (!settings.css) return settings.html || DEFAULT_HTML;
    return `<style>\n${settings.css}\n</style>\n${settings.html}`;
}
