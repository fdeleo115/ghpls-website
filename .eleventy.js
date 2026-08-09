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

  eleventyConfig.addCollection("achievements", function (collectionApi) {
    warnOnNearMissNames(collectionApi);
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
    const events = collectionApi.getFilteredByGlob("src/events/*.md").sort((a, b) => {
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
