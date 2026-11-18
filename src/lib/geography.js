const cache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000;

export async function getAdministrativeAreas(countryCode, level, parentName = "") {
  const country = String(countryCode || "").toUpperCase();
  const adminLevel = Number(level);
  if (!/^[A-Z]{3}$/.test(country) || !Number.isInteger(adminLevel) || adminLevel < 1 || adminLevel > 5) {
    throw new Error("Invalid country or administrative level.");
  }
  const parent = String(parentName || "").trim();
  if (adminLevel > 1 && !parent) return { areas: [], available: false, needsParent: true };
  const key = country + ":" + adminLevel + ":" + parent.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.data;

  const response = await fetch(`/api/geography?country=${encodeURIComponent(country)}&level=${adminLevel}${parent ? "&parent=" + encodeURIComponent(parent) : ""}`);
  if (!response.ok) throw new Error("Geographical areas are temporarily unavailable.");
  const data = await response.json();
  cache.set(key, { data, savedAt: Date.now() });
  return data;
}
