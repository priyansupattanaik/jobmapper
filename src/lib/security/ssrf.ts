import { URL } from "url";
import dns from "dns/promises";

export class SecurityValidator {
  private static PRIVATE_IP_RANGES = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./, // AWS/Cloud metadata
    /^0\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];

  static isSafeUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return false;
      }
      for (const pattern of this.PRIVATE_IP_RANGES) {
        if (pattern.test(hostname)) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async resolveAndVerifySafe(rawUrl: string): Promise<boolean> {
    if (!this.isSafeUrl(rawUrl)) return false;
    try {
      const parsed = new URL(rawUrl);
      const addresses = await dns.lookup(parsed.hostname, { all: true });
      for (const addr of addresses) {
        for (const pattern of this.PRIVATE_IP_RANGES) {
          if (pattern.test(addr.address)) return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeText(input: string): string {
    if (!input) return "";
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/javascript:/gi, "")
      .trim();
  }
}
