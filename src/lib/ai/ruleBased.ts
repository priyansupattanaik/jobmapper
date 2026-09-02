import { AIProvider, AIClassificationResult, ParsedSearchIntent } from "./provider";
import { CONTROLLED_TAXONOMY, CATEGORY_NAMES } from "./taxonomy";
import { ExperienceLevel } from "../types";

export class RuleBasedAIProvider implements AIProvider {
  name = "rule_based";
  model = "jobmapper-rule-matcher";
  version = "1.0.0";

  async classifyJob(job: {
    title: string;
    description: string;
    requirements?: string[];
  }): Promise<AIClassificationResult> {
    const textToAnalyze = `${job.title} ${job.description} ${(job.requirements || []).join(" ")}`.toLowerCase();
    const titleLower = job.title.toLowerCase();

    // 1. Determine Experience Level
    let experienceLevel: ExperienceLevel = "unknown";
    if (/\b(intern|internship|trainee|apprentice)\b/i.test(titleLower)) {
      experienceLevel = "internship";
    } else if (/\b(fresher|fresh graduate|entry level|junior|associate|grad)\b/i.test(titleLower)) {
      experienceLevel = "entry_level";
    } else if (/\b(principal|director|vp|head of|chief|c-level|executive|founder)\b/i.test(titleLower)) {
      experienceLevel = "executive";
    } else if (/\b(senior|sr\.|lead|staff|architect|manager)\b/i.test(titleLower)) {
      experienceLevel = "senior";
    } else if (/\b(mid|intermediate)\b/i.test(titleLower)) {
      experienceLevel = "mid_level";
    } else if (/\b([0-2]\s*(\+|-)\s*years?|0 to 2 years?)\b/i.test(textToAnalyze)) {
      experienceLevel = "entry_level";
    } else if (/\b([3-6]\s*(\+|-)\s*years?)\b/i.test(textToAnalyze)) {
      experienceLevel = "mid_level";
    } else if (/\b([7-9]|1[0-9])\s*(\+|-)\s*years?\b/i.test(textToAnalyze)) {
      experienceLevel = "senior";
    }

    // 2. Score Categories based on Taxonomy Keywords
    let bestCategory = "Other";
    let bestSubcategory = "General";
    let highestScore = 0;

    for (const [catName, def] of Object.entries(CONTROLLED_TAXONOMY)) {
      let score = 0;
      // High weight for title matches
      for (const kw of def.keywords) {
        if (titleLower.includes(kw)) score += 5;
        if (textToAnalyze.includes(kw)) score += 1;
      }
      for (const skill of def.commonSkills) {
        const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
        if (regex.test(textToAnalyze)) score += 2;
      }
      if (score > highestScore) {
        highestScore = score;
        bestCategory = catName;
        bestSubcategory = def.subcategories[0] || "General";
      }
    }

    // Determine subcategory if Software & Engineering or Data & AI
    if (bestCategory === "Software & Engineering") {
      if (/\b(frontend|react|vue|angular|css|html)\b/i.test(titleLower)) bestSubcategory = "Frontend Engineering";
      else if (/\b(backend|node|go|python|java|api|database)\b/i.test(titleLower)) bestSubcategory = "Backend Engineering";
      else if (/\b(full\s*stack|fullstack)\b/i.test(titleLower)) bestSubcategory = "Full Stack Engineering";
      else if (/\b(mobile|ios|android|swift|flutter)\b/i.test(titleLower)) bestSubcategory = "Mobile Development";
      else if (/\b(devops|cloud|sre|infrastructure|kubernetes|aws)\b/i.test(titleLower)) bestSubcategory = "DevOps & Cloud";
      else if (/\b(qa|test|quality assurance|automation)\b/i.test(titleLower)) bestSubcategory = "QA & Testing";
    } else if (bestCategory === "Data & AI") {
      if (/\b(machine learning|ml|deep learning|computer vision|nlp)\b/i.test(titleLower)) bestSubcategory = "Machine Learning Engineering";
      else if (/\b(data engineer|pipeline|etl|spark|dbt)\b/i.test(titleLower)) bestSubcategory = "Data Engineering";
      else if (/\b(data scientist|research scientist)\b/i.test(titleLower)) bestSubcategory = "Data Science";
      else if (/\b(analyst|analytics|bi|power bi|tableau)\b/i.test(titleLower)) bestSubcategory = "Data Analysis";
    }

    // 3. Extract Extracted Skills (Real skills found in description)
    const allSkills = Object.values(CONTROLLED_TAXONOMY).flatMap(c => c.commonSkills);
    const matchedSkills = new Set<string>();
    for (const skill of allSkills) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
      if (regex.test(textToAnalyze)) {
        matchedSkills.add(skill);
      }
    }

    const confidence = highestScore > 10 ? 0.95 : (highestScore > 4 ? 0.85 : 0.65);

    return {
      category: bestCategory,
      subcategory: bestSubcategory,
      skills: Array.from(matchedSkills).slice(0, 15),
      experience_level: experienceLevel,
      confidence,
      model: this.model,
      version: this.version
    };
  }

  async parseSearchIntent(query: string): Promise<ParsedSearchIntent> {
    const q = query.trim().toLowerCase();
    const intent: ParsedSearchIntent = {
      keywords: [],
      location: null,
      radius_km: null,
      work_mode: [],
      employment_type: [],
      experience_level: [],
      category: null,
      salary_min: null,
      salary_currency: null
    };

    // Radius detection e.g. "within 10 km", "within 25km", "within 5 miles"
    const radiusMatch = q.match(/within\s+(\d+)\s*(km|kms|kilometers|miles|mi)?/i);
    if (radiusMatch) {
      let r = parseInt(radiusMatch[1], 10);
      if (radiusMatch[2] && (radiusMatch[2] === "miles" || radiusMatch[2] === "mi")) {
        r = Math.round(r * 1.60934);
      }
      intent.radius_km = r;
    }

    // Location detection e.g. "in Mumbai", "near Pune", "in New York", "in London"
    const locMatch = q.match(/\b(in|near|around)\s+([a-zA-Z\s]+?)(?=\s+(within|paying|with|remote|hybrid|full[- ]time|$))/i);
    if (locMatch && locMatch[2].trim()) {
      const detected = locMatch[2].trim();
      if (!["the", "a", "an"].includes(detected.toLowerCase())) {
        intent.location = detected;
      }
    }

    // Work Mode
    if (/\bremote\b/i.test(q)) intent.work_mode.push("remote");
    if (/\bhybrid\b/i.test(q)) intent.work_mode.push("hybrid");
    if (/\b(onsite|on-site|in-office)\b/i.test(q)) intent.work_mode.push("onsite");

    // Employment Type
    if (/\bfull[- ]time\b/i.test(q)) intent.employment_type.push("full_time");
    if (/\bpart[- ]time\b/i.test(q)) intent.employment_type.push("part_time");
    if (/\b(internship|intern)\b/i.test(q)) intent.employment_type.push("internship");
    if (/\bcontract\b/i.test(q)) intent.employment_type.push("contract");
    if (/\bapprenticeship\b/i.test(q)) intent.employment_type.push("apprenticeship");

    // Experience Level
    if (/\b(entry[- ]level|fresher|junior)\b/i.test(q)) intent.experience_level.push("entry_level");
    if (/\b(senior|lead|principal)\b/i.test(q)) intent.experience_level.push("senior");
    if (/\b(mid[- ]level|intermediate)\b/i.test(q)) intent.experience_level.push("mid_level");

    // Salary e.g. "paying above 8 lakh", "above ₹800,000", "over $90k", "above 50000"
    const lakhMatch = q.match(/(?:paying|above|over|more than|salary)\s+(?:₹|inr|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lpa)/i);
    if (lakhMatch) {
      intent.salary_min = parseFloat(lakhMatch[1]) * 100000;
      intent.salary_currency = "INR";
    } else {
      const usdKMatch = q.match(/(?:paying|above|over|more than|salary)\s+(?:\$|usd)?\s*(\d+)\s*k/i);
      if (usdKMatch) {
        intent.salary_min = parseInt(usdKMatch[1], 10) * 1000;
        intent.salary_currency = "USD";
      }
    }

    // Category detection
    for (const [catName, def] of Object.entries(CONTROLLED_TAXONOMY)) {
      if (q.includes(catName.toLowerCase())) {
        intent.category = catName;
        break;
      }
      for (const kw of def.keywords) {
        if (new RegExp(`\\b${kw}\\b`, "i").test(q)) {
          intent.category = catName;
          break;
        }
      }
      if (intent.category) break;
    }

    // Clean keywords (remove stop words and parsed location/radius phrases)
    let cleaned = q
      .replace(/within\s+\d+\s*(?:km|kms|kilometers|miles|mi)?/gi, "")
      .replace(/\b(in|near|around)\s+[a-zA-Z\s]+/gi, "")
      .replace(/\b(jobs|job|vacancies|openings|paying|above|over|remote|hybrid|full[- ]time|part[- ]time|internship)\b/gi, "")
      .replace(/[^\w\s]/g, " ")
      .trim();

    const words = cleaned.split(/\s+/).filter(w => w.length > 1 && !["for", "with", "and", "the"].includes(w));
    intent.keywords = words;

    return intent;
  }
}
