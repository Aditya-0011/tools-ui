import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import "@/components/folio/markdown.css";

const EXTERNAL = /^(https?:)?\/\//i;

const components: Components = {
  a: ({ href, title, children }) => {
    const external = typeof href === "string" && EXTERNAL.test(href);
    return (
      <a
        href={href}
        title={title}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer nofollow" : undefined}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt, title, width, height }) => (
    <img
      title={title}
      width={width}
      height={height}
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  ),
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [[rehypeHighlight, { detect: false }] as const];

export default function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-neutral prose-invert markdown-body max-w-none wrap-break-word",
        "prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-violet-400 prose-a:underline-offset-2 hover:prose-a:text-violet-300",
        "prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-white/10 prose-pre:bg-neutral-900",
        "prose-img:rounded-lg prose-blockquote:border-violet-500/60 prose-hr:border-white/10 prose-th:text-left",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins as never}
        components={components}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
