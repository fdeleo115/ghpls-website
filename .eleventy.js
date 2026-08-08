module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("src/styles.css");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  eleventyConfig.addCollection("achievements", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/achievements/*.md").sort((a, b) => {
      // Sort by explicit date when present, otherwise fall back to year.
      const da = a.data.date ? new Date(a.data.date).getTime() : new Date(a.data.year || 0, 0).getTime();
      const db = b.data.date ? new Date(b.data.date).getTime() : new Date(b.data.year || 0, 0).getTime();
      return db - da;
    });
  });

  eleventyConfig.addCollection("ghcupVideos", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/ghcup-videos/*.md").sort((a, b) => {
      return (b.data.year || 0) - (a.data.year || 0);
    });
  });

  eleventyConfig.addCollection("events", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/events/*.md").sort((a, b) => {
      return new Date(a.data.date) - new Date(b.data.date);
    });
  });

  eleventyConfig.addCollection("pastEvents", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/past-events/*.md").sort((a, b) => {
      return new Date(b.data.date) - new Date(a.data.date);
    });
  });

  eleventyConfig.addCollection("photos", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/photos/*.md").sort((a, b) => {
      return new Date(b.data.date || 0) - new Date(a.data.date || 0);
    });
  });

  eleventyConfig.addCollection("ghcupWinners", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/ghcup-winners/*.md").sort((a, b) => {
      return (b.data.year || 0) - (a.data.year || 0);
    });
  });

  eleventyConfig.addCollection("team", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/team/*.md").sort((a, b) => {
      return (a.data.order || 99) - (b.data.order || 99);
    });
  });

  eleventyConfig.addFilter("dateFormat", function (date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  });

  eleventyConfig.addFilter("monthShort", function (date) {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-CA", { month: "short" }).toUpperCase();
  });

  eleventyConfig.addFilter("dayNum", function (date) {
    if (!date) return "";
    return new Date(date).getDate();
  });

  // Cross-references a team member's name against the achievements collection
  // so exec profile pages can show competitions/placements without the exec
  // having to re-enter data that's already on the achievement entry.
  // A result's recipients ("Kate Hilton & Ava Gonsalves") counts as a team
  // placement when it names more than one person, individual otherwise.
  eleventyConfig.addFilter("memberRecord", function (name, achievements) {
    const record = { competitions: [], teamPlacements: [], individualAchievements: [] };
    if (!name || !achievements) return record;
    const key = name.trim().toLowerCase();
    function byDateDesc(a, b) {
      const da = a.date ? new Date(a.date).getTime() : new Date(a.year || 0, 0).getTime();
      const db = b.date ? new Date(b.date).getTime() : new Date(b.year || 0, 0).getTime();
      return db - da;
    }
    achievements.forEach(function (a) {
      const d = a.data;
      const inCompetitors = (d.competitors || []).some(function (c) {
        return (c.name || "").trim().toLowerCase() === key;
      });
      const matchedResults = (d.results || []).filter(function (r) {
        const tokens = (r.recipients || "").split("&").map(function (s) { return s.trim().toLowerCase(); });
        return tokens.indexOf(key) !== -1;
      });
      if (!inCompetitors && matchedResults.length === 0) return;
      record.competitions.push({ competition: d.competition, year: d.year, date: d.date, slug: a.fileSlug });
      matchedResults.forEach(function (r) {
        const tokens = (r.recipients || "").split("&");
        const row = { competition: d.competition, year: d.year, date: d.date, slug: a.fileSlug, award: r.award };
        if (tokens.length > 1) record.teamPlacements.push(row);
        else record.individualAchievements.push(row);
      });
    });
    record.competitions.sort(byDateDesc);
    record.teamPlacements.sort(byDateDesc);
    record.individualAchievements.sort(byDateDesc);
    return record;
  });

  // Pull the 11-character video ID out of any common YouTube URL form.
  eleventyConfig.addFilter("youtubeId", function (url) {
    if (!url) return "";
    const s = String(url).trim();
    const m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    // If they just pasted the bare ID, accept it as-is.
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    return "";
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
  };
};
