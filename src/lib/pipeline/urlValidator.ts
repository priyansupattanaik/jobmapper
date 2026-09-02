import { SecurityValidator } from "../security/ssrf";

export interface UrlValidationResult {
  isValidSyntax: boolean;
  isAccessible: boolean;
  httpStatus: number | null;
  canonicalUrl: string;
  isRedirect: boolean;
  isLoginWall: boolean;
  isDeadPage: boolean;
  error?: string;
  verifiedAt: string;
}

export class UrlValidator {
  private timeoutMs: number;

  constructor(timeoutMs: number = 8000) {
    this.timeoutMs = timeoutMs;
  }

  async validateUrl(rawUrl: string): Promise<UrlValidationResult> {
    const verifiedAt = new Date().toISOString();

    // 1. Syntax check
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          isValidSyntax: false,
          isAccessible: false,
          httpStatus: null,
          canonicalUrl: rawUrl,
          isRedirect: false,
          isLoginWall: false,
          isDeadPage: true,
          error: "Invalid protocol",
          verifiedAt
        };
      }
    } catch {
      return {
        isValidSyntax: false,
        isAccessible: false,
        httpStatus: null,
        canonicalUrl: rawUrl,
        isRedirect: false,
        isLoginWall: false,
        isDeadPage: true,
        error: "Malformed URL",
        verifiedAt
      };
    }

    // 2. SSRF Protection: verify host is safe and not private/internal
    const isSafe = await SecurityValidator.resolveAndVerifySafe(rawUrl);
    if (!isSafe) {
      return {
        isValidSyntax: true,
        isAccessible: false,
        httpStatus: 403,
        canonicalUrl: rawUrl,
        isRedirect: false,
        isLoginWall: false,
        isDeadPage: true,
        error: "Blocked by SSRF protection policy",
        verifiedAt
      };
    }

    // 3. HTTP Accessibility & Canonical URL resolution
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // Attempt HEAD request first, fall back to GET if 405 Method Not Allowed
      let response = await fetch(rawUrl, {
        method: "HEAD",
        headers: {
          "User-Agent": "JobMapper/1.0 (Job Verification Engine; +https://jobmapper.local)",
          "Accept": "text/html,application/xhtml+xml,application/json"
        },
        redirect: "follow",
        signal: controller.signal
      });

      if (response.status === 405) {
        response = await fetch(rawUrl, {
          method: "GET",
          headers: {
            "User-Agent": "JobMapper/1.0 (Job Verification Engine; +https://jobmapper.local)",
            "Accept": "text/html,application/xhtml+xml,application/json"
          },
          redirect: "follow",
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      const finalUrl = response.url || rawUrl;
      const isRedirect = finalUrl !== rawUrl;
      const status = response.status;
      const isDeadPage = status === 404 || status === 410 || status >= 500;

      // Check if redirected to a login wall
      const isLoginWall = /\b(login|signin|auth|session|accounts\.google)\b/i.test(finalUrl);

      return {
        isValidSyntax: true,
        isAccessible: status >= 200 && status < 400,
        httpStatus: status,
        canonicalUrl: finalUrl,
        isRedirect,
        isLoginWall,
        isDeadPage,
        verifiedAt
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      return {
        isValidSyntax: true,
        isAccessible: false,
        httpStatus: null,
        canonicalUrl: rawUrl,
        isRedirect: false,
        isLoginWall: false,
        isDeadPage: true,
        error: errorMsg,
        verifiedAt
      };
    }
  }
}
