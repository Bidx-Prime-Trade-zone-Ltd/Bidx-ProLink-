const DEFAULT_LEVEL_LIMIT = 5;

/**
 * Discover a country's own administrative hierarchy in order.
 * A level is included only when the source returns a non-empty, usable list.
 * The next level is requested only after its parent has been selected.
 */
export async function loadCountryAdministrativeHierarchy(countryIso3, selectedNames = [], maxLevels = DEFAULT_LEVEL_LIMIT) {
  const country = String(countryIso3 || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(country)) return { levels: [], stoppedAt: 1, reason: "invalid-country" };

  const levels = [];
  let parentName = "";
  for (let level = 1; level <= Math.min(Number(maxLevels) || DEFAULT_LEVEL_LIMIT, DEFAULT_LEVEL_LIMIT); level += 1) {
    if (level > 1 && !parentName) return { levels, stoppedAt: level, reason: "parent-not-selected" };

    let result;
    try {
      const query = new URLSearchParams({ country, level: String(level) });
      if (parentName) query.set("parent", parentName);
      const response = await fetch(`/api/geography?${query.toString()}`);
      if (!response.ok) return { levels, stoppedAt: level, reason: "lookup-unavailable" };
      result = await response.json();
    } catch {
      return { levels, stoppedAt: level, reason: "lookup-unavailable" };
    }

    const areas = Array.isArray(result?.areas)
      ? result.areas.filter(area => area && typeof area.name === "string" && area.name.trim() && typeof area.id === "string")
      : [];
    if (!result?.available || !areas.length) return { levels, stoppedAt: level, reason: "no-verified-data" };

    levels.push({
      level,
      name: String(result.levelName || `Administrative level ${level}`),
      areas
    });

    const selected = String(selectedNames[level - 1] || "").trim();
    parentName = areas.find(area => area.name === selected)?.name || "";
    if (!parentName) return { levels, stoppedAt: level + 1, reason: "parent-not-selected" };
  }

  return { levels, stoppedAt: levels.length + 1, reason: "max-level-reached" };
}
