import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { cn } from '#/lib/utils'

/**
 * Renders admin-written Markdown (product descriptions). Raw HTML in the
 * source is ignored, so only Markdown formatting reaches the page.
 */
export default function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-[var(--ink)]/80 prose-headings:text-[var(--ink)] prose-a:text-[var(--ink)] prose-strong:text-[var(--ink)] prose-code:before:content-none prose-code:after:content-none',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

/** Markdown reduced to plain text, for short previews like product cards. */
export function markdownToPlainText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '')
    .trim()
}
