import React from "react";
import ReactMarkdown from "react-markdown";


export function renderMarkdown(content: string) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-[#E8721A]">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        h1: ({ children }) => (
          <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-sm font-bold">{children}</h3>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}