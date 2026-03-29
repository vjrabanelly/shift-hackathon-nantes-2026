import { createHash } from "node:crypto";

import { JobOfferNormalized, JobOfferRaw } from "../types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "from",
  "that",
  "this",
  "will",
  "are",
  "our",
  "des",
  "les",
  "une",
  "pour",
  "avec",
  "dans",
  "sur",
  "par",
  "job",
  "role",
  "company",
  "must",
  "have",
  "nice",
  "preferred",
  "required",
  "years",
  "year",
  "experience",
  "full",
  "time",
  "hybrid",
  "remote",
  "onsite"
]);

export class JobOfferNormalizer {
  normalize(raw: JobOfferRaw): JobOfferNormalized {
    const rawFields = raw.raw_fields ?? {};
    const title = rawFields.title ?? this.extractTitle(raw.raw_text);
    const company = rawFields.company ?? this.extractCompany(raw.raw_text);
    const location = rawFields.location ?? "Unknown";
    const employmentType = this.normalizeEmploymentType(
      rawFields.employment_type ?? "full_time"
    );
    const lines = this.toLines(raw.raw_text);
    const requirements = lines.filter((line) =>
      /(must|require|experience|skill|competence|maitrise|years|ans)/i.test(line)
    );
    const responsibilities = lines.filter((line) =>
      /(lead|build|ship|own|manage|design|collaborate|deliver|create|improve)/i.test(
        line
      )
    );

    const exclusionKeywords = new Set(
      this.extractKeywords([company, location, rawFields.employment_type ?? ""])
    );
    const keywords = this.extractKeywords([
      title,
      raw.raw_text,
      ...requirements,
      ...responsibilities
    ]).filter((keyword) => !exclusionKeywords.has(keyword));
    const tools = keywords.filter((keyword) =>
      /(figma|notion|jira|excel|sql|python|react|typescript|photoshop|sketch)/i.test(
        keyword
      )
    );
    const languages = keywords.filter((keyword) =>
      /(english|french|francais|fran[cç]ais|german|spanish)/i.test(keyword)
    );
    const yearsExperience = this.extractYearsExperience(raw.raw_text);

    return {
      job_id: this.buildJobId(raw.source_url, raw.raw_text),
      source: raw.source,
      source_url: raw.source_url,
      title,
      company,
      location,
      remote_mode: this.extractRemoteMode(raw.raw_text),
      employment_type: employmentType,
      seniority: this.extractSeniority(title + " " + raw.raw_text),
      job_summary: lines.slice(0, 3).join(" ").slice(0, 320),
      responsibilities: responsibilities.slice(0, 6),
      requirements_must_have: requirements.slice(0, 6),
      requirements_nice_to_have: lines
        .filter((line) => /(nice to have|plus|bonus|preferred)/i.test(line))
        .slice(0, 4),
      keywords: keywords.slice(0, 12),
      tools: tools.slice(0, 8),
      languages: languages.slice(0, 4),
      years_experience_min: yearsExperience
    };
  }

  private buildJobId(sourceUrl: string, rawText: string): string {
    const hash = createHash("sha1")
      .update(sourceUrl + rawText.slice(0, 200))
      .digest("hex")
      .slice(0, 10);
    return `job_${hash}`;
  }

  private toLines(text: string): string[] {
    return text
      .split(/\r?\n|[.;]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 10);
  }

  private extractTitle(text: string): string {
    const firstLine = this.toLines(text)[0];
    return firstLine || "Untitled role";
  }

  private extractCompany(text: string): string {
    const match = text.match(/company[:\s]+([^\n]+)/i);
    return match?.[1]?.trim() || "Unknown company";
  }

  private normalizeEmploymentType(value: string): string {
    if (/part/i.test(value)) {
      return "part_time";
    }
    if (/contract|freelance/i.test(value)) {
      return "contract";
    }
    if (/intern/i.test(value)) {
      return "internship";
    }
    return "full_time";
  }

  private extractRemoteMode(text: string): string {
    if (/hybrid/i.test(text)) {
      return "hybrid";
    }
    if (/remote/i.test(text)) {
      return "remote";
    }
    return "onsite";
  }

  private extractSeniority(text: string): string {
    if (/lead|principal|staff/i.test(text)) {
      return "lead";
    }
    if (/senior/i.test(text)) {
      return "senior";
    }
    if (/junior|entry/i.test(text)) {
      return "junior";
    }
    return "mid";
  }

  private extractYearsExperience(text: string): number {
    const match = text.match(/(\d+)\+?\s*(years|year|ans|an)/i);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  private extractKeywords(parts: string[]): string[] {
    const unique = new Set<string>();
    const words = parts.join(" ").match(/[A-Za-z][A-Za-z0-9+#.-]{2,}/g) ?? [];

    for (const word of words) {
      const normalized = word
        .toLowerCase()
        .replace(/^[^a-z0-9+#]+/i, "")
        .replace(/[^a-z0-9+#]+$/i, "");
      if (normalized.length < 3) {
        continue;
      }
      if (STOPWORDS.has(normalized)) {
        continue;
      }
      unique.add(normalized);
    }

    return [...unique];
  }
}
