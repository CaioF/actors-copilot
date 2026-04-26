"use client";

import ReactMarkdown from "react-markdown";

export function renderMarkdown(content: string): React.ReactNode {
  if (content === "") return <></>;
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
