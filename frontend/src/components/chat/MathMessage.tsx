'use client'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { cn } from '@/lib/utils'

interface MathMessageProps {
  content: string
  role: 'user' | 'assistant'
  className?: string
}

export function MathMessage({ content, className }: MathMessageProps) {
  return (
    <div className={cn(
      'math-message prose prose-sm dark:prose-invert max-w-none',
      // Override prose defaults for chat bubbles
      'prose-p:leading-relaxed prose-p:my-1',
      'prose-pre:bg-muted prose-pre:border prose-pre:border-border/50',
      'prose-code:text-violet-700 dark:prose-code:text-violet-300',
      'prose-code:bg-violet-50 dark:prose-code:bg-violet-900/30',
      'prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em]',
      // KaTeX overrides
      '[&_.katex]:text-foreground',
      '[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto',
      '[&_.katex-display]:px-4 [&_.katex-display]:py-3',
      '[&_.katex-display]:bg-muted/50 [&_.katex-display]:rounded-lg',
      '[&_.katex-display]:border [&_.katex-display]:border-border/40',
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom table styling
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border/50 bg-muted px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border/50 px-3 py-2">{children}</td>
          ),
          // Highlight citations/references
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-violet-400 pl-4 py-1 my-2 bg-violet-50/50 dark:bg-violet-900/20 rounded-r-lg text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          // Code blocks
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || '')
            const isInline = !match
            return isInline ? (
              <code className="font-mono text-[0.85em] bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1 py-0.5 rounded" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-muted border border-border/50 rounded-lg p-4 overflow-x-auto my-3">
                <code className={cn('font-mono text-sm', codeClassName)} {...props}>{children}</code>
              </pre>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
