const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// ---------------------------------------------------------------------------
// RESPONSIVE IMAGES
//
// Execs upload photos straight off a phone or a DSLR through the CMS — the
// originals run 3–5000px wide and 2–3MB each, and the site was serving those
// untouched into 339px-wide boxes on a phone. This generates a set of smaller
// JPEGs at build time and rewrites the HTML to offer them via srcset.
//
// Deliberately srcset-on-<img> rather than <picture> + WebP: wrapping every
// image in a <picture> element inserts a box between the img and its styled
// parent, which breaks rules like `.member-headshot img { height: 100% }`.
// Keeping the original <img> in place means zero layout risk, and resizing
// alone already removes ~95% of the bytes. WebP would be a further ~25% on
// top and is the natural next step if it's ever wanted.
//
// Nothing changes for the execs: they keep uploading full-size photos and the
// originals stay untouched in assets/uploads/ (the CMS media library still
// works normally). Only the built output in _site/ gains the resized copies.
// ---------------------------------------------------------------------------
const IMG_WIDTHS = [480, 800, 1280, 1920];
const UPLOADS_SRC = path.join(__dirname, "assets", "uploads");
const RESIZED_OUT = path.join(__dirname, "_site", "assets", "uploads", "resized");
// Maps "/assets/uploads/photo.jpeg" -> [{ w, url }, …] for the HTML transform.
const imageVariants = new Map();

function buildResizedImages() {
  imageVariants.clear();
  if (!fs.existsSync(UPLOADS_SRC)) return;
  fs.mkdirSync(RESIZED_OUT, { recursive: true });

  const files = fs.readdirSync(UPLOADS_SRC).filter((f) => /\.(jpe?g|png)$/i.test(f));
  return Promise.all(
    files.map(async (file) => {
      const srcPath = path.join(UPLOADS_SRC, file);
      const srcStat = fs.statSync(srcPath);
      let meta;
      try {
        meta = await sharp(srcPath).metadata();
      } catch (e) {
        // A corrupt or unreadable upload shouldn't take the whole build down;
        // it just doesn't get variants and is served as-is.
        console.warn(`[images] skipping ${file}: ${e.message}`);
        return;
      }

      const base = file.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]/gi, "-");
      const variants = [];
      for (const w of IMG_WIDTHS) {
        // Never upscale — a 900px headshot gains nothing from a 1920px copy.
        if (meta.width && meta.width <= w) continue;
        const outName = `${base}-${w}.jpg`;
        const outPath = path.join(RESIZED_OUT, outName);
        // Rebuild only when the source is newer, so `--serve` rebuilds and
        // repeat CI builds stay fast.
        const stale = !fs.existsSync(outPath) || fs.statSync(outPath).mtimeMs < srcStat.mtimeMs;
        if (stale) {
          await sharp(srcPath)
            .rotate() // honour EXIF orientation, which resizing otherwise drops
            .resize({ width: w, withoutEnlargement: true })
            .jpeg({ quality: 82, progressive: true, mozjpeg: true })
            .toFile(outPath);
        }
        variants.push({ w, url: `/assets/uploads/resized/${outName}` });
      }
      if (variants.length) imageVariants.set(`/assets/uploads/${file}`, variants);
    })
  );
}

// Decodes the %20-style escaping Decap applies to uploaded filenames with
// spaces, so a src in the HTML still matches the file on disk.
function lookupVariants(src) {
  if (imageVariants.has(src)) return imageVariants.get(src);
  try {
    return imageVariants.get(decodeURIComponent(src));
  } catch (e) {
    return undefined;
  }
}

module.exports = function (eleventyConfig) {
  eleventyConfig.on("eleventy.before", buildResizedImages);

  // Adds srcset/sizes to every <img> pointing at an upload, and repoints inline
  // background-image URLs (the page-header banners) at a sensibly sized copy.
  eleventyConfig.addTransform("responsiveImages", function (content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html") || imageVariants.size === 0) return content;

    content = content.replace(/<img\b[^>]*>/gi, (tag) => {
      if (/\ssrcset=/i.test(tag)) return tag;
      const srcMatch = tag.match(/\ssrc=["']([^"']+)["']/i);
      if (!srcMatch) return tag;
      const variants = lookupVariants(srcMatch[1]);
      if (!variants || !variants.length) return tag;

      const srcset = variants.map((v) => `${v.url} ${v.w}w`).join(", ");
      // No layout information is available here, so `sizes` assumes the common
      // case: full viewport width on a phone, and never wider than the 1200px
      // content column on a desktop.
      const sizes = "(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 600px";
      // Point src at the largest variant so browsers ignoring srcset still get
      // a resized file rather than the multi-megabyte original.
      const largest = variants[variants.length - 1].url;
      return tag
        .replace(/\ssrc=["'][^"']+["']/i, ` src="${largest}"`)
        .replace(/<img\b/i, `<img srcset="${srcset}" sizes="${sizes}"`);
    });

    // The lightbox reads its full-size image out of data-img. A 1920px copy is
    // already more than the overlay can display (max-height: 80vh), so there's
    // no reason to push the multi-megapixel original down the wire on tap.
    content = content.replace(/\sdata-img=["']([^"']+)["']/gi, (whole, url) => {
      const variants = lookupVariants(url);
      if (!variants || !variants.length) return whole;
      return ` data-img="${variants[variants.length - 1].url}"`;
    });

    content = content.replace(
      /background-image:\s*url\((['"]?)([^'")]+)\1\)/gi,
      (whole, quote, url) => {
        const variants = lookupVariants(url);
        if (!variants || !variants.length) return whole;
        // Banners run the full width of the viewport, so take the widest copy.
        return `background-image:url(${quote}${variants[variants.length - 1].url}${quote})`;
      }
    );

    return content;
  });

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

  // Builds the competitions / team placements / individual achievements shown
  // on an exec's profile page from two sources:
  //   1. Auto-pulled — cross-references the member's name against the
  //      achievements collection, so an exec never has to re-enter data that
  //      already lives on the achievement entry and it can't drift out of sync.
  //      A result's recipients ("Kate Hilton & Ava Gonsalves") counts as a team
  //      placement when it names more than one person, individual otherwise.
  //   2. Manual — the three optional lists an exec can fill in on their own CMS
  //      entry. Useful for anything not tracked as a GHPLS achievement (an
  //      outside competition, a pre-GHPLS award, a placement recorded under a
  //      different spelling of their name).
  // The two are merged and de-duplicated. Setting `manualOnly` on the member
  // suppresses the auto-pulled side entirely, for the case where the automatic
  // match is wrong and the exec wants full control.
  eleventyConfig.addFilter("memberRecord", function (name, achievements, manual) {
    const record = { competitions: [], teamPlacements: [], individualAchievements: [] };
    const m = manual || {};
    const key = (name || "").trim().toLowerCase();

    function byDateDesc(a, b) {
      const da = a.date ? new Date(a.date).getTime() : new Date(a.year || 0, 0).getTime();
      const db = b.date ? new Date(b.date).getTime() : new Date(b.year || 0, 0).getTime();
      return db - da;
    }
    // Same row twice (once auto-pulled, once typed by hand) should render once.
    function pushUnique(list, row) {
      const id = [row.award || "", row.competition || "", row.year || ""].join("|").toLowerCase();
      if (list.some(function (r) { return r._id === id; })) return;
      row._id = id;
      list.push(row);
    }

    if (key && achievements && !m.manualOnly) {
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
        pushUnique(record.competitions, { competition: d.competition, year: d.year, date: d.date, slug: a.fileSlug });
        matchedResults.forEach(function (r) {
          const tokens = (r.recipients || "").split("&");
          const row = { competition: d.competition, year: d.year, date: d.date, slug: a.fileSlug, award: r.award };
          if (tokens.length > 1) pushUnique(record.teamPlacements, row);
          else pushUnique(record.individualAchievements, row);
        });
      });
    }

    // A hand-entered row that happens to name a competition we already have a
    // page for still links through to it, so manual entry doesn't cost the link.
    function findSlug(competition, year) {
      if (!achievements || !competition) return null;
      const c = String(competition).trim().toLowerCase();
      const hit = achievements.find(function (a) {
        const d = a.data;
        if ((d.competition || "").trim().toLowerCase() !== c) return false;
        return !year || String(d.year) === String(year);
      });
      return hit ? hit.fileSlug : null;
    }
    function addManual(list, rows) {
      (rows || []).forEach(function (r) {
        if (!r || !r.competition) return;
        pushUnique(list, {
          competition: r.competition,
          year: r.year,
          date: r.date,
          award: r.award,
          slug: findSlug(r.competition, r.year),
        });
      });
    }
    addManual(record.competitions, m.competitions);
    addManual(record.teamPlacements, m.teamPlacements);
    addManual(record.individualAchievements, m.individualAchievements);

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
