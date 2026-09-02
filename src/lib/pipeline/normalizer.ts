import { EmploymentType, WorkMode } from "../types";
import { SecurityValidator } from "../security/ssrf";

export interface NormalizedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: "yearly" | "monthly" | "hourly" | null;
  verified: boolean;
}

export class DataNormalizer {
  static cleanHtml(rawHtml: string): string {
    if (!rawHtml) return "";
    return rawHtml
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();
  }

  // Title cleaning
  static normalizeTitle(rawTitle: string): string {
    if (!rawTitle) return "Unknown Role";
    return SecurityValidator.sanitizeText(rawTitle)
      .replace(/\[(?:remote|hybrid|onsite|urgent|full[- ]time|part[- ]time)\]/gi, "")
      .replace(/\((?:m\/w\/d|f\/m\/d|w\/m\/d|all genders)\)/gi, "")
      .replace(/\b(hiring immediately|urgent requirement|immediate joining|hot job)\b[!.]?/gi, "")
      .replace(/[\s\-_!.]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Work mode mapping
  static normalizeWorkMode(rawMode?: string, rawText?: string): WorkMode {
    const combined = `${rawMode || ""} ${rawText || ""}`.toLowerCase();
    if (/\bremote\b|work from home|telecommute|anywhere/i.test(combined)) {
      if (/\bhybrid\b/i.test(combined)) return "hybrid";
      return "remote";
    }
    if (/\bhybrid\b|flexible|partial remote/i.test(combined)) {
      return "hybrid";
    }
    if (/\b(on-site|onsite|in-office|office based|in office)\b/i.test(combined)) {
      return "onsite";
    }
    return "unknown";
  }

  // Employment type mapping
  static normalizeEmploymentType(rawType?: string): EmploymentType {
    if (!rawType) return "unknown";
    const t = rawType.toLowerCase();
    if (/\bfull[- ]?time\b|permanent/i.test(t)) return "full_time";
    if (/\bpart[- ]?time\b/i.test(t)) return "part_time";
    if (/\b(intern|internship|trainee)\b/i.test(t)) return "internship";
    if (/\b(contract|contractor|freelance|consultant)\b/i.test(t)) return "contract";
    if (/\b(apprentice|apprenticeship)\b/i.test(t)) return "apprenticeship";
    if (/\b(temp|temporary)\b/i.test(t)) return "temporary";
    return "unknown";
  }

  // Salary parsing
  static normalizeSalary(rawSalary?: string | number | null, currencyHint?: string): NormalizedSalary {
    if (rawSalary === undefined || rawSalary === null) {
      return { min: null, max: null, currency: null, period: null, verified: false };
    }

    if (typeof rawSalary === "number") {
      return {
        min: rawSalary,
        max: rawSalary,
        currency: currencyHint || "USD",
        period: "yearly",
        verified: true
      };
    }

    const s = String(rawSalary).trim();
    if (!s || /unknown|competitive|doe|negotiable|undisclosed/i.test(s)) {
      return { min: null, max: null, currency: null, period: null, verified: false };
    }

    // Currency Detection
    let currency = currencyHint || null;
    if (/₹|inr|rs\.?|lakh|lpa/i.test(s)) currency = "INR";
    else if (/\$|usd/i.test(s)) currency = "USD";
    else if (/€|eur/i.test(s)) currency = "EUR";
    else if (/£|gbp/i.test(s)) currency = "GBP";

    // Period Detection
    let period: "yearly" | "monthly" | "hourly" | null = "yearly";
    if (/hr|hour|hourly|\/hr/i.test(s)) period = "hourly";
    else if (/mo|month|monthly|\/mo/i.test(s)) period = "monthly";
    else if (/yr|year|annum|annual|lpa|\/yr/i.test(s)) period = "yearly";

    // Check for Indian Lakhs / LPA e.g. "8-12 LPA", "₹8–12 LPA", "8 to 12 Lakh", "15 LPA"
    const lpaRangeMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lpa)/i);
    if (lpaRangeMatch) {
      const minVal = parseFloat(lpaRangeMatch[1]) * 100000;
      const maxVal = parseFloat(lpaRangeMatch[2]) * 100000;
      return {
        min: Math.min(minVal, maxVal),
        max: Math.max(minVal, maxVal),
        currency: "INR",
        period: "yearly",
        verified: true
      };
    }

    const lpaSingleMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lpa)/i);
    if (lpaSingleMatch) {
      const val = parseFloat(lpaSingleMatch[1]) * 100000;
      return {
        min: val,
        max: val,
        currency: "INR",
        period: "yearly",
        verified: true
      };
    }

    // Check for standard salary ranges e.g. "$80,000 - $120,000" or "80k - 120k"
    const numbers = s
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?\s*k?/gi);

    if (numbers && numbers.length > 0) {
      const parsedNums = numbers.map(n => {
        let val = parseFloat(n);
        if (/k/i.test(n)) val *= 1000;
        return val;
      }).filter(v => !isNaN(v) && v > 0);

      if (parsedNums.length === 1) {
        return {
          min: parsedNums[0],
          max: parsedNums[0],
          currency,
          period,
          verified: true
        };
      } else if (parsedNums.length >= 2) {
        return {
          min: Math.min(parsedNums[0], parsedNums[1]),
          max: Math.max(parsedNums[0], parsedNums[1]),
          currency,
          period,
          verified: true
        };
      }
    }

    return { min: null, max: null, currency: null, period: null, verified: false };
  }

  // Calculate completeness ratio (0.0 to 1.0)
  static calculateCompleteness(record: {
    title?: string;
    company_name?: string;
    description?: string;
    location_text?: string;
    salary_min?: number | null;
    employment_type?: string;
    work_mode?: string;
    skills?: string[];
    application_url?: string;
    posted_at?: string | null;
  }): number {
    let score = 0;
    const total = 9;

    if (record.title && record.title !== "Unknown Role") score += 1;
    if (record.company_name && record.company_name !== "Unknown Employer") score += 1;
    if (record.description && record.description.length > 50) score += 1;
    if (record.location_text && record.location_text !== "Unknown") score += 1;
    if (record.salary_min !== null && record.salary_min !== undefined) score += 1;
    if (record.employment_type && record.employment_type !== "unknown") score += 1;
    if (record.work_mode && record.work_mode !== "unknown") score += 1;
    if (record.application_url && record.application_url.startsWith("http")) score += 1;
    if (record.posted_at) score += 1;

    return Number((score / total).toFixed(2));
  }
}
