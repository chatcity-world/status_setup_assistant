import { indexFields } from './status.js';
import { DEFAULT_HTML, gaugeDisplay, resolveThemeField, themeVariableNames } from './theme.js';

const VARIABLE = /\{\{\s*([^{}]+?)\s*\}\}(\s*%)?/g;

function gaugeVariables(bar, value) {
    const gauge = document.createElement('template');
    gauge.innerHTML = gaugeDisplay(bar, value);
    return gauge.content;
}

function fieldRow(field) {
    const row = document.createElement('div');
    row.dataset.rpStatusField = field.key;
    const label = document.createElement('span');
    label.dataset.rpStatusFieldLabel = '';
    label.textContent = field.label || field.key;
    const [value, bar] = themeVariableNames(field).map(name => `{{${name}}}`);
    row.append(label, ' ', bar ? gaugeVariables(bar, `${value}%`) : value);
    return row;
}

function readThemeVariables(template, resolve) {
    const nodes = [];
    const formats = new Map();
    let hasAllFields = false;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.data.includes('{{') || node.parentElement?.closest('style, script')) continue;
        nodes.push(node);
        for (const [, token] of node.data.matchAll(VARIABLE)) {
            if (token === '항목들') hasAllFields = true;
            const match = resolve(token);
            if (!match) continue;
            if (!formats.has(match.field)) formats.set(match.field, new Set());
            formats.get(match.field).add(match.format);
        }
    }
    return { nodes, formats, hasAllFields };
}

function replaceVariables(nodes, resolve, formats, expandAll) {
    let changed = false;
    const rendered = new Map();
    function replacementFor(original, token, percent = '') {
        if (token === '항목들') return expandAll ?? original;
        const match = resolve(token);
        if (!match) return original;
        const { field, format, wasGauge } = match;
        const [value, bar] = themeVariableNames(field).map(name => `{{${name}}}`);
        const fieldFormats = formats.get(field);
        const hasValue = fieldFormats.has('value');
        const hasBar = fieldFormats.has('gauge');
        if (!bar) {
            if (format === 'display' && hasValue) return '';
            if (format === 'gauge' && (hasValue || fieldFormats.has('display'))) return '';
            return value + (wasGauge ? '' : percent);
        }
        if (!rendered.has(field)) rendered.set(field, new Set());
        const used = rendered.get(field);
        if (used.has(format)) return '';
        used.add(format);
        if (format === 'display' && (hasValue || hasBar)) return '';
        if (hasValue && hasBar) return format === 'gauge' ? bar : value + (percent || '%');
        return gaugeVariables(bar, value + (percent || '%'));
    }

    for (const node of nodes) {
        const content = document.createDocumentFragment();
        let offset = 0;
        for (const match of node.data.matchAll(VARIABLE)) {
            const [original, token, percent] = match;
            const replacement = replacementFor(original, token, percent);
            if (replacement === original) continue;
            content.append(node.data.slice(offset, match.index), replacement);
            offset = match.index + original.length;
        }
        if (!offset) continue;
        content.append(node.data.slice(offset));
        node.replaceWith(content);
        changed = true;
    }
    return changed;
}

function serializeTheme(template) {
    const result = document.createElement('div');
    result.append(template.content);
    return result.innerHTML.trim();
}

export function syncThemeFields(code, previousFields, fields) {
    if (!code || code === DEFAULT_HTML) return code;
    const current = indexFields(fields);
    const previous = indexFields(previousFields);
    const oldFields = new Map(previousFields.map(field => [field.key, field]));
    const targets = fields.filter(field => {
        if (!field.enabled) return false;
        const old = oldFields.get(field.key);
        return field.type === 'gauge' || !old?.enabled || old.variable !== field.variable || old.label !== field.label || old.type !== field.type;
    });
    if (!targets.length && fields.length === previousFields.length) return code;
    const targetKeys = new Set(targets.map(field => field.key));
    const template = document.createElement('template');
    template.innerHTML = code;
    const resolve = token => {
        const resolved = resolveThemeField(token, current) ?? resolveThemeField(token, previous, true);
        const field = resolved && current.get(resolved.field.key);
        if (!field || !targetKeys.has(field.key)) return undefined;
        return { field, format: resolved.format, wasGauge: oldFields.get(field.key)?.type === 'gauge' };
    };
    let updated = false;
    for (const row of template.content.querySelectorAll('[data-rp-status-field]')) {
        const key = row.dataset.rpStatusField;
        const field = current.get(key);
        if (!field || field.key !== key) {
            row.remove();
            updated = true;
            continue;
        }
        const label = row.querySelector('[data-rp-status-field-label]');
        const previousLabel = oldFields.get(key)?.label;
        if (label && label.textContent === previousLabel && label.textContent !== field.label) {
            label.textContent = field.label;
            updated = true;
        }
    }
    for (const gauge of template.content.querySelectorAll('.rp-gauge-display')) {
        const match = /^\{\{\s*([^{}]+?)\s*\}\}%?$/.exec(gauge.lastElementChild?.textContent.trim() ?? '');
        const resolved = match && resolve(match[1]);
        if (resolved?.field.type !== 'text' || !resolved.wasGauge) continue;
        gauge.replaceWith(`{{${themeVariableNames(resolved.field)[0]}}}`);
        updated = true;
    }
    const { nodes, formats, hasAllFields } = readThemeVariables(template, resolve);
    updated = replaceVariables(nodes, resolve, formats) || updated;
    if (!hasAllFields) {
        const added = targets.filter(field => {
            const old = oldFields.get(field.key);
            return !formats.has(field) && (!old?.enabled || old.label !== field.label || old.type !== field.type);
        });
        const containers = [...template.content.children];
        const container = containers.find(element => ['section', 'article', 'div'].includes(element.localName)) ?? template.content;
        for (const field of added) container.append(fieldRow(field));
        updated ||= added.length > 0;
    }
    return updated ? serializeTheme(template) : code;
}

export function validateTheme(code, fields, explicitVariables = false) {
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
    const byKey = indexFields(fields);
    const resolve = token => resolveThemeField(token, byKey);
    const { nodes, formats, hasAllFields } = readThemeVariables(template, resolve);
    const missing = fields.filter(field => field.enabled && !formats.has(field));
    if (missing.length && !hasAllFields) {
        throw new Error('모델이 변수 일부를 빠뜨렸어요: ' + missing.map(field => field.label || field.key).join(', '));
    }
    if (!explicitVariables) return clean;
    const expanded = hasAllFields ? document.createDocumentFragment() : null;
    if (expanded) expanded.append(...missing.map(fieldRow));
    return replaceVariables(nodes, resolve, formats, expanded) ? serializeTheme(template) : clean;
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
    const active = fields.filter(field => field.enabled).map(field => ({
        label: field.label, type: field.type, variables: themeVariableNames(field).map(name => `{{${name}}}`),
    }));
    const prompt = [
        'Create a compact roleplay status card that starts with its fields, with no generic heading. Return only one complete HTML fragment.',
        'Use inline style attributes for ALL styling. No style tags, scripts, external resources, event handlers, forms, document wrapper, fixed positioning or viewport units. Use responsive wrapping layouts that fit 280px. Make background match the requested theme using CSS colors, gradients and shadows. Ensure readable contrast.',
        'Use the exact variables listed for each field, once each and only in text nodes. A gauge field has two variables: render its _게이지 variable for the bar and its value variable followed by % for the number. Use the supplied display labels. Do not replace the variables with sample values, {{항목들}}, or a 표시: placeholder.',
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
    return validateTheme(parsed?.content ?? answer, fields, true);
}

export function combinedCode(settings) {
    if (!settings.css) return settings.html || DEFAULT_HTML;
    return `<style>\n${settings.css}\n</style>\n${settings.html}`;
}
