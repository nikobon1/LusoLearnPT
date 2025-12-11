// Helper for stable shuffle
export const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

// Helper: Normalize legacy or missing frequency to standard buckets
export const normalizeFrequency = (freq?: string): string => {
    if (!freq) return "10000+";
    // Exact matches
    if (["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"].includes(freq)) return freq;
    
    // Legacy mappings
    if (freq === "High") return "Top 1000"; 
    if (freq === "Medium") return "Top 3000";
    if (freq === "Low") return "10000+";
    
    return "10000+"; // Fallback
};

// Helper to map frequency to sortable weight
export const getFrequencyWeight = (freq: string): number => {
    switch (freq) {
        case "Top 500": return 1;
        case "Top 1000": return 2;
        case "Top 3000": return 3;
        case "Top 5000": return 4;
        case "10000+": return 5;
        default: return 5;
    }
};
