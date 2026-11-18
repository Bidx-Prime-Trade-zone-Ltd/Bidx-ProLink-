const cache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000;

export async function getAdministrativeAreas(countryCode, level) {
  const country = String(countryCode || "").toUpperCase();
  const adminLevel = Number(level);
  if (!/^[A-Z]{3}$/.test(country) || !Number.isInteger(adminLevel) || adminLevel < 1 || adminLevel > 5) {
    throw new Error("Invalid country or administrative level.");
  }
  const key = country + ":" + adminLevel;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.data;

  const response = await fetch(`/api/geography?country=${encodeURIComponent(country)}&level=${adminLevel}`);
  if (!response.ok) throw new Error("Geographical areas are temporarily unavailable.");
  const data = await response.json();
  cache.set(key, { data, savedAt: Date.now() });
  return data;
}
