import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import useCopy from '../../hooks/useCopy';
import { CheckIcon, CopyIcon } from './icons';
import '../../css/ai/code.css';

const REMARK_PLUGINS = [remarkGfm];
// Only highlight fences that name a language (no guessing), and never throw on an unknown one.
const REHYPE_PLUGINS = [[rehypeHighlight, { detect: false, ignoreMissing: true }]];

/** The plain text of a hast node (the highlighted spans flattened back into the source). */
function hastText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  return (node.children || []).map(hastText).join('');
}

function languageOf(node) {
  const code = node?.children?.find((child) => child.tagName === 'code');
  const classes = code?.properties?.className;
  const found = (Array.isArray(classes) ? classes : []).find((c) => String(c).startsWith('language-'));
  return found ? String(found).slice('language-'.length) : null;
}

/** A fenced code block: language label and Copy in a header, highlighted body below. */
function CodeBlock({ node, children }) {
  const [copied, copy] = useCopy();
  const language = languageOf(node);

  return (
    <div className="ai-chat__code">
      <div className="ai-chat__code-header">
        <span className="ai-chat__code-lang">{language || 'text'}</span>
        <button
          type="button"
          className="ai-chat__code-copy"
          aria-label={copied ? 'Copied' : 'Copy code'}
          onClick={() => copy(hastText(node))}
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

const COMPONENTS = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  pre: CodeBlock,
};

/**
 * Chat-flavoured Markdown: GitHub tables/task lists, links in a new tab, highlighted code blocks.
 * A fence that is still open while tokens stream in parses (and highlights) as a block to the end.
 */
function Markdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
}

export default React.memo(Markdown);
