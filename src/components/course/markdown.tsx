import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Lesson content. Raw HTML in the source is escaped (react-markdown's default)
 * and unsafe URLs are stripped, so teacher-written content can't inject script.
 */
export function Markdown({ children, className = "prose-lesson" }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {label}
            </a>
          ),
          img: ({ alt }) => <span className="text-muted">[Image: {alt || "no description"}]</span>,
          h1: ({ children: text }) => <h2>{text}</h2>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
