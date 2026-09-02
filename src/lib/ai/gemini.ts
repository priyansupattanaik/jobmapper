import { AIProvider, AIClassificationResult, ParsedSearchIntent } from "./provider";
import { RuleBasedAIProvider } from "./ruleBased";
import { CATEGORY_NAMES } from "./taxonomy";

export class GeminiAIProvider implements AIProvider {
  name = "gemini";
  model: string;
  version = "gemini-1.5-flash";
  private apiKey: string;
  private fallback: RuleBasedAIProvider;

  constructor(apiKey: string = process.env.GEMINI_API_KEY || "", model: string = process.env.AI_MODEL || "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
    this.fallback = new RuleBasedAIProvider();
  }

  async classifyJob(job: {
    title: string;
    description: string;
    requirements?: string[];
  }): Promise<AIClassificationResult> {
    if (!this.apiKey) {
      return this.fallback.classifyJob(job);
    }

    const categoriesList = CATEGORY_NAMES.join(", ");
    const prompt = `
You are a job classification engine.
Given the following job information, classify it strictly into the controlled taxonomy:
Allowed categories: [${categoriesList}]

Job Title: ${job.title}
Job Description: ${job.description.substring(0, 1500)}
Requirements: ${(job.requirements || []).join(", ").substring(0, 500)}

Return ONLY valid JSON matching this schema:
{
  "category": "one of the allowed categories",
  "subcategory": "specific subcategory name",
  "skills": ["skill1", "skill2", "skill3"],
  "experience_level": "internship" | "fresher" | "entry_level" | "mid_level" | "senior" | "executive" | "unknown",
  "confidence": number between 0.0 and 1.0
}
Do NOT invent facts or change the job title. Only return JSON.
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
          })
        }
      );

      if (!response.ok) {
        return this.fallback.classifyJob(job);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return this.fallback.classifyJob(job);

      const parsed = JSON.parse(rawText);
      const category = CATEGORY_NAMES.includes(parsed.category) ? parsed.category : "Other";

      return {
        category,
        subcategory: String(parsed.subcategory || "General"),
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 15) : [],
        experience_level: parsed.experience_level || "unknown",
        confidence: Math.min(Math.max(Number(parsed.confidence) || 0.8, 0.0), 1.0),
        model: this.model,
        version: this.version
      };
    } catch {
      return this.fallback.classifyJob(job);
    }
  }

  async parseSearchIntent(query: string): Promise<ParsedSearchIntent> {
    if (!this.apiKey) {
      return this.fallback.parseSearchIntent(query);
    }

    const prompt = `
Convert the user's natural language job search query into structured search filters.
Query: "${query}"

Return ONLY valid JSON:
{
  "keywords": ["keyword1", "keyword2"],
  "location": "string or null",
  "radius_km": number or null,
  "work_mode": ["remote" | "hybrid" | "onsite"],
  "employment_type": ["full_time" | "part_time" | "contract" | "internship" | "apprenticeship" | "temporary"],
  "experience_level": ["internship" | "fresher" | "entry_level" | "mid_level" | "senior" | "executive"],
  "category": "string or null",
  "salary_min": number or null,
  "salary_currency": "INR" | "USD" | "EUR" | "GBP" or null
}
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
          })
        }
      );

      if (!response.ok) {
        return this.fallback.parseSearchIntent(query);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return this.fallback.parseSearchIntent(query);

      const parsed = JSON.parse(rawText);
      return {
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        location: parsed.location || null,
        radius_km: parsed.radius_km || null,
        work_mode: Array.isArray(parsed.work_mode) ? parsed.work_mode : [],
        employment_type: Array.isArray(parsed.employment_type) ? parsed.employment_type : [],
        experience_level: Array.isArray(parsed.experience_level) ? parsed.experience_level : [],
        category: parsed.category || null,
        salary_min: parsed.salary_min || null,
        salary_currency: parsed.salary_currency || null
      };
    } catch {
      return this.fallback.parseSearchIntent(query);
    }
  }
}
