import hljs from 'highlight.js';

import { unescapeHtml, escapeHtml } from '@/utils/htmlProc';
import { useSettingsStore } from '@/states/settings';
import { mditLogger } from "@/utils/logger";

function contentPreprocess(input) {

    // if unescapeAll has enabled, unescape code content again may cause display error
    // so here we should force skip unescape process and ignore user settings.
    if (useSettingsStore.getState().forceUnescapeBeforeHighlight() === false) {
        return input;
    }

    if (useSettingsStore.getState().unescapeBeforeHighlight === true) {
        return unescapeHtml(input);
    }

    return input;
}

/**
 * Highlight a fenced code block and return the markup as a HTML string.
 *
 * This used to be a React component rendered through `renderToString()`, which pulled
 * react-dom/server into the message rendering hot path. The markup is identical, only
 * the way it is built changed.
 *
 * @param {string} content Code block content.
 * @param {string} lang Language name of this code block.
 * @returns {string} HTML string of the highlighted code block.
 */
export function renderHighlightedCodeBlockString(content, lang) {
    if (!lang || !hljs.getLanguage(lang)) {
        lang = 'plaintext';
    }

    var Finalcontent = "";
    try {
        Finalcontent = hljs.highlight(contentPreprocess(content), { language: lang, ignoreIllegals: true }).value;
    } catch (e) {
        mditLogger('error', `hljs error:`, e);
    }

    return '<pre class="hljs hl-code-block mdit-fenced-code-block">'
        + `<button class="lang_copy"><p class="lang">${escapeHtml(lang)}</p><p class="copy">复制</p></button>`
        + `<code>${Finalcontent}</code>`
        + '</pre>';
}

export function renderInlineCodeBlockString(tokens, idx, options, env, slf) {
    var token = tokens[idx];

    if (useSettingsStore.getState().unescapeAllHtmlEntites === true) {
        token.content = escapeHtml(token.content);
    }


    return '<code' + slf.renderAttrs(token) + '>' +
        token.content +
        '</code>';
}

/**
 * Find all Copy Button and add click handler to it. Will directly mutate the received 
 * HTML element.
 * 
 * @param {HTMLElement} element 
 */
export function addOnClickHandleForCopyButton(element) {
    var buttons = element.querySelectorAll('pre.hl-code-block>button.lang_copy');
    Array.from(buttons)
        .forEach(function (copyButton) {
            try {
                // get content of this code block
                var codeContent = copyButton.parentElement.querySelector('code').textContent;
                copyButton.onclick = () => { navigator.clipboard.writeText(codeContent) };
            } catch (e) {
                ;
            }
        });
}

/**
 * Find all Copy Button of Latex block and add hanlder to it.
 * 
 * @param {HTMLElement} element 
 */
export function addOnClickHandleForLatexBlock(element) {
    var buttons = element.querySelectorAll('div.katex-block-rendered>button.copy_latex');


    Array.from(buttons)
        .forEach(function (copyButton) {
            try {
                // find tex annotation
                var latexAnno = copyButton.parentElement.querySelector('annotation[encoding="application/x-tex"]').textContent;
                copyButton.onclick = () => { navigator.clipboard.writeText(latexAnno) };
            } catch (e) {
                ;
            }
        });
}

/**
 * Message box needs a column layout when its content is taller than a single line.
 *
 * All heights are read before any style is written. Reading `offsetHeight` right after
 * writing a style forces the browser to recalculate layout, so interleaving the two over
 * a long message list used to cost one forced reflow per message.
 */
export function changeDirectionToColumnWhenLargerHeight() {
    var msgBlocks = Array.from(document.querySelectorAll('.mix-message__inner'));

    var directions = msgBlocks.map(function (block) {
        return block.offsetHeight > 35 ? 'column' : 'row';
    });

    msgBlocks.forEach(function (block, index) {
        // skip unchanged values to avoid invalidating style for every message on every pass
        if (block.style.flexDirection !== directions[index]) {
            block.style.flexDirection = directions[index];
        }
    });
}
