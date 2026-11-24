const DEFAULT_LEVEL_LIMIT = 5;

const COUNTRY_LEVEL_LABELS = {
  ESP: ["Autonomous Community / City", "Province / Island Council", "Municipality", "Local entity"],
  POL: ["Voivodeship", "County (Powiat)", "Municipality (Gmina)", "Locality"],
  };
const invalidLevelName = value => !value || /^(unknown|n\/?a|null|undefined|administrative level\s+\d+)$/i.test(String(value).trim());

const usableArea = area => area
  && typeof area.name === "string"
  && area.name.trim()
  && (typeof area.id === "string" || typeof area.id === "number");

export async function loadCountryAdministrativeHierarchy(countryIso3, selectedNames = [], maxLevels = DEFAULT_LEVEL_LIMIT) {
  const country = String(countryIso3 || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(country)) return { levels: [], stoppedAt: 1, reason: "invalid-country" };

  const levels = [];
  let parentName = "";
  const limit = Math.min(Math.max(1, Number(maxLevels) || DEFAULT_LEVEL_LIMIT), DEFAULT_LEVEL_LIMIT);
  for (let level = 1; level <= limit; level += 1) {
    if (level > 1 && !parentName) return { levels, stoppedAt: level, reason: "parent-not-selected" };

    try {
      const query = new URLSearchParams({ country, level: String(level) });
      if (parentName) query.set("parent", parentName);
      const response = await fetch(`/api/geography?${query.toString()}`);
      if (!response.ok) return { levels, stoppedAt: level, reason: "lookup-unavailable" };
      const result = await response.json();
      const areas = Array.isArray(result?.areas) ? result.areas.filter(usableArea) : [];
      const sourceLevelName = String(result?.levelName || "").trim();
      const configuredLevelName = COUNTRY_LEVEL_LABELS[country]?.[level - 1] || "";
      const levelName = invalidLevelName(sourceLevelName) ? configuredLevelName : sourceLevelName;
      const hasCountrySpecificName = !invalidLevelName(levelName);
      if (!result?.available || result?.qualityStatus !== "structurally-checked" || !hasCountrySpecificName || !areas.length) {
        return { levels, stoppedAt: level, reason: "no-verified-data" };
      }
      const uniqueNames = new Set(areas.map(area => area.name.trim().toLocaleLowerCase()));
      if (uniqueNames.size !== areas.length) return { levels, stoppedAt: level, reason: "ambiguous-data" };

      levels.push({ level, name: levelName, areas });
      const selected = String(selectedNames[level - 1] || "").trim();
      parentName = areas.find(area => area.name.trim().toLocaleLowerCase() === selected.toLocaleLowerCase())?.name || "";
      if (selected && !parentName) {
        levels.pop();
        return { levels, stoppedAt: level, reason: "saved-value-not-in-source" };
      }
      if (!parentName) return { levels, stoppedAt: level + 1, reason: "parent-not-selected" };
    } catch {
      return { levels, stoppedAt: level, reason: "lookup-unavailable" };
    }
  }
  return { levels, stoppedAt: levels.length + 1, reason: "max-level-reached" };
}
