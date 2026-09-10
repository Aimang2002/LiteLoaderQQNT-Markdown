// markdown
import markdownIt from 'markdown-it';
import katexPlugin from '@/lib/markdown-it-katex';
import katex from 'katex';

// Components
import { renderHighlightedCodeBlockString, renderInlineCodeBlockString } from '@/components/code_block';

// Settings
import { useSettingsStore } from '@/states/settings';

// Utils
import { purifyHtml, unescapeHtml } from '@/utils/htmlProc';
import { mditLogger } from '@/utils/logger';

const TEXT_ELEMENT_MATCHER = 'text-element';

type SettingsState = ReturnType<typeof useSettingsStore.getState>;

let markdownItIns: markdownIt | undefined = undefined;

/**
 * Function that generates a MarkdownIt instance based on user settings.
 */
function getMarkdownIns() {
    const settings = useSettingsStore.getState();
    if (markdownItIns !== undefined) {
        return markdownItIns;
    }
    mditLogger('info', 'Generating new markdown-it renderer...');
    let localMarkdownItIns = markdownIt({
        html: true, // 在源码中启用 HTML 标签
        xhtmlOut: true, // 使用 '/' 来闭合单标签 （比如 <br />）。
        // 这个选项只对完全的 CommonMark 模式兼容。
        breaks: true, // 转换段落里的 '\n' 到 <br>。
        langPrefix: "language-", // 给围栏代码块的 CSS 语言前缀。对于额外的高亮代码非常有用。
        linkify: settings.linkify, // 将类似 URL 的文本自动转换为链接。

        // 启用一些语言中立的替换 + 引号美化
        typographer: settings.typographer,

        // 双 + 单引号替换对，当 typographer 启用时。
        // 或者智能引号等，可以是 String 或 Array。
        //
        // 比方说，你可以支持 '«»„“' 给俄罗斯人使用， '„“‚‘'  给德国人使用。
        // 还有 ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] 给法国人使用（包括 nbsp）。
        quotes: "“”‘’",

        // custom highlight UI renderer for markdown it.
        highlight: function (str, lang) {
            if (lang === 'mermaid' && useSettingsStore.getState().renderMermaid) {
                return `<div class="mdit-mermaid-block" data-mermaid="${encodeURIComponent(str)}"></div>`;
            }
            if ((lang === 'latex' || lang === 'tex') && useSettingsStore.getState().renderLatexBlock) {
                try {
                    return katex.renderToString(str, { displayMode: true, throwOnError: false });
                } catch (e) {
                    return renderHighlightedCodeBlockString(str, 'plaintext');
                }
            }
            return renderHighlightedCodeBlockString(str, lang);
        },
    }).use(katexPlugin);
    localMarkdownItIns.renderer.rules.code_inline = renderInlineCodeBlockString;
    markdownItIns = localMarkdownItIns;
    return localMarkdownItIns;
}

/**
 * Remove the wrapping `<p>` when the rendered markdown is a single paragraph.
 *
 * markdown-it counts a single occurrence of the closing tag as one paragraph, so the
 * former `DOMParser().parseFromString()` round trip (which built a whole HTML document
 * per message span) is not needed to detect this case.
 */
function stripSingleParagraph(renderedHtml: string): string {
    if (renderedHtml.startsWith('<p>')
        && renderedHtml.endsWith('</p>')
        && renderedHtml.indexOf('</p>') === renderedHtml.length - '</p>'.length) {
        return renderedHtml.substring(3, renderedHtml.length - 4).trim();
    }

    return renderedHtml;
}

/**
 * Apply the configured HTML entity handling to a raw text chunk.
 */
function entityProcess(input: string, settings: SettingsState): string {
    if (settings.unescapeAllHtmlEntites === true) {
        return unescapeHtml(input);
    }
    if (settings.unescapeGtInText === true) {
        return input.replaceAll('&gt;', '>');
    }
    return input;
}

/**
 * Render a single message fragment as Markdown, in place.
 *
 * Only pure text fragments (`span.text-element` without any mention) are handled; every
 * other fragment is left untouched so it keeps its original look.
 *
 * @param element The message fragment to render.
 * @param settings Settings snapshot of the current render pass.
 * @returns `true` when this fragment was rendered, `false` when it was skipped.
 */
export function renderTextElement(element: HTMLElement, settings: SettingsState): boolean {
    if (!(element.tagName == 'SPAN')
        || !element.classList.contains(TEXT_ELEMENT_MATCHER)
        || element.querySelector('.text-element--at')) {
        return false;
    }

    // get all text in this text span
    let originalText = Array.from(element.getElementsByTagName("span"))
        .map((child) => entityProcess(child.innerHTML, settings))
        .reduce((acc, x) => acc + x, '');

    // render markdown, then apply the post processor (which also accepts text)
    let renderedMarkdownInnerHtml = getMarkdownIns().render(originalText);

    if ((settings.forceEnableHtmlPurify() ?? settings.enableHtmlPurify) === true) {
        renderedMarkdownInnerHtml = purifyHtml(renderedMarkdownInnerHtml) as string;
    }

    element.innerHTML = stripSingleParagraph(renderedMarkdownInnerHtml.trim());

    return true;
}
