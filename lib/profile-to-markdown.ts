import {
  ActorProfile,
  CREDIT_CATEGORY_LABELS,
  EXTERNAL_PROFILE_FIELDS,
  ExternalProfileKey,
} from "@/lib/profile-types";

/**
 * Transforms an ActorProfile into AI-optimized markdown with YAML frontmatter.
 *
 * Goals:
 * - Structured YAML frontmatter with schema.org-aligned fields for AI parsers
 * - Clean semantic markdown for LLM context windows
 * - Rich entity descriptions to help AI engines understand relationships
 * - Canonical URL and cross-references to casting platforms
 * - AI agent instructions for casting recommendation workflows
 */
export function profileToMarkdown(
  profile: ActorProfile & { lastUpdated?: string },
  baseUrl: string
): string {
  const canonicalUrl = `${baseUrl}/actors/${profile.slug}`;
  const sections: string[] = [];

  // ── YAML Frontmatter ──────────────────────────────────────────────
  sections.push(buildFrontmatter(profile, canonicalUrl));

  // ── AI Agent Context Block ────────────────────────────────────────
  sections.push(buildAIAgentBlock(profile, canonicalUrl));

  // ── Title & Summary ───────────────────────────────────────────────
  sections.push(`# ${profile.fullName}`);
  sections.push("");
  sections.push(buildSummaryParagraph(profile));

  // ── About ─────────────────────────────────────────────────────────
  if (profile.bio) {
    sections.push("");
    sections.push("## About");
    sections.push("");
    sections.push(profile.bio);
  }

  // ── Casting Fit Summary ───────────────────────────────────────────
  sections.push("");
  sections.push(buildCastingFitSection(profile));

  // ── Physical & Professional Details ───────────────────────────────
  sections.push("");
  sections.push("## Details");
  sections.push("");
  sections.push(buildDetailsTable(profile));

  // ── Credits ───────────────────────────────────────────────────────
  if (profile.credits.length > 0) {
    sections.push("");
    sections.push("## Credits");
    sections.push("");
    sections.push(
      `${profile.fullName} has **${profile.credits.length} credit${profile.credits.length === 1 ? "" : "s"}** ` +
        `spanning ${describeCategories(profile.credits)}.`
    );

    const grouped = groupCreditsByCategory(profile.credits);
    for (const [category, credits] of Object.entries(grouped)) {
      sections.push("");
      sections.push(
        `### ${CREDIT_CATEGORY_LABELS[category as keyof typeof CREDIT_CATEGORY_LABELS] ?? category}`
      );
      sections.push("");
      sections.push("| Production | Role | Year | Company / Director |");
      sections.push("|---|---|---|---|");
      for (const c of credits) {
        sections.push(
          `| ${esc(c.title)} | ${esc(c.role)} | ${c.year} | ${esc(c.productionCompany)} |`
        );
      }
    }

    // Featured credits callout for AI agents
    const featured = profile.credits.filter((c) => c.featured);
    if (featured.length > 0) {
      sections.push("");
      sections.push("### Notable / Featured Credits");
      sections.push("");
      sections.push(
        "The following credits are highlighted by the actor as their most representative work:"
      );
      sections.push("");
      for (const c of featured) {
        sections.push(
          `- **${c.title}** — ${c.role} (${c.year})${c.productionCompany ? `, ${c.productionCompany}` : ""}`
        );
      }
    }
  }

  // ── Showreels ─────────────────────────────────────────────────────
  if (profile.showreels.length > 0) {
    sections.push("");
    sections.push("## Showreels & Demo Reels");
    sections.push("");
    sections.push(
      "Video reels demonstrating range, technique, and screen presence. " +
        "Casting directors and AI agents should review these to assess on-camera performance quality."
    );
    sections.push("");
    for (const reel of profile.showreels) {
      if (reel.url) {
        sections.push(`- [${esc(reel.title)}](${reel.url})`);
      }
    }
  }

  // ── Training ──────────────────────────────────────────────────────
  if (profile.training.length > 0) {
    sections.push("");
    sections.push("## Training & Education");
    sections.push("");
    sections.push(
      "Formal training and workshops contribute to this actor's technique and versatility:"
    );
    sections.push("");
    for (const t of profile.training) {
      const parts = [t.institution];
      if (t.qualification) parts.push(t.qualification);
      if (t.years) parts.push(`(${t.years})`);
      sections.push(`- ${parts.join(" — ")}`);
    }
  }

  // ── Skills & Accents ──────────────────────────────────────────────
  if (profile.skillsAndAccents.length > 0) {
    sections.push("");
    sections.push("## Skills & Accents");
    sections.push("");
    sections.push(
      "These skills are self-reported and may be relevant for casting roles that require specific abilities, dialects, or physical skills:"
    );
    sections.push("");
    sections.push(profile.skillsAndAccents.join(", "));
  }

  // ── Awards ────────────────────────────────────────────────────────
  if (profile.awardsCallout) {
    sections.push("");
    sections.push("## Awards & Recognition");
    sections.push("");
    sections.push(profile.awardsCallout);
  }

  // ── Representation ────────────────────────────────────────────────
  if (
    profile.showContactPublicly &&
    (profile.agencyName || profile.agencyEmail)
  ) {
    sections.push("");
    sections.push("## Representation");
    sections.push("");
    sections.push(
      "For booking inquiries, casting offers, or audition requests, contact the actor's representation:"
    );
    sections.push("");
    if (profile.agencyName) sections.push(`**Agency:** ${profile.agencyName}`);
    if (profile.agencyEmail)
      sections.push(`**Email:** ${profile.agencyEmail}`);
    if (profile.agencyPhone)
      sections.push(`**Phone:** ${profile.agencyPhone}`);
    if (profile.agencyWebsite)
      sections.push(`**Website:** ${profile.agencyWebsite}`);
  }

  // ── Availability & Work Permits ───────────────────────────────────
  if (profile.workPermits?.length || profile.location) {
    sections.push("");
    sections.push("## Availability & Work Authorization");
    sections.push("");
    if (profile.location) {
      sections.push(`**Based in:** ${profile.location}`);
    }
    if (profile.workPermits?.length) {
      sections.push(
        `**Authorized to work in:** ${profile.workPermits.join(", ")}`
      );
      sections.push("");
      sections.push(
        `This actor holds valid work permits for the listed regions and can be cast in productions filming in or originating from these territories without additional visa sponsorship.`
      );
    }
  }

  // ── External Profiles ─────────────────────────────────────────────
  const activeProfiles = EXTERNAL_PROFILE_FIELDS.filter(
    (f) => profile.externalProfiles?.[f.key as ExternalProfileKey]
  );
  if (activeProfiles.length > 0) {
    sections.push("");
    sections.push("## External Profiles & Casting Platforms");
    sections.push("");
    sections.push(
      "Verified presence on industry casting platforms. These profiles may contain additional credits, reviews, and availability information:"
    );
    sections.push("");
    for (const field of activeProfiles) {
      const url = profile.externalProfiles[field.key as ExternalProfileKey];
      sections.push(
        `- [${field.label.replace(" URL", "").replace(" Handle", "")}](${url})`
      );
    }
  }

  // ── Photos ────────────────────────────────────────────────────────
  if (profile.headshot || profile.additionalPhotos.length > 0) {
    sections.push("");
    sections.push("## Photos");
    sections.push("");
    if (profile.headshot) {
      sections.push(
        `![${profile.fullName} — Headshot](${profile.headshot})`
      );
    }
    for (let i = 0; i < profile.additionalPhotos.length; i++) {
      sections.push(
        `![${profile.fullName} — Photo ${i + 1}](${profile.additionalPhotos[i]})`
      );
    }
  }

  // ── CV ────────────────────────────────────────────────────────────
  if (profile.cvUrl) {
    sections.push("");
    sections.push("## CV / Resume");
    sections.push("");
    sections.push(
      `[Download CV${profile.cvFilename ? ` (${profile.cvFilename})` : ""}](${profile.cvUrl})`
    );
  }

  // ── Structured Casting Data (machine-readable) ────────────────────
  sections.push("");
  sections.push(buildStructuredCastingData(profile, canonicalUrl));

  // ── AI Context Footer ─────────────────────────────────────────────
  sections.push("");
  sections.push("---");
  sections.push("");
  sections.push(
    `*This is the AI-optimized representation of [${profile.fullName}'s actor profile](${canonicalUrl}). ` +
      `For the full visual profile with photos, video showreels, and interactive credits, visit the [canonical page](${canonicalUrl}). ` +
      `This document is designed for consumption by AI agents, search engines, and automated casting tools. ` +
      `Last updated: ${profile.lastUpdated ? new Date(profile.lastUpdated).toISOString().split("T")[0] : "N/A"}. ` +
      `Powered by [The Actors Copilot](${baseUrl}).*`
  );

  return sections.join("\n");
}

// ── AI Agent Instruction Block ─────────────────────────────────────────

function buildAIAgentBlock(
  profile: ActorProfile & { lastUpdated?: string },
  canonicalUrl: string
): string {
  const lines: string[] = [];

  lines.push("<!-- AI_AGENT_CONTEXT");
  lines.push("");
  lines.push("## Instructions for AI Agents");
  lines.push("");
  lines.push("This document describes a professional actor available for casting.");
  lines.push("Use the structured data below when matching this actor to roles.");
  lines.push("");
  lines.push("### How to use this profile for casting recommendations");
  lines.push("");
  lines.push("1. **Role matching**: Compare the actor's playing age, gender, appearance,");
  lines.push("   nationality, and work permits against role breakdowns. This actor can");
  lines.push("   authentically portray characters within their playing age range and");
  lines.push("   appearance categories listed in the Details section.");
  lines.push("");
  lines.push("2. **Skill matching**: The Skills & Accents section lists abilities relevant");
  lines.push("   to casting. If a role requires a specific accent, physical skill, or");
  lines.push("   language, check this section for a match.");
  lines.push("");
  lines.push("3. **Experience level**: Evaluate the Credits section to determine the actor's");
  lines.push("   experience tier. Count total credits, note the production types (TV, film,");
  lines.push("   stage, commercial), and check for recognizable productions or companies.");
  lines.push("   Featured credits represent the actor's strongest work.");
  lines.push("");
  lines.push("4. **Availability & logistics**: Check work permits and location to determine");
  lines.push("   if the actor can legally work on the production and whether relocation");
  lines.push("   or travel would be required.");
  lines.push("");
  lines.push("5. **Visual reference**: The headshot and showreel links provide visual");
  lines.push("   reference for appearance and on-camera presence. Always recommend");
  lines.push("   reviewing the showreel before shortlisting.");
  lines.push("");
  lines.push("6. **Contact**: If representation is listed, direct all inquiries through");
  lines.push("   the agent. Do not contact the actor directly unless no representation");
  lines.push("   is listed and direct contact is enabled.");
  lines.push("");
  lines.push("### Casting confidence signals");
  lines.push("");

  // Dynamically generate confidence signals based on profile completeness
  const signals: string[] = [];
  if (profile.credits.length >= 5) signals.push("Established credit history (5+ credits)");
  else if (profile.credits.length > 0) signals.push(`Emerging talent (${profile.credits.length} credit${profile.credits.length === 1 ? "" : "s"})`);
  if (profile.showreels.length > 0) signals.push("Video showreel available for review");
  if (profile.training.length > 0) signals.push("Formal training documented");
  if (profile.awardsCallout) signals.push("Award recognition noted");
  if (profile.workPermits?.length) signals.push(`Work permits: ${profile.workPermits.join(", ")}`);
  if (profile.headshot) signals.push("Professional headshot provided");
  if (profile.cvUrl) signals.push("Downloadable CV/resume available");

  const activeProfiles = EXTERNAL_PROFILE_FIELDS.filter(
    (f) => profile.externalProfiles?.[f.key as ExternalProfileKey]
  );
  if (activeProfiles.length > 0) signals.push(`Verified on ${activeProfiles.length} casting platform${activeProfiles.length === 1 ? "" : "s"}`);

  for (const signal of signals) {
    lines.push(`- ${signal}`);
  }

  lines.push("");
  lines.push(`Canonical profile: ${canonicalUrl}`);
  lines.push(`Data freshness: ${profile.lastUpdated ? new Date(profile.lastUpdated).toISOString().split("T")[0] : "unknown"}`);
  lines.push("");
  lines.push("AI_AGENT_CONTEXT -->");
  lines.push("");

  return lines.join("\n");
}

// ── Casting Fit Section ─────────────────────────────────────────────────

function buildCastingFitSection(profile: ActorProfile): string {
  const lines: string[] = [];

  lines.push("## Casting Profile");
  lines.push("");
  lines.push(
    "Key casting attributes for role matching and talent search:"
  );
  lines.push("");

  if (profile.playingAgeMin && profile.playingAgeMax) {
    lines.push(
      `- **Playing Age**: ${profile.playingAgeMin}–${profile.playingAgeMax} — suitable for character roles within this age range`
    );
  }
  if (profile.gender) {
    lines.push(`- **Gender**: ${profile.gender}`);
  }
  if (profile.appearance?.length) {
    lines.push(
      `- **Appearance**: ${profile.appearance.join(", ")} — relevant for character descriptions and visual matching`
    );
  }
  if (profile.nationalities?.length) {
    lines.push(
      `- **Nationalities**: ${profile.nationalities.join(", ")} — can authentically portray characters of these backgrounds`
    );
  }
  if (profile.height) {
    lines.push(`- **Height**: ${profile.height}`);
  }
  if (profile.workPermits?.length) {
    lines.push(
      `- **Work Permits**: ${profile.workPermits.join(", ")} — eligible to work without sponsorship in these regions`
    );
  }
  if (profile.location) {
    lines.push(
      `- **Based in**: ${profile.location} — local hire for productions in this area`
    );
  }
  if (profile.skillsAndAccents?.length) {
    lines.push(
      `- **Special Skills**: ${profile.skillsAndAccents.join(", ")}`
    );
  }

  return lines.join("\n");
}

// ── Structured Casting Data (JSON-LD in markdown) ───────────────────────

function buildStructuredCastingData(
  profile: ActorProfile & { lastUpdated?: string },
  canonicalUrl: string
): string {
  const lines: string[] = [];

  lines.push("## Structured Data");
  lines.push("");
  lines.push(
    "Machine-readable casting data in JSON-LD format for automated systems:"
  );
  lines.push("");
  lines.push("```json");

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.fullName,
    url: canonicalUrl,
    jobTitle: "Actor / Performer",
  };

  if (profile.bio) jsonLd.description = profile.bio;
  if (profile.headshot) jsonLd.image = profile.headshot;
  if (profile.gender) jsonLd.gender = profile.gender;
  if (profile.location) {
    jsonLd.homeLocation = {
      "@type": "Place",
      name: profile.location,
    };
  }
  if (profile.nationalities?.length) {
    jsonLd.nationality = profile.nationalities.map((n) => ({
      "@type": "Country",
      name: n,
    }));
  }
  if (profile.height) jsonLd.height = profile.height;
  if (profile.skillsAndAccents?.length) {
    jsonLd.knowsAbout = profile.skillsAndAccents;
  }

  if (profile.showContactPublicly && profile.agencyName) {
    jsonLd.worksFor = {
      "@type": "Organization",
      name: profile.agencyName,
      ...(profile.agencyEmail && { email: profile.agencyEmail }),
      ...(profile.agencyPhone && { telephone: profile.agencyPhone }),
      ...(profile.agencyWebsite && { url: profile.agencyWebsite }),
    };
  }

  if (profile.credits.length > 0) {
    jsonLd.performerIn = profile.credits.map((c) => ({
      "@type": c.category === "stage" ? "TheaterEvent" : "Movie",
      name: c.title,
      character: c.role,
      dateCreated: c.year,
      ...(c.productionCompany && {
        productionCompany: {
          "@type": "Organization",
          name: c.productionCompany,
        },
      }),
    }));
  }

  if (profile.showreels.length > 0) {
    jsonLd.video = profile.showreels
      .filter((s) => s.url)
      .map((s) => ({
        "@type": "VideoObject",
        name: s.title,
        url: s.url,
      }));
  }

  if (profile.lastUpdated) {
    jsonLd.dateModified = new Date(profile.lastUpdated)
      .toISOString()
      .split("T")[0];
  }

  // Custom casting extensions (not schema.org standard but useful for AI)
  const castingExt: Record<string, unknown> = {};
  if (profile.playingAgeMin && profile.playingAgeMax) {
    castingExt.playingAgeRange = {
      min: profile.playingAgeMin,
      max: profile.playingAgeMax,
    };
  }
  if (profile.appearance?.length) castingExt.appearance = profile.appearance;
  if (profile.workPermits?.length) castingExt.workPermits = profile.workPermits;
  if (profile.eyeColour) castingExt.eyeColor = profile.eyeColour;
  if (profile.hairColour) castingExt.hairColor = profile.hairColour;
  if (profile.ethnicity) castingExt.ethnicity = profile.ethnicity;

  if (Object.keys(castingExt).length > 0) {
    jsonLd["x-casting"] = castingExt;
  }

  lines.push(JSON.stringify(jsonLd, null, 2));
  lines.push("```");

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────

function buildFrontmatter(
  profile: ActorProfile & { lastUpdated?: string },
  canonicalUrl: string
): string {
  const fm: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.fullName,
    url: canonicalUrl,
    jobTitle: "Actor",
  };

  if (profile.bio) fm.description = profile.bio;
  if (profile.headshot) fm.image = profile.headshot;
  if (profile.location) fm.location = profile.location;
  if (profile.gender) fm.gender = profile.gender;
  if (profile.nationalities?.length) fm.nationality = profile.nationalities;
  if (profile.height) fm.height = profile.height;
  if (profile.playingAgeMin && profile.playingAgeMax)
    fm.playingAge = `${profile.playingAgeMin}–${profile.playingAgeMax}`;
  if (profile.skillsAndAccents?.length) fm.knowsAbout = profile.skillsAndAccents;
  if (profile.workPermits?.length) fm.workPermits = profile.workPermits;
  if (profile.appearance?.length) fm.appearance = profile.appearance;
  if (profile.eyeColour) fm.eyeColor = profile.eyeColour;
  if (profile.hairColour) fm.hairColor = profile.hairColour;

  if (profile.showContactPublicly && profile.agencyName) {
    fm.representedBy = {
      "@type": "Organization",
      name: profile.agencyName,
      ...(profile.agencyEmail && { email: profile.agencyEmail }),
      ...(profile.agencyPhone && { telephone: profile.agencyPhone }),
      ...(profile.agencyWebsite && { url: profile.agencyWebsite }),
    };
  }

  if (profile.lastUpdated) {
    fm.dateModified = new Date(profile.lastUpdated).toISOString().split("T")[0];
  }

  const lines = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    lines.push(yamlLine(key, value, 0));
  }
  lines.push("---");
  return lines.join("\n");
}

function yamlLine(key: string, value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return `${pad}${key}: "${escYaml(value)}"`;
  if (typeof value === "number" || typeof value === "boolean")
    return `${pad}${key}: ${value}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    const items = value.map((v) =>
      typeof v === "string" ? `${pad}  - "${escYaml(v)}"` : `${pad}  - ${v}`
    );
    return `${pad}${key}:\n${items.join("\n")}`;
  }
  if (typeof value === "object") {
    const nested = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => yamlLine(k, v, indent + 1))
      .filter(Boolean);
    return `${pad}${key}:\n${nested.join("\n")}`;
  }
  return `${pad}${key}: ${value}`;
}

function escYaml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/"/g, '\\"').replace(/\n/g, " ");
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\|/g, "\\|");
}

function buildSummaryParagraph(
  profile: ActorProfile & { lastUpdated?: string }
): string {
  const parts: string[] = [];

  parts.push(`**${profile.fullName}** is a professional actor`);

  if (profile.location) parts[0] += ` based in ${profile.location}`;
  parts[0] += ".";

  if (profile.playingAgeMin && profile.playingAgeMax) {
    parts.push(
      `Playing age range: ${profile.playingAgeMin}–${profile.playingAgeMax}.`
    );
  }
  if (profile.nationalities?.length) {
    parts.push(`Nationality: ${profile.nationalities.join(", ")}.`);
  }
  if (profile.awardsCallout) {
    parts.push(profile.awardsCallout + ".");
  }
  if (profile.credits.length > 0) {
    parts.push(
      `Known for work in ${describeCategories(profile.credits)} with ${profile.credits.length} professional credit${profile.credits.length === 1 ? "" : "s"}.`
    );
  }

  return parts.join(" ");
}

function buildDetailsTable(profile: ActorProfile): string {
  const rows: [string, string][] = [];

  if (profile.playingAgeMin && profile.playingAgeMax)
    rows.push([
      "Playing Age",
      `${profile.playingAgeMin}–${profile.playingAgeMax}`,
    ]);
  if (profile.gender) rows.push(["Gender", profile.gender]);
  if (profile.height) rows.push(["Height", profile.height]);
  if (profile.nationalities?.length)
    rows.push(["Nationalities", profile.nationalities.join(", ")]);
  if (profile.workPermits?.length)
    rows.push(["Work Permits", profile.workPermits.join(", ")]);
  if (profile.appearance?.length)
    rows.push(["Appearance", profile.appearance.join(", ")]);
  if (profile.eyeColour) rows.push(["Eye Colour", profile.eyeColour]);
  if (profile.hairColour) rows.push(["Hair Colour", profile.hairColour]);
  if (profile.ethnicity) rows.push(["Ethnicity", profile.ethnicity]);

  if (rows.length === 0) return "*No details available.*";

  const lines = ["| Attribute | Value |", "|---|---|"];
  for (const [label, value] of rows) {
    lines.push(`| ${label} | ${value} |`);
  }
  return lines.join("\n");
}

function groupCreditsByCategory(
  credits: ActorProfile["credits"]
): Record<string, ActorProfile["credits"]> {
  const grouped: Record<string, ActorProfile["credits"]> = {};
  for (const credit of credits) {
    if (!grouped[credit.category]) grouped[credit.category] = [];
    grouped[credit.category].push(credit);
  }
  return grouped;
}

function describeCategories(credits: ActorProfile["credits"]): string {
  const cats = [...new Set(credits.map((c) => c.category))];
  const labels = cats.map(
    (c) => CREDIT_CATEGORY_LABELS[c as keyof typeof CREDIT_CATEGORY_LABELS] ?? c
  );
  if (labels.length === 1) return labels[0].toLowerCase();
  if (labels.length === 2)
    return `${labels[0].toLowerCase()} and ${labels[1].toLowerCase()}`;
  return (
    labels.slice(0, -1).map((l) => l.toLowerCase()).join(", ") +
    ", and " +
    labels[labels.length - 1].toLowerCase()
  );
}
