/* GHPLS CMS enhancements: an accurate drag-to-crop focal-point widget, plus a
 * "how it looks on the site" preview pane built from the site's real CSS.
 *
 * Served same-origin from /admin/ (passthrough-copied by Eleventy), so it is as
 * reliable as admin/index.html itself. Everything is wrapped in try/catch and
 * feature-detected: if anything is missing, we bail out quietly and the CMS
 * falls back to its normal behaviour rather than showing a blank panel.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE LOOKS THE WAY IT DOES (read this before changing it)
 * ---------------------------------------------------------------------------
 * Decap CMS gives a custom widget NO information about where it lives in the
 * entry's data — verified empirically against decap-cms 3.1.1 (the version
 * pinned in admin/index.html): a widget's props contain no `path`, an empty
 * `parentIds`, and a `forID` that is never actually applied to the DOM. So the
 * naive `entry.getIn(["data", "photo"])` lookup only ever finds TOP-LEVEL
 * fields — it silently returns undefined for anything nested in an `object`
 * widget (Page Header Photos) or a `list` widget (GH Cup Competition Gallery),
 * which is why those fields' focal-point editor used to show nothing at all.
 *
 * What DOES work: container fields (object/list) emit a DOM id shaped
 * "<fieldName>-field-<n>". Walking up from a widget's own root DOM node and
 * collecting those ids reconstructs its data path, and DOM containment
 * resolves list indices for free. See resolveFieldPath() below. This is
 * coupled to decap-cms's internal DOM structure, so it fails soft (falls back
 * to a flat top-level path, which is exactly the old behaviour and still
 * correct for every non-nested field) and should be re-verified with a throw-
 * away test-repo-backend harness if the decap-cms version pin ever changes.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var CMS = window.CMS;
  var h = window.h;
  var createClass = window.createClass;

  if (!CMS || !h || !createClass) {
    // Decap globals not available — do nothing, leave the stock CMS untouched.
    return;
  }

  // === position helpers ====================================================

  var KEYWORDS = {
    "center": [50, 50],
    "top": [50, 0],
    "bottom": [50, 100],
    "left": [0, 50],
    "right": [100, 50],
    "top left": [0, 0],
    "top right": [100, 0],
    "bottom left": [0, 100],
    "bottom right": [100, 100]
  };

  function parsePosition(value) {
    if (!value) return [50, 50];
    var v = String(value).trim().toLowerCase();
    if (KEYWORDS[v]) return KEYWORDS[v].slice();
    var m = v.match(/(-?\d+(?:\.\d+)?)%?\s+(-?\d+(?:\.\d+)?)%?/);
    if (m) return [clampPct(parseFloat(m[1])), clampPct(parseFloat(m[2]))];
    return [50, 50];
  }

  function clampPct(n) {
    if (isNaN(n)) return 50;
    return Math.max(0, Math.min(100, n));
  }

  function formatPosition(x, y) {
    return Math.round(x) + "% " + Math.round(y) + "%";
  }

  function assetUrl(getAsset, path) {
    if (!path || !getAsset) return null;
    try {
      var a = getAsset(path);
      return a ? String(a) : null;
    } catch (e) {
      return null;
    }
  }

  // === nested-field DOM path resolver (see header comment) ================

  function listItemsOf(container) {
    // Keep only the OUTERMOST item wrappers — the "ListItem" class fragment
    // also matches nested descendants inside each item, and double-counting
    // them shifts every index (observed: index 2 instead of 1 for the second
    // item) — verified against decap-cms 3.1.1's rendered DOM.
    var cands = [];
    try {
      cands = Array.prototype.slice.call(container.querySelectorAll('[class*="ListItem"]'));
    } catch (e) {
      return [];
    }
    return cands.filter(function (c) {
      return !cands.some(function (o) { return o !== c && o.contains(c); });
    });
  }

  function resolveFieldPath(rootEl, leafName) {
    try {
      var segs = [];
      var node = rootEl;
      var guard = 0;
      while (node && node !== document.body && guard < 40) {
        guard++;
        var parent = node.parentElement;
        if (!parent) break;
        if (parent.id && /-field-\d+$/.test(parent.id)) {
          var name = parent.id.replace(/-field-\d+$/, "");
          var items = listItemsOf(parent);
          if (items.length) {
            var mine = -1;
            for (var i = 0; i < items.length; i++) {
              if (items[i].contains(rootEl)) { mine = i; break; }
            }
            if (mine > -1) segs.unshift(mine);
          }
          segs.unshift(name);
        }
        node = parent;
      }
      segs.push(leafName);
      return segs;
    } catch (e) {
      return [leafName];
    }
  }

  // Reads any sibling field (an image path, a select value, a number...) that
  // lives at the same nesting level as `rootEl`, by name. Works for top-level
  // fields too — resolveFieldPath degrades to just [fieldName] when there's
  // no ancestor container id, which is the same lookup the old code always did.
  function readAt(entry, rootEl, fieldName) {
    if (!fieldName || !entry || !entry.getIn) return undefined;
    try {
      var path = rootEl ? resolveFieldPath(rootEl, fieldName) : [fieldName];
      var v = entry.getIn(["data"].concat(path));
      if (typeof v === "undefined" && path.length > 1) {
        // DOM assumptions didn't hold for some reason — fail soft to a flat
        // top-level guess rather than showing nothing.
        v = entry.getIn(["data", fieldName]);
      }
      return v;
    } catch (e) {
      try { return entry.getIn(["data", fieldName]); } catch (e2) { return undefined; }
    }
  }

  // === shape geometry =======================================================
  // A field's `shapes` config (custom YAML key, same mechanism as the existing
  // `image_field`) lists every real place on the site a photo gets cropped
  // into. Each axis is either a fixed pixel number, or driven by a sibling
  // select field (e.g. Achievements' Card Width / Photo Height dropdowns) —
  // see admin/config.yml for the concrete values, sourced from src/styles.css.

  function resolveAxis(axis, entry, rootEl) {
    if (!axis) return 1;
    if (!axis.by) return axis.value || 1;
    var raw = readAt(entry, rootEl, axis.by);
    var key = (typeof raw === "undefined" || raw === null) ? undefined : String(raw);
    var mapped = key && axis.values ? axis.values[key] : undefined;
    return mapped || axis.default || axis.value || 1;
  }

  function resolveShape(shape, entry, rootEl) {
    var axes = shape.axes || [{ value: 4 }, { value: 3 }];
    var w = resolveAxis(axes[0], entry, rootEl);
    var hgt = resolveAxis(axes[1], entry, rootEl);
    return {
      label: shape.label || "Preview",
      ratio: (w > 0 && hgt > 0) ? (w / hgt) : (4 / 3),
      circle: shape.shape === "circle",
      overlay: shape.overlay || null,
      approx: !!shape.approx
    };
  }

  // === object-fit math ======================================================
  // Same formulas the browser itself uses for object-fit — used to (a) map a
  // pointer position back to a percentage OF THE IMAGE rather than of the
  // padded box (fixes the old widget's coordinate bug with any letterboxed
  // photo), and (b) draw the "what actually survives" crop-rectangle overlay.

  function containRect(boxW, boxH, naturalW, naturalH) {
    if (!boxW || !boxH || !naturalW || !naturalH) {
      return { left: 0, top: 0, width: boxW || 0, height: boxH || 0 };
    }
    var imgRatio = naturalW / naturalH;
    var boxRatio = boxW / boxH;
    var rw, rh, ox, oy;
    if (imgRatio > boxRatio) {
      rw = boxW; rh = boxW / imgRatio; ox = 0; oy = (boxH - rh) / 2;
    } else {
      rh = boxH; rw = boxH * imgRatio; oy = 0; ox = (boxW - rw) / 2;
    }
    return { left: ox, top: oy, width: rw, height: rh };
  }

  // Given the natural image size and a target crop ratio, returns the crop
  // window in 0..1 fractions of the FULL natural image (object-fit: cover math).
  function coverCropFrac(naturalW, naturalH, targetRatio, focalXY) {
    if (!naturalW || !naturalH || !targetRatio) return null;
    var imageRatio = naturalW / naturalH;
    var fracW, fracH;
    if (imageRatio > targetRatio) { fracW = targetRatio / imageRatio; fracH = 1; }
    else { fracW = 1; fracH = imageRatio / targetRatio; }
    var leftFrac = fracW < 1 ? (focalXY[0] / 100) * (1 - fracW) : 0;
    var topFrac = fracH < 1 ? (focalXY[1] / 100) * (1 - fracH) : 0;
    return { left: leftFrac, top: topFrac, width: fracW, height: fracH };
  }

  // === the focal-point crop tool ===========================================

  var BOX_W = 320, BOX_H = 220; // fixed pixel source panel — see render()

  var FocalControl = createClass({
    getInitialState: function () {
      return { naturalW: 0, naturalH: 0 };
    },

    componentDidMount: function () {
      var self = this;
      // The widget's DOM root (needed to resolve nested sibling paths) only
      // exists after the first commit, so re-render once now that it's ready.
      if (this.forceUpdate) this.forceUpdate();
      this._onResize = function () { if (self._img && self.forceUpdate) self.forceUpdate(); };
      try { window.addEventListener("resize", this._onResize); } catch (e) {}
    },

    componentWillUnmount: function () {
      try { window.removeEventListener("resize", this._onResize); } catch (e) {}
    },

    onImgLoad: function (e) {
      try {
        this.setState({
          naturalW: e.target.naturalWidth || 0,
          naturalH: e.target.naturalHeight || 0
        });
      } catch (err) {}
    },

    onPointer: function (e, isDown) {
      if (isDown === true) { this._drag = true; }
      if (isDown === false) { this._drag = false; return; }
      if (!this._drag || !this._box) return;
      var nw = this.state.naturalW, nh = this.state.naturalH;
      if (!nw || !nh) return;
      var boxRect = this._box.getBoundingClientRect();
      var content = containRect(boxRect.width, boxRect.height, nw, nh);
      if (!content.width || !content.height) return;
      var x = clampPct(((e.clientX - boxRect.left - content.left) / content.width) * 100);
      var y = clampPct(((e.clientY - boxRect.top - content.top) / content.height) * 100);
      this.props.onChange(formatPosition(x, y));
      if (e.preventDefault) e.preventDefault();
    },

    render: function () {
      var self = this;
      var props = this.props;
      var xy = parsePosition(props.value);

      var fieldJS = {};
      try { fieldJS = (props.field && props.field.toJS) ? props.field.toJS() : {}; } catch (e) {}

      var imageFieldName = fieldJS.image_field || "photo";
      var fitFieldName = fieldJS.fitField;
      var zoomFieldName = fieldJS.zoomField;
      var shapeDefs = (fieldJS.shapes && fieldJS.shapes.length)
        ? fieldJS.shapes
        : [{ label: "Preview", axes: [{ value: 4 }, { value: 3 }] }];

      var rootEl = this._root || null;
      var imgPath = readAt(props.entry, rootEl, imageFieldName);
      var src = assetUrl(props.getAsset, imgPath);

      var fitRaw = fitFieldName ? readAt(props.entry, rootEl, fitFieldName) : undefined;
      var fit = fitRaw || "cover";
      var zoomRaw = zoomFieldName ? readAt(props.entry, rootEl, zoomFieldName) : undefined;
      var zoom = parseFloat(zoomRaw);
      if (isNaN(zoom) || zoom < 1) zoom = 1;

      var nw = this.state.naturalW, nh = this.state.naturalH;
      var content = containRect(BOX_W, BOX_H, nw, nh);

      // --- crop overlay on the source image, using the FIRST declared shape
      // as the representative crop (fields with one shape are exact; fields
      // with several — Achievements, Team — show every shape's true result
      // in the result panels on the right, so this overlay is a guide, not
      // the only source of truth).
      var primaryShape = shapeDefs[0];
      var primaryRatio = null;
      try {
        primaryRatio = resolveShape(primaryShape, props.entry, rootEl).ratio;
      } catch (e) {}

      var overlayEls = [];
      if (src && nw && nh && fit !== "contain" && primaryRatio) {
        var crop = coverCropFrac(nw, nh, primaryRatio, xy);
        if (crop) {
          overlayEls.push(h("div", {
            key: "dim-l",
            style: { position: "absolute", left: content.left + "px", top: content.top + "px",
              width: (crop.left * content.width) + "px", height: content.height + "px",
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "dim-r",
            style: { position: "absolute", left: (content.left + (crop.left + crop.width) * content.width) + "px",
              top: content.top + "px",
              width: Math.max(0, content.width - (crop.left + crop.width) * content.width) + "px",
              height: content.height + "px",
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "dim-t",
            style: { position: "absolute", left: (content.left + crop.left * content.width) + "px", top: content.top + "px",
              width: (crop.width * content.width) + "px", height: (crop.top * content.height) + "px",
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "dim-b",
            style: { position: "absolute", left: (content.left + crop.left * content.width) + "px",
              top: (content.top + (crop.top + crop.height) * content.height) + "px",
              width: (crop.width * content.width) + "px",
              height: Math.max(0, content.height - (crop.top + crop.height) * content.height) + "px",
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "crop-rect",
            style: { position: "absolute",
              left: (content.left + crop.left * content.width) + "px",
              top: (content.top + crop.top * content.height) + "px",
              width: (crop.width * content.width) + "px",
              height: (crop.height * content.height) + "px",
              border: "2px solid #e8a87c", boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
              pointerEvents: "none" }
          }));
        }
      }

      var dotLeft = content.left + (xy[0] / 100) * content.width;
      var dotTop = content.top + (xy[1] / 100) * content.height;
      overlayEls.push(h("div", {
        key: "ch",
        style: { position: "absolute", left: content.left + "px", right: (BOX_W - content.left - content.width) + "px",
          top: dotTop + "px", height: "1px", background: "rgba(232,168,124,0.6)", pointerEvents: "none" }
      }));
      overlayEls.push(h("div", {
        key: "cv",
        style: { position: "absolute", top: content.top + "px", bottom: (BOX_H - content.top - content.height) + "px",
          left: dotLeft + "px", width: "1px", background: "rgba(232,168,124,0.6)", pointerEvents: "none" }
      }));
      overlayEls.push(h("div", {
        key: "dot",
        style: { position: "absolute", left: dotLeft + "px", top: dotTop + "px",
          width: "16px", height: "16px", marginLeft: "-8px", marginTop: "-8px", borderRadius: "50%",
          background: "#e8a87c", border: "3px solid #fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.4)", pointerEvents: "none" }
      }));

      var box = h(
        "div",
        {
          ref: function (el) { self._box = el; },
          style: {
            position: "relative", width: BOX_W + "px", height: BOX_H + "px",
            borderRadius: "8px", border: "1px solid #d6d9e0", overflow: "hidden",
            background: src ? "#0f1830" : "repeating-conic-gradient(#eef0f4 0% 25%, #f7f8fa 0% 50%) 50% / 24px 24px",
            cursor: src ? "crosshair" : "default", userSelect: "none", touchAction: "none"
          },
          onMouseDown: function (e) { if (!src) return; self.onPointer(e, true); self.onPointer(e); },
          onMouseMove: function (e) { self.onPointer(e); },
          onMouseUp: function (e) { self.onPointer(e, false); },
          onMouseLeave: function (e) { self.onPointer(e, false); }
        },
        src
          ? [h("img", {
              key: "img",
              ref: function (el) { self._img = el; },
              src: src,
              onLoad: function (e) { self.onImgLoad(e); },
              style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
                objectFit: "contain", pointerEvents: "none", display: "block" }
            })].concat(overlayEls)
          : []
      );

      var srcHint = h("p", { style: { margin: "8px 0 0", fontSize: "12px", color: "#5b6472", lineHeight: 1.4 } },
        src
          ? (fit === "contain"
              ? "Fit is set to “show entire photo” — nothing is cropped, so dragging only shifts the photo inside its frame. (" + formatPosition(xy[0], xy[1]) + ")"
              : "Drag anywhere on the photo to move the focal point. Shaded area is cropped away for the first preview on the right. (" + formatPosition(xy[0], xy[1]) + ")")
          : "Upload a photo above, then drag here to position it."
      );

      var sourcePanel = h("div", { key: "source", style: { flex: "0 0 auto" } }, [
        h("div", { key: "l", style: labelStyle() }, "Drag to position"),
        box,
        srcHint
      ]);

      // --- result panels: one per declared real-site shape --------------
      var resultPanels = shapeDefs.map(function (shapeDef, i) {
        var shape = resolveShape(shapeDef, props.entry, rootEl);
        var maxDim = 128;
        var rw, rh;
        if (shape.ratio >= 1) { rw = maxDim; rh = maxDim / shape.ratio; }
        else { rh = maxDim; rw = maxDim * shape.ratio; }
        rw = Math.max(24, Math.round(rw));
        rh = Math.max(24, Math.round(rh));

        var frameStyle = {
          width: rw + "px", height: rh + "px",
          borderRadius: shape.circle ? "50%" : "8px",
          overflow: "hidden", position: "relative",
          background: "#0f1830", border: "1px solid #e3e6ec",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)"
        };

        var imgEl = src
          ? h("img", {
              src: src,
              style: {
                width: "100%", height: "100%",
                objectFit: fit,
                objectPosition: formatPosition(xy[0], xy[1]),
                transform: zoom !== 1 ? "scale(" + zoom + ")" : "none",
                transformOrigin: formatPosition(xy[0], xy[1]),
                display: "block"
              }
            })
          : h("div", { style: { width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: "10px" } }, "—");

        var overlay = shape.overlay === "navy"
          ? h("div", { style: { position: "absolute", inset: 0,
              background: "linear-gradient(135deg, rgba(26,39,68,0.90) 0%, rgba(26,39,68,0.78) 100%)" } })
          : null;

        return h("div", { key: "shape" + i, style: { marginBottom: "12px", maxWidth: "180px" } }, [
          h("div", { style: { fontSize: "11px", color: "#1a2744", fontWeight: 600, marginBottom: "6px" } },
            shape.label + (shape.approx ? " ≈" : "")),
          h("div", { style: frameStyle }, overlay ? [imgEl, overlay] : [imgEl])
        ]);
      });

      var resultsPanel = h("div", { key: "results", style: { flex: "1 1 auto", minWidth: "140px" } }, [
        h("div", { style: labelStyle() }, "How it looks on the site"),
        h("div", {}, resultPanels)
      ]);

      return h(
        "div",
        { className: props.classNameWrapper, ref: function (el) { self._root = el; } },
        [h("div", { key: "row", style: { display: "flex", gap: "20px", flexWrap: "wrap", padding: "4px 0" } },
          [sourcePanel, resultsPanel])]
      );
    }
  });

  function labelStyle() {
    return {
      fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase",
      color: "#e8a87c", fontWeight: 700, marginBottom: "8px", fontFamily: "Inter, sans-serif"
    };
  }

  var FocalPreview = createClass({
    render: function () {
      return h("div", {}, this.props.value || "center");
    }
  });

  try {
    CMS.registerWidget("focal-point", FocalControl, FocalPreview);
  } catch (e) {}

  // === "how it looks on the site" — the editor's right-hand preview pane ===
  // Loads the site's actual stylesheet + fonts into the preview iframe and
  // renders the site's real markup/classes, so card widths, photo heights,
  // aspect ratios and the navy header overlay all come from the one source of
  // truth (src/styles.css) instead of being re-guessed here.

  try {
    CMS.registerPreviewStyle("/styles.css");
    CMS.registerPreviewStyle(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap"
    );
  } catch (e) {}

  function paneWrap(children) {
    return h("div", { style: { padding: "16px", fontFamily: "Inter, sans-serif", overflowX: "auto" } }, children);
  }

  function pageHeaderPreview(photoPath, position, getAsset, title) {
    var src = assetUrl(getAsset, photoPath);
    var style = { padding: "48px 0", textAlign: "center", position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, #1a2744 0%, #2a3a5c 100%)" };
    if (src) {
      style.backgroundImage = "url(" + src + ")";
      style.backgroundSize = "cover";
      style.backgroundPosition = position || "center";
    }
    return h("section", { style: style }, [
      src ? h("div", { key: "wash", style: { position: "absolute", inset: 0,
        background: "linear-gradient(135deg, rgba(26,39,68,0.90) 0%, rgba(26,39,68,0.78) 100%)" } }) : null,
      h("div", { key: "content", style: { position: "relative", zIndex: 1 } }, [
        h("h1", { style: { color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: "2.2rem", margin: 0 } }, title)
      ])
    ]);
  }

  var PagePreviews = {
    "page-headers": createClass({
      render: function () {
        var data = this.props.entry.get("data");
        var pages = ["about", "contact", "materials", "achievements", "events", "photos", "ghcup"];
        var labels = { about: "About", contact: "Contact", materials: "Materials", achievements: "Achievements",
          events: "Events", photos: "Photo Gallery", ghcup: "The GH Cup" };
        var self = this;
        return h("div", {}, pages.map(function (p) {
          var entryData = data.get(p);
          var photo = entryData ? entryData.get("photo") : null;
          var pos = entryData ? entryData.get("photoPosition") : null;
          return h("div", { key: p, style: { marginBottom: "4px" } },
            pageHeaderPreview(photo, pos || "center", self.props.getAsset, labels[p] + " page banner"));
        }));
      }
    }),
    "ghcup-page": createClass({
      render: function () {
        var data = this.props.entry.get("data");
        var gallery = data.get("gallery");
        var getAsset = this.props.getAsset;
        if (!gallery || !gallery.size) {
          return paneWrap(h("p", { style: { color: "#6b7280" } }, "No Competition Gallery photos yet."));
        }
        return paneWrap(
          h("div", { className: "photo-gallery", style: { display: "grid",
            gridTemplateColumns: "repeat(3, 110px)", gap: "10px" } },
            gallery.toJS().map(function (shot, i) {
              var src = assetUrl(getAsset, shot.image);
              return h("div", { key: i, className: "photo-card" },
                src ? h("img", { src: src, style: { objectPosition: shot.photoPosition || "center" } }) : null);
            })
          )
        );
      }
    }),
    "materials-page": createClass({
      render: function () {
        var data = this.props.entry.get("data");
        var items = data.get("items");
        if (!items || !items.size) return paneWrap(h("p", { style: { color: "#6b7280" } }, "No materials yet."));
        return paneWrap(
          h("div", { className: "materials-grid", style: { display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 160px)", gap: "16px" } },
            items.toJS().map(function (item, i) {
              return h("div", { key: i, className: "material-card" }, [
                h("h4", { key: "t" }, item.title || "Untitled"),
                h("p", { key: "d" }, item.description || ""),
                item.file
                  ? h("span", { key: "b", className: "btn btn-primary" }, "Download")
                  : h("span", { key: "b", className: "btn btn-outline" }, "Coming Soon")
              ]);
            })
          )
        );
      }
    })
  };

  Object.keys(PagePreviews).forEach(function (name) {
    try { CMS.registerPreviewTemplate(name, PagePreviews[name]); } catch (e) {}
  });

  // --- one real-markup preview per folder collection, sized to the true
  // on-site pixel geometry documented in photo-adjuster-plan.md -------------

  function photoOrEmpty(src, imgProps) {
    if (src) return h("img", Object.assign({ src: src }, imgProps || {}));
    return h("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", color: "#9aa1ad", fontSize: "12px", background: "#f1f2f5" } }, "No photo yet");
  }

  var AchievementsPreview = createClass({
    render: function () {
      var data = this.props.entry.get("data");
      var src = assetUrl(this.props.getAsset, data.get("photo"));
      var pos = data.get("photoPosition") || "center";
      var fit = data.get("photoSize") || "cover";
      var height = data.get("photoHeight") || "medium";
      var wide = data.get("cardWidth") === "wide";
      var zoom = parseFloat(data.get("photoZoom"));
      if (isNaN(zoom) || zoom < 1) zoom = 1;
      // 1152px container content, 24px gap, 2 columns — see photo-adjuster-plan.md.
      var cardW = wide ? 1152 : 564;
      var imgStyle = { objectFit: fit, objectPosition: pos };
      if (zoom !== 1) { imgStyle.transform = "scale(" + zoom + ")"; imgStyle.transformOrigin = pos; }
      return paneWrap(
        h("div", { className: "win-card win-card--has-photo" + (wide ? " win-card--wide" : ""),
          style: { width: cardW + "px" } },
          h("div", { className: "win-card-photo win-card-photo--" + height },
            photoOrEmpty(src, { style: imgStyle }))
        )
      );
    }
  });

  var EventsPreview = createClass({
    render: function () {
      var data = this.props.entry.get("data");
      var src = assetUrl(this.props.getAsset, data.get("photo"));
      var pos = data.get("photoPosition") || "center";
      var fit = data.get("photoSize") || "cover";
      return paneWrap(
        h("div", { className: "schedule-item schedule-item--has-photo", style: { width: "420px", border: "none", padding: 0 } },
          h("div", { className: "schedule-photo" }, photoOrEmpty(src, { style: { objectFit: fit, objectPosition: pos } }))
        )
      );
    }
  });

  var PastEventsPreview = createClass({
    render: function () {
      var data = this.props.entry.get("data");
      var src = assetUrl(this.props.getAsset, data.get("photo"));
      var pos = data.get("photoPosition") || "center";
      var fit = data.get("photoSize") || "cover";
      return paneWrap(
        h("div", { className: "past-event-card", style: { width: "564px" } },
          photoOrEmpty(src, { className: "past-event-img", style: { objectFit: fit, objectPosition: pos } })
        )
      );
    }
  });

  var GhcupWinnersPreview = createClass({
    render: function () {
      var data = this.props.entry.get("data");
      var src = assetUrl(this.props.getAsset, data.get("photo"));
      var pos = data.get("photoPosition") || "center";
      var fit = data.get("photoSize") || "cover";
      var zoom = parseFloat(data.get("photoZoom"));
      if (isNaN(zoom) || zoom < 1) zoom = 1;
      var imgStyle = { objectFit: fit, objectPosition: pos };
      if (zoom !== 1) { imgStyle.transform = "scale(" + zoom + ")"; imgStyle.transformOrigin = pos; }
      // Real .winner-card is a flex row — .winner-info's real content sets the
      // row's height, so the photo column's height is genuinely derived from
      // real layout rather than a guessed pixel number.
      return paneWrap(
        h("div", { className: "winner-card", style: { width: "560px" } }, [
          h("div", { key: "photo", className: "winner-photo" }, photoOrEmpty(src, { style: imgStyle })),
          h("div", { key: "info", className: "winner-info" }, [
            h("div", { key: "y", className: "winner-year" }, data.get("year") || "20XX"),
            h("h3", { key: "t" }, data.get("theme") || "The GH Cup"),
            h("div", { key: "a", className: "winner-award" }, [
              h("span", { key: "b", className: "badge" }, "Winner"),
              h("span", { key: "n", className: "names" }, "Recipient Name")
            ])
          ])
        ])
      );
    }
  });

  var PhotosPreview = createClass({
    render: function () {
      var data = this.props.entry.get("data");
      var src = assetUrl(this.props.getAsset, data.get("image"));
      var pos = data.get("photoPosition") || "center";
      var size = data.get("size") || "normal";
      return paneWrap(
        h("div", { className: "photo-gallery", style: { display: "grid",
          gridTemplateColumns: "repeat(3, 100px)", gridAutoRows: "100px", gap: "10px" } },
          h("div", { className: "photo-card photo-" + size },
            photoOrEmpty(src, { style: { objectPosition: pos } }))
        )
      );
    }
  });

  var TeamPreview = createClass({
    render: function () {
      var data = this.props.entry.get("data");
      var src = assetUrl(this.props.getAsset, data.get("photo"));
      var pos = data.get("photoPosition") || "center";
      return paneWrap(
        h("div", { className: "exec-card-photo" }, photoOrEmpty(src, { style: { objectPosition: pos } }))
      );
    }
  });

  var FOLDER_PREVIEWS = {
    achievements: AchievementsPreview,
    events: EventsPreview,
    "past-events": PastEventsPreview,
    "ghcup-winners": GhcupWinnersPreview,
    photos: PhotosPreview,
    team: TeamPreview
  };

  Object.keys(FOLDER_PREVIEWS).forEach(function (name) {
    try { CMS.registerPreviewTemplate(name, FOLDER_PREVIEWS[name]); } catch (e) {}
  });
})();
