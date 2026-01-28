/**
 * Safe markdown parser that escapes HTML to prevent XSS attacks.
 *
 * Supports a limited subset of markdown:
 * - Headings (#, ##, ###)
 * - Bold (**text**)
 * - Italic (*text*)
 * - Inline code (`code`)
 * - Line breaks
 */

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate that a CSS style string contains only safe characters.
 * Rejects strings that could break out of the style attribute.
 */
function isValidCssStyle(style: string): boolean {
  // Only allow: letters, numbers, spaces, basic CSS punctuation
  // Reject: quotes, angle brackets, script-related chars
  const safePattern = /^[a-zA-Z0-9\s:;,.#%()\-]+$/;
  return safePattern.test(style);
}

/**
 * Parse markdown text into safe HTML.
 *
 * HTML is escaped first to prevent XSS, then markdown syntax is converted.
 *
 * @param text - Raw markdown text
 * @param codeStyle - Optional inline styles for code blocks
 * @returns Safe HTML string
 */
export function parseMarkdownSafe(
  text: string,
  codeStyle?: string
): string {
  // First escape any HTML to prevent XSS
  const escaped = escapeHtml(text);

  // Then apply markdown transforms
  const defaultCodeStyle =
    'background: rgba(0,0,0,0.05); padding: 0.1em 0.3em; border-radius: 3px;';

  // Validate codeStyle to prevent style attribute injection
  const safeCodeStyle =
    codeStyle && isValidCssStyle(codeStyle) ? codeStyle : defaultCodeStyle;

  return escaped
    .replace(/^### (.+)$/gm, '<h3 style="margin: 0.5em 0; font-size: 1.1em;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin: 0.5em 0; font-size: 1.25em;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin: 0.5em 0; font-size: 1.5em;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, `<code style="${safeCodeStyle}">$1</code>`)
    .replace(/\n/g, '<br/>');
}
