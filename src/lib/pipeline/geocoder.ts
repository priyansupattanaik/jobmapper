import { GeocodingAccuracy } from "../types";

export interface GeocodingResult {
  latitude: number | null;
  longitude: number | null;
  accuracy: GeocodingAccuracy;
  confidence: number;
  formatted_address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
}

export class GeocoderService {
  private cache: Map<string, GeocodingResult> = new Map();
  private userAgent: string;
  private lastRequestTime: number = 0;

  constructor(userAgent: string = process.env.GEOCODING_USER_AGENT || "JobMapper/1.0 (contact@jobmapper.local)") {
    this.userAgent = userAgent;
  }

  async geocode(locationText: string, isRemote: boolean = false): Promise<GeocodingResult> {
    // 1. Remote jobs have no physical coordinate requirement
    if (isRemote || !locationText || locationText.trim().toLowerCase() === "remote") {
      return {
        latitude: null,
        longitude: null,
        accuracy: "unknown",
        confidence: 0.0,
        formatted_address: "Remote",
        city: null,
        state: null,
        country: null,
        postal_code: null
      };
    }

    const cleanQuery = locationText
      .replace(/\b(remote|work from home|wfh|hybrid|telecommute)\b/gi, "")
      .replace(/[()]/g, "")
      .trim();

    if (!cleanQuery || cleanQuery.length < 2) {
      return {
        latitude: null,
        longitude: null,
        accuracy: "unknown",
        confidence: 0.0,
        formatted_address: locationText,
        city: null,
        state: null,
        country: null,
        postal_code: null
      };
    }

    const cacheKey = cleanQuery.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Rate-limit compliance (1 request per second for Nominatim)
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 1100) {
      await new Promise(r => setTimeout(r, 1100 - elapsed));
    }
    this.lastRequestTime = Date.now();

    try {
      // 1. Primary provider: OpenStreetMap Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(cleanQuery)}`,
        {
          headers: {
            "User-Agent": this.userAgent,
            "Accept-Language": "en"
          }
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const item = data[0];
          const result = this.mapNominatimResult(item, locationText);
          this.cache.set(cacheKey, result);
          return result;
        }
      }

      // 2. Fallback provider: Photon (Komoot OSM search API)
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`,
        { headers: { "User-Agent": this.userAgent } }
      );

      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData?.features?.length > 0) {
          const feat = photonData.features[0];
          const coords = feat.geometry.coordinates; // [lng, lat]
          const props = feat.properties || {};

          const accuracy: GeocodingAccuracy = props.housenumber ? "exact_address" : (props.street ? "street_level" : (props.city ? "city_level" : "area_level"));
          const confidence = accuracy === "exact_address" ? 0.95 : (accuracy === "street_level" ? 0.85 : (accuracy === "city_level" ? 0.6 : 0.4));

          const result: GeocodingResult = {
            latitude: Number(coords[1]),
            longitude: Number(coords[0]),
            accuracy,
            confidence,
            formatted_address: [props.name, props.city, props.country].filter(Boolean).join(", "),
            city: props.city || props.town || null,
            state: props.state || null,
            country: props.country || null,
            postal_code: props.postcode || null
          };

          this.cache.set(cacheKey, result);
          return result;
        }
      }
    } catch (err) {
      console.warn(`Geocoding warning for query "${cleanQuery}":`, (err as Error).message);
    }

    // Geocoding failed -> Never guess coordinates
    const notFoundResult: GeocodingResult = {
      latitude: null,
      longitude: null,
      accuracy: "unknown",
      confidence: 0.0,
      formatted_address: locationText,
      city: null,
      state: null,
      country: null,
      postal_code: null
    };
    this.cache.set(cacheKey, notFoundResult);
    return notFoundResult;
  }

  private mapNominatimResult(item: any, originalText: string): GeocodingResult {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const addr = item.address || {};
    const type = item.type || "";
    const placeRank = Number(item.place_rank) || 0;

    let accuracy: GeocodingAccuracy = "unknown";
    let confidence = 0.5;

    if (addr.house_number || type === "house" || type === "building" || placeRank >= 30) {
      accuracy = "exact_address";
      confidence = 0.95;
    } else if (addr.road || type === "street" || (placeRank >= 26 && placeRank < 30)) {
      accuracy = "street_level";
      confidence = 0.85;
    } else if (addr.suburb || addr.neighbourhood || addr.postcode || (placeRank >= 20 && placeRank < 26)) {
      accuracy = "area_level";
      confidence = 0.70;
    } else if (addr.city || addr.town || addr.municipality || addr.county || (placeRank >= 16 && placeRank < 20)) {
      accuracy = "city_level";
      confidence = 0.55;
    } else {
      accuracy = "city_level";
      confidence = 0.40;
    }

    return {
      latitude: lat,
      longitude: lon,
      accuracy,
      confidence,
      formatted_address: item.display_name || originalText,
      city: addr.city || addr.town || addr.municipality || addr.village || null,
      state: addr.state || addr.region || null,
      country: addr.country || null,
      postal_code: addr.postcode || null
    };
  }
}

let geocoderInstance: GeocoderService | null = null;
export function getGeocoder(): GeocoderService {
  if (!geocoderInstance) {
    geocoderInstance = new GeocoderService();
  }
  return geocoderInstance;
}
