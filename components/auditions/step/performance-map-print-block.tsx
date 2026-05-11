"use client";

import ReactMarkdown from "react-markdown";
import type { CriticalBriefFact } from "@/lib/audition-types";

interface PerformanceSection {
  title: string;
  items: string[];
}

interface PerformanceMap {
  intro?: string;
  sections: PerformanceSection[];
  outro?: string;
}

interface PerformanceMapPrintBlockProps {
  data: PerformanceMap | null | undefined;
  /** Section heading shown above the block (e.g. "SIDES ANALYSIS"). Pass null to hide. */
  heading?: string | null;
  /** Hex/CSS color used on the heading underline + intro left-border + outro top-border. */
  accentColor?: string;
  /** Stable key prefix so React keys don't collide when two blocks render in the same parent. */
  keyPrefix?: string;
  /** Critical brief facts (director/casting non-negotiables) rendered as a highlighted
   *  block above the intro. Pass undefined or [] to skip. */
  criticalFacts?: CriticalBriefFact[] | null;
}

/**
 * Single source of truth for printing a PerformanceMap (intro → sections → outro)
 * inside the hidden print template on the audition detail page. Replaces ~3 duplicated
 * inline blocks. Used only inside the hidden print container — screen rendering uses
 * StepResultSides / StepResultBrief.
 */
export function PerformanceMapPrintBlock({
  data,
  heading = null,
  accentColor = "black",
  keyPrefix = "pm",
  criticalFacts = null,
}: PerformanceMapPrintBlockProps) {
  if (!data) return null;

  return (
    <div className="mb-12">
      {heading && (
        <div className="border-b-2 pb-2 mb-6" style={{ borderColor: accentColor }}>
          <h2 className="text-2xl font-bold text-black">{heading}</h2>
        </div>
      )}

      {criticalFacts && criticalFacts.length > 0 && (
        <div
          className="mb-10 p-6 border-2 break-inside-avoid"
          style={{ borderColor: accentColor }}
        >
          <h3 className="text-lg font-bold text-black mb-3 uppercase tracking-wide">
            Critical Facts from the Casting Brief
          </h3>
          <ul className="space-y-2">
            {criticalFacts.map((fact, i) => (
              <li
                key={`${keyPrefix}-fact-${i}`}
                className="text-black text-[15px]"
              >
                <span className="font-bold uppercase text-xs mr-2">[{fact.importance}]</span>
                <span className="font-semibold">{fact.label}:</span> {fact.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.intro && (
        <div
          className="mb-10 p-6 bg-gray-50 border-l-4 break-inside-avoid"
          style={{ borderColor: accentColor }}
        >
          <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
            <ReactMarkdown>{data.intro}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="space-y-10 mt-10">
        {data.sections?.map((sec, idx) => (
          <div key={`${keyPrefix}-sec-${idx}`} className="break-inside-avoid pt-8">
            <h3 className="text-2xl font-bold text-black border-b border-gray-300 pb-2 mb-4">
              {sec.title}
            </h3>
            <ul className="space-y-4">
              {sec.items.map((item, i) => (
                <li key={`${keyPrefix}-item-${idx}-${i}`} className="flex items-start text-black">
                  <span className="mr-4 text-black font-bold text-lg">•</span>
                  <div className="prose max-w-none prose-p:text-black prose-strong:text-black prose-p:m-0 prose-p:leading-relaxed">
                    <ReactMarkdown>{item}</ReactMarkdown>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {data.outro && (
        <div
          className="mt-12 pt-8 border-t text-center break-inside-avoid"
          style={{ borderColor: accentColor }}
        >
          <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
            <ReactMarkdown>{data.outro}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
