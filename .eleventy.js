const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// ---------------------------------------------------------------------------
// RESPONSIVE IMAGES
//
// Execs upload photos straight off a phone or a DSLR through the CMS — the
// originals run 3–5000px wide and 2–3MB each, and the site was serving those
// untouched into 339px-wide boxes on a phone. This generates smaller JPEG and
// WebP copies at build time and rewrites the HTML to offer them.
//
// WHY <picture> IS SAFE NOW (it was avoided here before, for a real reason)
// ------------------------------------------------------------------------
// The previous version used srcset-on-<img> only, and explicitly rejected
// <picture> because wrapping every image inserts a box between the <img> and
// its styled parent — which breaks rules like `.member-headshot img { height:
// 100% }`, since the percentage then resolves against the <picture> rather
// than the styled container.
//
// That objection was correct, and it is answered by one line of CSS:
// `picture { display: contents }` in styles.css. A `display: contents` element
// generates no box at all, so the <img>'s containing block is once again its
// original parent and every existing height/aspect rule keeps working exactly
// as before. Do not remove that CSS rule without also reverting this to a
// plain <img>.
//
// Getting <picture> back buys WebP with a real JPEG fallback: browsers that
// don't understand WebP simply ignore the <source> and use the <img>. That is
// worth roughly another 25–30% off every photo on top of the resizing, and it
// is the single biggest remaining win on a phone.
//
// Nothing changes for the execs: they keep uploading full-size photos and the
// originals stay untouched in assets/uploads/. Only the built output gains the
// generated copies.
// ---------------------------------------------------------------------------
const IMG_WIDTHS = [480, 800, 1280, 1920];
const UPLOADS_SRC = path.join(__dirname, "assets", "uploads");

// ---------------------------------------------------------------------------
// Generated images are written to a cache directory OUTSIDE _site, then copied
// in. This matters more than it looks.
//
// Variants used to be written straight into _site, and the "is it stale?" check
// compared them against the source file's timestamp. That works beautifully on
// a machine where _site survives between builds — and not at all in CI, where
// the checkout is fresh every time, _site does not exist, and every single
// variant is therefore regenerated from scratch. With two formats at four
// widths across three dozen photos that is several hundred image encodes, and
// it turns a deploy into an eight-minute job for content that has not changed.
//
// Keeping the cache in its own directory means CI can restore it between runs
// (see .github/workflows/deploy.yml), and a local `rm -rf _site` no longer
// costs ten minutes either.
// ---------------------------------------------------------------------------
const IMG_CACHE = path.join(__dirname, ".image-cache");
const RESIZED_OUT = path.join(__dirname, "_site", "assets", "uploads", "resized");

// Maps "/assets/uploads/photo.jpeg" -> {
//   jpeg: [{ w, url }, …], webp: [{ w, url }, …], width, height
// }
const imageVariants = new Map();

// The default `sizes` for an image whose template hasn't said anything more
// specific. It assumes the worst case — full viewport width on a phone — which
// is right for banners and card photos and badly wrong for small images.
//
// This default was, on its own, the main cause of the site feeling slow on a
// phone: it told the browser that an exec headshot rendered in a 190px circle
// needed a full-viewport-width file, so on a 3x phone screen the browser
// dutifully fetched the 1280px copy of all eight of them. Templates now pass a
// real measurement via `data-sizes` (see the `sizes` values in about.njk,
// achievements.njk and friends), and anything that doesn't falls back to this.
const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 600px";

function buildResizedImages() {
  imageVariants.clear();
  if (!fs.existsSync(UPLOADS_SRC)) return;
  fs.mkdirSync(IMG_CACHE, { recursive: true });

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

      // A photo shot in portrait carries EXIF orientation, and `.rotate()`
      // below applies it — so the dimensions that matter downstream are the
      // ones AFTER rotation. Reading meta.width directly would report a
      // portrait photo as landscape and emit a width/height pair with the
      // aspect ratio on its side, reserving a wrongly-shaped box and causing
      // exactly the layout shift these attributes exist to prevent.
      const swapped = meta.orientation && meta.orientation >= 5;
      const srcW = swapped ? meta.height : meta.width;
      const srcH = swapped ? meta.width : meta.height;

      const base = file.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]/gi, "-");
      const jpeg = [];
      const webp = [];
      for (const w of IMG_WIDTHS) {
        // Never upscale — a 900px headshot gains nothing from a 1920px copy.
        if (srcW && srcW <= w) continue;

        const jpegName = `${base}-${w}.jpg`;
        const webpName = `${base}-${w}.webp`;
        const jpegPath = path.join(IMG_CACHE, jpegName);
        const webpPath = path.join(IMG_CACHE, webpName);

        // Rebuild only when the source is newer, so `--serve` rebuilds and
        // repeat CI builds stay fast.
        const stale = (p) => !fs.existsSync(p) || fs.statSync(p).mtimeMs < srcStat.mtimeMs;

        if (stale(jpegPath)) {
          await sharp(srcPath)
            .rotate() // honour EXIF orientation, which resizing otherwise drops
            .resize({ width: w, withoutEnlargement: true })
            .jpeg({ quality: 82, progressive: true, mozjpeg: true })
            .toFile(jpegPath);
        }
        if (stale(webpPath)) {
          await sharp(srcPath)
            .rotate()
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: 78 })
            .toFile(webpPath);
        }

        jpeg.push({ w, url: `/assets/uploads/resized/${jpegName}` });
        webp.push({ w, url: `/assets/uploads/resized/${webpName}` });
      }

      if (jpeg.length) {
        const largest = jpeg[jpeg.length - 1].w;
        imageVariants.set(`/assets/uploads/${file}`, {
          jpeg,
          webp,
          // Intrinsic size of the file we point `src` at, so width/height
          // describe the actual fallback image.
          width: largest,
          height: srcW && srcH ? Math.round((srcH / srcW) * largest) : null,
        });
      }
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

function srcsetFor(list) {
  return list.map((v) => `${v.url} ${v.w}w`).join(", ");
}

// ---------------------------------------------------------------------------
// Copies uploads that the image pipeline did NOT process.
//
// The whole assets/ folder used to be copied wholesale, which shipped ~25MB of
// untouched camera originals alongside the generated copies that are the only
// things the site actually links to. Skipping an original once it has variants
// removes that dead weight from every deploy.
//
// The "did not process" half is the important half, and is why this is a
// filter rather than a blanket skip: assets/uploads is also the CMS's media
// folder for NON-images. A PDF study guide attached to a Materials item lives
// right next to the photos, has no variants, and must still be published — as
// must any photo too small to have been resized. Anything unrecognised is
// copied untouched, so the failure mode is a file that ships needlessly rather
// than a download link that 404s.
// ---------------------------------------------------------------------------
function publishImages() {
  if (!fs.existsSync(IMG_CACHE)) return;
  fs.mkdirSync(RESIZED_OUT, { recursive: true });
  // Only the variants this build actually produced are published, so a photo
  // deleted from the CMS stops being served even though its old files are
  // still sitting in the cache.
  const wanted = new Set();
  for (const v of imageVariants.values()) {
    for (const x of v.jpeg.concat(v.webp)) wanted.add(path.basename(x.url));
  }
  for (const file of wanted) {
    const from = path.join(IMG_CACHE, file);
    const to = path.join(RESIZED_OUT, file);
    if (!fs.existsSync(from)) continue;
    if (fs.existsSync(to) && fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) continue;
    fs.copyFileSync(from, to);
  }
}

function copyUnprocessed() {
  if (!fs.existsSync(UPLOADS_SRC)) return;
  const outDir = path.join(__dirname, "_site", "assets", "uploads");
  fs.mkdirSync(outDir, { recursive: true });

  let copied = 0;
  let skipped = 0;
  for (const file of fs.readdirSync(UPLOADS_SRC)) {
    const srcPath = path.join(UPLOADS_SRC, file);
    if (!fs.statSync(srcPath).isFile()) continue;
    if (imageVariants.has(`/assets/uploads/${file}`)) {
      skipped++;
      continue;
    }
    const outPath = path.join(outDir, file);
    const stale =
      !fs.existsSync(outPath) ||
      fs.statSync(outPath).mtimeMs < fs.statSync(srcPath).mtimeMs;
    if (stale) fs.copyFileSync(srcPath, outPath);
    copied++;
  }
  if (skipped) {
    console.log(
      `[images] ${skipped} original${skipped === 1 ? "" : "s"} left out of the build ` +
        `(resized copies are what the site links to); ${copied} other upload${copied === 1 ? "" : "s"} copied as-is.`
    );
  }
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

module.exports = function (eleventyConfig) {
  eleventyConfig.on("eleventy.before", buildResizedImages);
  eleventyConfig.on("eleventy.after", publishImages);
  eleventyConfig.on("eleventy.after", copyUnprocessed);

  // Wraps every <img> pointing at an upload in a <picture> offering WebP, adds
  // srcset/sizes/width/height/loading, and turns inline background-image URLs
  // (the page-header banners) into breakpoint-aware custom properties.
  eleventyConfig.addTransform("responsiveImages", function (content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html") || imageVariants.size === 0) return content;

    content = content.replace(/<img\b[^>]*>/gi, (tag) => {
      if (/\ssrcset=/i.test(tag)) return tag;
      const src = attr(tag, "src");
      if (!src) return tag;
      const v = lookupVariants(src);
      if (!v || !v.jpeg.length) return tag;

      // A template that knows how big the image really renders says so with
      // data-sizes. See DEFAULT_SIZES for why this matters so much.
      const sizes = attr(tag, "data-sizes") || DEFAULT_SIZES;

      let out = tag;

      // Point src at the largest variant so a browser ignoring srcset entirely
      // still gets a resized file rather than the multi-megabyte original.
      out = out.replace(/\ssrc=["'][^"']+["']/i, ` src="${v.jpeg[v.jpeg.length - 1].url}"`);

      const extras = [`srcset="${srcsetFor(v.jpeg)}"`, `sizes="${sizes}"`];

      // NO width/height attributes here — this was tried and reverted, so
      // don't add them back without reading this.
      //
      // They normally help: intrinsic dimensions let the browser reserve the
      // right-shaped box before the bytes arrive. But they are not inert. The
      // attributes become presentational hints (`height: 1707px`), and a
      // presentational hint only loses to an AUTHOR rule that sets the same
      // property. Every photo on this site is sized by its container instead —
      // `.exec-card-photo img` uses `width: 100%; aspect-ratio: 1` and never
      // mentions height — and `aspect-ratio` only derives a height when the
      // height is auto. The hint therefore won, and the 179px circular
      // headshots rendered 813px tall.
      //
      // There is nothing to gain here anyway: every image container in
      // styles.css already declares a fixed height or an aspect-ratio, so the
      // box is reserved by CSS before the image loads and there is no layout
      // shift for the attributes to prevent.

      // Deferring offscreen images is most of the mobile win on /about/ and
      // /achievements/, which were loading ten and eleven photos eagerly.
      // A template can opt out with data-eager for a genuine hero image —
      // lazy-loading the thing at the top of the page delays the very content
      // the visitor is waiting for.
      if (!/\sloading=/i.test(tag) && !/\sdata-eager\b/i.test(tag)) {
        extras.push('loading="lazy"');
      }
      if (!/\sdecoding=/i.test(tag)) extras.push('decoding="async"');

      out = out.replace(/<img\b/i, `<img ${extras.join(" ")}`);

      // WebP first: the browser takes the first <source> it understands, and
      // falls straight through to the <img> if it understands none of them.
      return (
        `<picture><source type="image/webp" srcset="${srcsetFor(v.webp)}" sizes="${sizes}">` +
        out +
        `</picture>`
      );
    });

    // The lightbox reads its full-size image out of data-img. A 1920px copy is
    // already more than the overlay can display (max-height: 80vh), so there's
    // no reason to push the multi-megapixel original down the wire on tap.
    content = content.replace(/\sdata-img=["']([^"']+)["']/gi, (whole, url) => {
      const v = lookupVariants(url);
      if (!v || !v.jpeg.length) return whole;
      return ` data-img="${v.jpeg[v.jpeg.length - 1].url}"`;
    });

    // ---------------------------------------------------------------------
    // Page-header banners.
    //
    // These are CSS background images, so srcset does not apply to them — and
    // the previous code simply pointed every one at the 1920px copy. That is a
    // ~370KB file, it is the largest element on the page, and on a phone it
    // was being downloaded at five times the width it would ever be shown at.
    //
    // A background image can't carry `sizes`, but it CAN be swapped at a
    // breakpoint. Each banner emits three custom properties, and styles.css
    // picks between them with two media queries. The fallbacks in the
    // var() chain matter: a photo that is only 900px wide has no --bg-lg, and
    // without `var(--bg-lg, var(--bg-md, …))` the whole declaration would be
    // invalid at that breakpoint and the banner would show no photo at all.
    // ---------------------------------------------------------------------
    content = content.replace(
      /background-image:\s*url\((['"]?)([^'")]+)\1\)/gi,
      (whole, quote, url) => {
        const v = lookupVariants(url);
        if (!v || !v.jpeg.length) return whole;
        const at = (w) => {
          const hit = v.jpeg.find((x) => x.w === w);
          return hit ? hit.url : null;
        };
        const sm = at(480) || at(800) || v.jpeg[0].url;
        const md = at(1280) || at(800) || sm;
        const lg = v.jpeg[v.jpeg.length - 1].url;
        return (
          `--bg-sm:url('${sm}'); --bg-md:url('${md}'); --bg-lg:url('${lg}'); ` +
          `background-image:var(--bg-sm)`
        );
      }
    );

    // ---------------------------------------------------------------------
    // Catch-all: any remaining reference to an original upload.
    //
    // The rules above each know about one specific place an image path shows
    // up — src, data-img, background-image — and each was added when that
    // place was noticed. Paths turn up in other places too: og:image and
    // twitter:image meta tags, and any inline handler an editor's template
    // happens to build. Those were still pointing at the untouched original,
    // which matters more than it used to, because originals are no longer
    // published at all: a missed reference is now a 404 rather than merely a
    // slow download.
    //
    // Rewriting by path rather than by context means a new use site is
    // covered the day it is added instead of the day somebody notices. A path
    // with no variants — a PDF in the same folder, a photo too small to
    // resize — isn't in the map and is left exactly as it is.
    // ---------------------------------------------------------------------
    content = content.replace(/\/assets\/uploads\/(?!resized\/)[^"'\s)<>]+/g, (url) => {
      const v = lookupVariants(url);
      if (!v || !v.jpeg.length) return url;
      return v.jpeg[v.jpeg.length - 1].url;
    });

    return content;
  });

  // Top-level assets (the logo) and the self-hosted font files copy as-is.
  // assets/uploads is handled by the image pipeline above rather than copied
  // wholesale — see copyUnprocessed(). "assets/*.*" alone only matches files
  // directly inside assets/ and would silently skip everything one level
  // down, which is exactly where assets/fonts/*.woff2 live.
  eleventyConfig.addPassthroughCopy("assets/*.*");
  eleventyConfig.addPassthroughCopy("assets/fonts");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("src/styles.css");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  // A name on an achievement only reaches an exec's profile when it matches
  // their team entry exactly, so one typo ("Ashon Vas" for "Ashon Vaz") drops
  // the award off their page with nothing at all to notice. Names that come
  // close to an exec's without matching are nearly always that typo; names
  // nowhere near one are just non-exec competitors, and stay quiet.
  function warnOnNearMissNames(collectionApi) {
    const execs = collectionApi
      .getFilteredByGlob("src/team/*.md")
      .map((t) => String(t.data.name || "").trim())
      .filter(Boolean);
    if (execs.length === 0) return;

    function editDistance(a, b) {
      const row = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        let diag = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
          const above = row[j];
          row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
          diag = above;
        }
      }
      return row[b.length];
    }

    const reported = new Set();
    collectionApi.getFilteredByGlob("src/achievements/*.md").forEach((a) => {
      const names = (a.data.competitors || [])
        .map((c) => c.name)
        .concat(...(a.data.results || []).map((r) => String(r.recipients || "").split("&")));
      names.forEach((raw) => {
        const name = String(raw || "").trim();
        if (!name) return;
        const lower = name.toLowerCase();
        if (execs.some((e) => e.toLowerCase() === lower)) return;
        const near = execs.find((e) => editDistance(e.toLowerCase(), lower) <= 2);
        if (!near || reported.has(name + near)) return;
        reported.add(name + near);
        console.warn(
          `[ghpls] ${a.inputPath}: "${name}" looks like a misspelling of exec "${near}" — ` +
            "as written it will not appear on their profile."
        );
      });
    });
  }

  // An entry's URL is its filename, and the filename is generated from the
  // fields at the moment the entry is CREATED. Correct the year afterwards —
  // which execs do, because the year is often the thing they got wrong — and
  // the slug keeps the old one forever. The result is a page at
  // /achievements/highland-cup-2026/ with "Highland Cup 2024" printed on it,
  // which is invisible to whoever made the edit and wrong for everyone who
  // shares the link. Nothing else in the build can catch this, so it is
  // reported here.
  function warnOnSlugYearMismatch(collectionApi) {
    collectionApi.getFilteredByGlob("src/achievements/*.md").forEach((a) => {
      const year = String(a.data.year || "").trim();
      if (!/^\d{4}$/.test(year)) return;
      const inSlug = String(a.fileSlug).match(/(\d{4})(?:-\d+)?$/);
      if (!inSlug || inSlug[1] === year) return;
      console.warn(
        `[ghpls] ${a.inputPath}: this entry says year ${year} but its address is ` +
          `/achievements/${a.fileSlug}/ — rename the file to match, or visitors ` +
          `get a link that disagrees with the page.`
      );
    });
  }

  eleventyConfig.addCollection("achievements", function (collectionApi) {
    warnOnNearMissNames(collectionApi);
    warnOnSlugYearMismatch(collectionApi);
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

  // ---------------------------------------------------------------------------
  // "Upcoming Events" has to mean upcoming.
  //
  // This collection was previously unfiltered, so an event stayed under the
  // heading "Upcoming Events" forever — the page would have been advertising
  // an October 2026 workshop as upcoming in 2028, and the only way to clear it
  // was for somebody to notice and delete the entry by hand. Nobody was ever
  // going to notice, because the people who run the site already know the
  // event happened.
  //
  // The cutoff is the START of today in UTC, not "now": an event today is still
  // upcoming for the whole of that day, which is what someone checking the site
  // on the morning of an event expects to see. UTC matches the calendar-day
  // handling documented further down — dates from the CMS are days, not
  // instants — and matches the timezone CI builds run in.
  // ---------------------------------------------------------------------------
  function startOfTodayUTC() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  eleventyConfig.addCollection("events", function (collectionApi) {
    const cutoff = startOfTodayUTC();
    const events = collectionApi
      .getFilteredByGlob("src/events/*.md")
      .filter((e) => {
        const d = new Date(e.data.date);
        // An entry with an unreadable date is kept rather than silently
        // dropped — a visible wrong date gets fixed, a vanished event doesn't.
        if (isNaN(d.getTime())) return true;
        return d.getTime() >= cutoff;
      })
      .sort((a, b) => {
        return new Date(a.data.date) - new Date(b.data.date);
      });
    // An event whose Time text can't be parsed still gets a calendar button —
    // it just becomes an all-day entry. That is a quiet downgrade, so say so
    // at build time; otherwise the only symptom is a calendar entry with no
    // hours, which nobody notices until they miss the event.
    events.forEach((e) => {
      if (e.data.time && !parseEventTime(e.data.time)) {
        console.warn(
          `[ghpls] ${e.inputPath}: could not read a start time from "${e.data.time}" — ` +
            "its Add to Calendar entry will be an all-day event. " +
            'Use a form like "5:00 PM - 7:00 PM".'
        );
      }
    });
    return events;
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

  // The Mini Moot is the internal, Guelph-Humber-only counterpart to the GH
  // Cup and runs the same way, so it keeps its own winners and videos rather
  // than sharing the GH Cup's — mixing them would misreport who won what.
  eleventyConfig.addCollection("minimootWinners", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/minimoot-winners/*.md").sort((a, b) => {
      return (b.data.year || 0) - (a.data.year || 0);
    });
  });

  eleventyConfig.addCollection("minimootVideos", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/minimoot-videos/*.md").sort((a, b) => {
      return (b.data.year || 0) - (a.data.year || 0);
    });
  });

  eleventyConfig.addCollection("team", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/team/*.md").sort((a, b) => {
      return (a.data.order || 99) - (b.data.order || 99);
    });
  });

  // ---------------------------------------------------------------------------
  // Dates are CALENDAR DAYS, not instants — read this before changing anything
  // below.
  //
  // The CMS writes `date: 2026-10-20` (datetime widget, `time_format: false`),
  // and `new Date("2026-10-20")` parses that as UTC midnight. Reading it back
  // with local getters — `.getDate()`, `toLocaleDateString()` — therefore
  // returns the PREVIOUS day anywhere west of Greenwich. That is not
  // hypothetical: an event dated 2026-10-20 rendered as "OCT 19" on a local
  // build in Toronto (UTC-4) while rendering "OCT 20" on the live site, because
  // GitHub Actions builds in UTC. The bug was invisible in production purely
  // because of where the build happens.
  //
  // "October 20th" is a calendar day the society picked, not a moment in time,
  // so every read below uses UTC getters to get that day back out unchanged.
  // Do not swap these for local getters or bare toLocaleDateString().
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function calendarParts(date) {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
  }

  eleventyConfig.addFilter("dateFormat", function (date) {
    const p = calendarParts(date);
    if (!p) return "";
    return `${MONTHS_SHORT[p.m]} ${p.d}, ${p.y}`;
  });

  eleventyConfig.addFilter("monthShort", function (date) {
    const p = calendarParts(date);
    if (!p) return "";
    return MONTHS_SHORT[p.m].toUpperCase();
  });

  eleventyConfig.addFilter("dayNum", function (date) {
    const p = calendarParts(date);
    if (!p) return "";
    return p.d;
  });

  // YYYY-MM-DD, for <lastmod> in the sitemap and <time datetime> attributes.
  eleventyConfig.addFilter("isoDate", function (date) {
    const p = calendarParts(date);
    if (!p) return "";
    return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
  });

  // ---------------------------------------------------------------------------
  // CSS values that come from the CMS.
  //
  // Focal points are written straight into a style attribute
  // (`object-position: {{ photoPosition }}`). Nunjucks escapes the value for
  // HTML, which stops an editor breaking OUT of the attribute — but it does
  // nothing about the value being read as CSS, and CSS needs no quotes or angle
  // brackets to be dangerous. A photoPosition of
  //
  //     center; background: url(https://example.com/track.gif)
  //
  // is HTML-safe, survives escaping unchanged, and adds a third-party request
  // to the page. (The CSP would block that particular one, but relying on a
  // second control to cover a hole in the first is how holes stay open.)
  //
  // Only editors can set these values, so this is defence in depth rather than
  // a live hole — but the whole point of the CMS is that people who are not
  // developers type into it, including a future exec who pastes something odd.
  // Anything that isn't recognisably a position falls back to `center`.
  // ---------------------------------------------------------------------------
  const CSS_POSITION_RE =
    /^(?:(?:-?\d+(?:\.\d+)?(?:%|px)?|left|right|top|bottom|center)\s*){1,2}$/i;

  eleventyConfig.addFilter("cssPosition", function (value, fallback) {
    const v = String(value == null ? "" : value).trim();
    if (!v) return fallback || "center";
    return CSS_POSITION_RE.test(v) ? v : fallback || "center";
  });

  // object-fit is a short closed set, so it is checked against that set rather
  // than a pattern.
  const CSS_FITS = ["cover", "contain", "fill", "none", "scale-down"];
  eleventyConfig.addFilter("cssFit", function (value, fallback) {
    const v = String(value == null ? "" : value).trim().toLowerCase();
    return CSS_FITS.indexOf(v) !== -1 ? v : fallback || "cover";
  });

  // A zoom factor is a number, and an unreasonable one is a typo.
  eleventyConfig.addFilter("cssZoom", function (value) {
    const n = parseFloat(value);
    if (isNaN(n) || n <= 1) return null;
    return Math.min(n, 4).toFixed(3).replace(/\.?0+$/, "");
  });

  // ---------------------------------------------------------------------------
  // Blank-line-separated prose from a CMS textarea, rendered as paragraphs.
  //
  // This replaces `{{ text | replace("\n\n", "</p><p>") | safe }}`, which had
  // to mark the whole value safe — handing every editor the ability to put raw
  // HTML on the page, and turning any stray "<" they typed into broken markup.
  // Here the text is escaped first and the tags are added afterwards, so the
  // paragraphs work and the content stays inert.
  // ---------------------------------------------------------------------------
  eleventyConfig.addFilter("paragraphs", function (text) {
    const s = String(text == null ? "" : text);
    if (!s.trim()) return "";
    const escape = (t) =>
      t
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    return s
      .split(/\r?\n\s*\r?\n/)
      .map((para) => para.trim())
      .filter(Boolean)
      .map((para) => `<p>${escape(para).replace(/\r?\n/g, "<br>")}</p>`)
      .join("");
  });

  // ---------------------------------------------------------------------------
  // "Add to Calendar" support
  //
  // The CMS stores an event's time as FREE TEXT ("5:00 PM - 7:00 PM"), because
  // that is what execs were already typing and changing it to structured
  // start/end fields would invalidate every existing entry and make them
  // re-enter data. So the text is parsed here, and — this is the important part
  // — an event whose time can't be parsed still gets a working calendar entry:
  // it falls back to an ALL-DAY event on the right date rather than no button
  // or, far worse, a button that files the event at the wrong hour. A build
  // warning names any event that took the fallback, so a typo surfaces at build
  // time instead of in somebody's calendar.
  //
  // Times are written as "floating" (no timezone, no trailing Z). Every client
  // then reads 5pm as 5pm in the reader's own zone, which is the right answer
  // for a campus society whose attendees are all in the same place. Attaching
  // an explicit TZID would need a full VTIMEZONE block that some clients reject.
  function parseEventTime(timeText) {
    if (!timeText) return null;
    const text = String(timeText).trim();
    if (!text) return null;

    // One matcher for "5pm", "5 PM", "5:00 PM" and 24-hour "17:00".
    const ONE = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi;
    const found = [];
    let m;
    while ((m = ONE.exec(text)) !== null) {
      let hour = parseInt(m[1], 10);
      const minute = m[2] ? parseInt(m[2], 10) : 0;
      const mer = m[3] ? m[3].toLowerCase().replace(/\./g, "") : null;
      if (hour > 23 || minute > 59) continue;
      if (mer === "pm" && hour < 12) hour += 12;
      if (mer === "am" && hour === 12) hour = 0;
      // A bare 1–12 with no am/pm anywhere in the string is ambiguous ("5 - 7"
      // could be either). Rather than guess, drop it and let the event fall
      // back to all-day, which is never wrong by twelve hours.
      if (!mer && !/[ap]\.?m\.?/i.test(text) && hour < 8) continue;
      found.push({ hour, minute });
    }
    if (found.length === 0) return null;

    // A trailing "pm" often governs an earlier bare hour: "5 - 7 PM".
    if (found.length >= 2 && /[ap]\.?m\.?\s*$/i.test(text)) {
      const last = found[found.length - 1];
      const first = found[0];
      if (last.hour >= 12 && first.hour < 12 && first.hour < last.hour - 12 + 1) {
        first.hour += 12;
      }
    }

    const start = found[0];
    let end = found.length > 1 ? found[1] : null;
    if (!end) {
      // Only a start time was given. One hour is a stated assumption, not a
      // fact about the event — see the CMS hint asking for a range.
      end = { hour: (start.hour + 1) % 24, minute: start.minute };
    }
    return { start, end };
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // Local-date arithmetic on the calendar day, kept in UTC so it can't drift.
  function shiftDay(parts, days) {
    const d = new Date(Date.UTC(parts.y, parts.m, parts.d));
    d.setUTCDate(d.getUTCDate() + days);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
  }

  function calendarStamps(date, timeText) {
    const p = calendarParts(date);
    if (!p) return null;
    const day = `${p.y}${pad(p.m + 1)}${pad(p.d)}`;
    const t = parseEventTime(timeText);

    if (!t) {
      // All-day. DTEND is exclusive in iCalendar, so it is the NEXT day —
      // without the +1 the event disappears from some clients entirely.
      const next = shiftDay(p, 1);
      return {
        allDay: true,
        parsedTime: false,
        icsStart: day,
        icsEnd: `${next.y}${pad(next.m + 1)}${pad(next.d)}`,
        googleStart: day,
        googleEnd: `${next.y}${pad(next.m + 1)}${pad(next.d)}`
      };
    }

    // An end earlier than the start means it ran past midnight.
    const endsNextDay =
      t.end.hour < t.start.hour ||
      (t.end.hour === t.start.hour && t.end.minute <= t.start.minute);
    const endParts = endsNextDay ? shiftDay(p, 1) : p;
    const endDay = `${endParts.y}${pad(endParts.m + 1)}${pad(endParts.d)}`;

    const startStamp = `${day}T${pad(t.start.hour)}${pad(t.start.minute)}00`;
    const endStamp = `${endDay}T${pad(t.end.hour)}${pad(t.end.minute)}00`;
    return {
      allDay: false,
      parsedTime: true,
      icsStart: startStamp,
      icsEnd: endStamp,
      googleStart: startStamp,
      googleEnd: endStamp
    };
  }

  eleventyConfig.addFilter("calendarStamps", function (date, timeText) {
    return calendarStamps(date, timeText);
  });

  // The whole .ics body is assembled here rather than in a Nunjucks template.
  // RFC 5545 requires CRLF line endings and 75-octet line folding, neither of
  // which survives contact with template whitespace control — a stray blank
  // line or a bare LF makes strict parsers (Outlook especially) reject the
  // file outright, and the failure shows up as "nothing happens when I tap
  // the button" rather than as an error.
  function icsEscape(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function icsFold(line) {
    const text = String(line == null ? "" : line);
    if (text.length <= 75) return text;
    let out = text.slice(0, 75);
    let rest = text.slice(75);
    while (rest.length > 74) {
      out += "\r\n " + rest.slice(0, 74);
      rest = rest.slice(74);
    }
    return rest ? out + "\r\n " + rest : out;
  }

  eleventyConfig.addFilter("icsForEvent", function (event, slug) {
    const stamps = calendarStamps(event.date, event.time);
    if (!stamps) return "";

    const dtstart = stamps.allDay
      ? `DTSTART;VALUE=DATE:${stamps.icsStart}`
      : `DTSTART:${stamps.icsStart}`;
    const dtend = stamps.allDay
      ? `DTEND;VALUE=DATE:${stamps.icsEnd}`
      : `DTEND:${stamps.icsEnd}`;

    // DTSTAMP must be a UTC instant. Fixed to the event's own date rather than
    // build time so rebuilding doesn't churn the file on every deploy.
    const p = calendarParts(event.date);
    const dtstamp = `${p.y}${pad(p.m + 1)}${pad(p.d)}T000000Z`;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Guelph-Humber Pre-Law Society//Events//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${slug}@guelph-humber-pre-law-society`,
      `DTSTAMP:${dtstamp}`,
      dtstart,
      dtend,
      `SUMMARY:${icsEscape(event.title)}`
    ];
    if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
    lines.push("END:VEVENT", "END:VCALENDAR");

    return lines.map(icsFold).join("\r\n") + "\r\n";
  });

  eleventyConfig.addFilter("googleCalendarUrl", function (event) {
    const stamps = calendarStamps(event.date, event.time);
    if (!stamps) return "";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title || "Event"
    });
    if (event.description) params.set("details", event.description);
    if (event.location) params.set("location", event.location);
    // `dates` is appended by hand: URLSearchParams percent-encodes the "/"
    // separator to %2F, and Google's documented form uses a literal slash.
    // The two stamps are digits and "T" only, so there is nothing to escape.
    return (
      "https://calendar.google.com/calendar/render?" +
      params.toString() +
      `&dates=${stamps.googleStart}/${stamps.googleEnd}`
    );
  });

  // Builds the competitions / team placements / individual achievements shown
  // on an exec's profile page from two sources:
  //   1. Auto-pulled — cross-references the member's name against the
  //      achievements collection, so an exec never has to re-enter data that
  //      already lives on the achievement entry and it can't drift out of sync.
  //   2. Manual — the three optional lists an exec can fill in on their own CMS
  //      entry. Useful for anything not tracked as a GHPLS achievement (an
  //      outside competition, a pre-GHPLS award, a placement recorded under a
  //      different spelling of their name).
  // Filling a section in by hand REPLACES the auto-pulled version of that one
  // section, so an exec can curate what their profile shows without it being
  // silently topped back up. Sections left empty still fill themselves in, and
  // `manualOnly` on the member suppresses the auto side across all three.
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

    // Which bucket a result belongs in is a question about the *kind* of result,
    // not how many people won it — a jointly-won award like "Best Skeleton
    // Arguments" is still an award, not a round the team advanced to. Editors
    // settle it outright with `type` on the result; the keyword match is only
    // the guess for when they haven't.
    const PLACEMENT_RE = /champions?|winners?|finalists?|runners?[-\s]?up|\d+(?:st|nd|rd|th)\s+place/i;
    function isPlacement(r) {
      const t = (r.type || "").trim().toLowerCase();
      if (t === "placement") return true;
      if (t === "award") return false;
      return PLACEMENT_RE.test(r.award || "");
    }

    // A section the exec filled in by hand is theirs alone — the auto-pull stays
    // out of it rather than merging extra rows back in behind them.
    function filledIn(rows) {
      return Array.isArray(rows) && rows.length > 0;
    }
    const manualWins = {
      competitions: filledIn(m.competitions),
      teamPlacements: filledIn(m.teamPlacements),
      individualAchievements: filledIn(m.individualAchievements),
    };

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
        if (!manualWins.competitions) {
          pushUnique(record.competitions, { competition: d.competition, year: d.year, date: d.date, slug: a.fileSlug });
        }
        matchedResults.forEach(function (r) {
          const bucket = isPlacement(r) ? "teamPlacements" : "individualAchievements";
          if (manualWins[bucket]) return;
          pushUnique(record[bucket], { competition: d.competition, year: d.year, date: d.date, slug: a.fileSlug, award: r.award });
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
