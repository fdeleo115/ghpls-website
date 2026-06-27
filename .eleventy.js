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
