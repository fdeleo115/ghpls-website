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

  // Source panel geometry. These are a MAXIMUM width and a reference aspect
  // ratio, not fixed pixels: on a phone the editor column is narrower than
  // 320px, so the box is `width: 100%; max-width: BOX_W` with the BOX_W:BOX_H
  // ratio pinned.
  //
  // Nothing measures the rendered width. That is deliberate. The crop overlay
  // and focal dot are drawn in render(), while the pointer is mapped from the
  // box's live bounding rect in onPointer() — so any width the render side
  // stores separately is a second source of truth that can fall out of step
  // with the first, and when it does, the exec drags to one spot and the site
  // crops to another with nothing on screen to indicate it. Keeping the ratio
  // constant and emitting every overlay offset as a PERCENTAGE makes the
  // rendered geometry width-independent, so the two can never disagree.
  var BOX_W = 320, BOX_H = 220;

  var FocalControl = createClass({
    getInitialState: function () {
      return { naturalW: 0, naturalH: 0 };
    },

    componentDidMount: function () {
      // The widget's DOM root (needed to resolve nested sibling paths) only
      // exists after the first commit, so re-render once now that it's ready.
      if (this.forceUpdate) this.forceUpdate();
    },

    onImgLoad: function (e) {
      try {
        this.setState({
          naturalW: e.target.naturalWidth || 0,
          naturalH: e.target.naturalHeight || 0
        });
      } catch (err) {}
    },

    // Pointer Events cover mouse, touch and pen with one code path, and
    // setPointerCapture keeps a drag alive when the finger leaves the box.
    // The widget previously bound onMouseDown/Move/Up only: iOS synthesises a
    // click from a tap but does NOT synthesise a mousemove stream from a
    // drag, so "drag to position" did nothing at all on a phone — the gesture
    // scrolled the page instead. Mouse handlers are kept below as a fallback
    // for browsers without PointerEvent, and are suppressed when pointer
    // events are available so a single drag can't be applied twice.
    hasPointerEvents: function () {
      return typeof window !== "undefined" && !!window.PointerEvent;
    },

    onPointerDown: function (e) {
      if (this._box && e.pointerId != null && this._box.setPointerCapture) {
        try { this._box.setPointerCapture(e.pointerId); } catch (err) {}
      }
      this.onPointer(e, true);
      this.onPointer(e);
    },

    onPointerUp: function (e) {
      if (this._box && e.pointerId != null && this._box.releasePointerCapture) {
        try { this._box.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      this.onPointer(e, false);
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

      // Everything below is laid out in PERCENTAGES of the box, never pixels.
      // The box has a fixed aspect ratio and a fluid width, so the letterbox
      // geometry is identical at every width — which means the overlay never
      // has to know how wide the box actually is on screen. See the note on
      // BOX_W: an earlier attempt stored a measured pixel width in state, and
      // any staleness in that number put the crop rectangle and the focal dot
      // somewhere other than where the pointer mapping (which reads the live
      // rect) thought they were.
      var content = containRect(BOX_W, BOX_H, nw, nh);
      var pctX = function (px) { return (px / BOX_W) * 100 + "%"; };
      var pctY = function (px) { return (px / BOX_H) * 100 + "%"; };

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
            style: { position: "absolute", left: pctX(content.left), top: pctY(content.top),
              width: pctX(crop.left * content.width), height: pctY(content.height),
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "dim-r",
            style: { position: "absolute", left: pctX(content.left + (crop.left + crop.width) * content.width),
              top: pctY(content.top),
              width: pctX(Math.max(0, content.width - (crop.left + crop.width) * content.width)),
              height: pctY(content.height),
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "dim-t",
            style: { position: "absolute", left: pctX(content.left + crop.left * content.width), top: pctY(content.top),
              width: pctX(crop.width * content.width), height: pctY(crop.top * content.height),
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "dim-b",
            style: { position: "absolute", left: pctX(content.left + crop.left * content.width),
              top: pctY(content.top + (crop.top + crop.height) * content.height),
              width: pctX(crop.width * content.width),
              height: pctY(Math.max(0, content.height - (crop.top + crop.height) * content.height)),
              background: "rgba(0,0,0,0.55)", pointerEvents: "none" }
          }));
          overlayEls.push(h("div", {
            key: "crop-rect",
            style: { position: "absolute",
              left: pctX(content.left + crop.left * content.width),
              top: pctY(content.top + crop.top * content.height),
              width: pctX(crop.width * content.width),
              height: pctY(crop.height * content.height),
              border: "2px solid #e8a87c", boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
              pointerEvents: "none" }
          }));
        }
      }

      var dotLeft = content.left + (xy[0] / 100) * content.width;
      var dotTop = content.top + (xy[1] / 100) * content.height;
      overlayEls.push(h("div", {
        key: "ch",
        style: { position: "absolute", left: pctX(content.left), right: pctX(BOX_W - content.left - content.width),
          top: pctY(dotTop), height: "1px", background: "rgba(232,168,124,0.6)", pointerEvents: "none" }
      }));
      overlayEls.push(h("div", {
        key: "cv",
        style: { position: "absolute", top: pctY(content.top), bottom: pctY(BOX_H - content.top - content.height),
          left: pctX(dotLeft), width: "1px", background: "rgba(232,168,124,0.6)", pointerEvents: "none" }
      }));
      overlayEls.push(h("div", {
        key: "dot",
        style: { position: "absolute", left: pctX(dotLeft), top: pctY(dotTop),
          width: "16px", height: "16px", marginLeft: "-8px", marginTop: "-8px", borderRadius: "50%",
          background: "#e8a87c", border: "3px solid #fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.4)", pointerEvents: "none" }
      }));

      var usePointer = self.hasPointerEvents();
      var boxHandlers = usePointer
        ? {
            onPointerDown: function (e) { if (!src) return; self.onPointerDown(e); },
            onPointerMove: function (e) { self.onPointer(e); },
            onPointerUp: function (e) { self.onPointerUp(e); },
            onPointerCancel: function (e) { self.onPointerUp(e); }
          }
        : {
            onMouseDown: function (e) { if (!src) return; self.onPointer(e, true); self.onPointer(e); },
            onMouseMove: function (e) { self.onPointer(e); },
            onMouseUp: function (e) { self.onPointer(e, false); },
            onMouseLeave: function (e) { self.onPointer(e, false); }
          };

      var box = h(
        "div",
        Object.assign({
          ref: function (el) { self._box = el; },
          style: {
            // Shrink to the editor column on a phone, never past BOX_W on
            // desktop. The aspect ratio is pinned to BOX_W:BOX_H so the
            // percentage overlay geometry above holds at any width — do not
            // replace `aspectRatio` with a fixed `height`, that would change
            // the letterboxing as the box narrows and put the crop rectangle
            // in the wrong place. `touchAction: none` stops iOS treating the
            // drag as a page scroll; without it the gesture never reaches the
            // handler at all.
            position: "relative", width: "100%", maxWidth: BOX_W + "px",
            aspectRatio: BOX_W + " / " + BOX_H,
            borderRadius: "8px", border: "1px solid #d6d9e0", overflow: "hidden",
            background: src ? "#0f1830" : "repeating-conic-gradient(#eef0f4 0% 25%, #f7f8fa 0% 50%) 50% / 24px 24px",
            cursor: src ? "crosshair" : "default", userSelect: "none", touchAction: "none"
          }
        }, boxHandlers),
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
        // Wording avoids "on the right": the result panels wrap below the
        // photo on a phone, where the row runs out of width.
        src
          ? (fit === "contain"
              ? "Fit is set to “show entire photo” — nothing is cropped, so dragging only shifts the photo inside its frame. (" + formatPosition(xy[0], xy[1]) + ")"
              : "Drag anywhere on the photo to move the focal point. The shaded area is cropped away in the first preview. (" + formatPosition(xy[0], xy[1]) + ")")
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
  // Loads the site's actual stylesheet into the preview iframe and renders the
  // site's real markup/classes, so card widths, photo heights, aspect ratios
  // and the navy header overlay all come from the one source of truth
  // (src/styles.css) instead of being re-guessed here.
  //
  // A second registerPreviewStyle call used to load Google Fonts separately.
  // That was needed when styles.css only referenced font-family names and
  // expected something else to have already loaded the actual font files.
  // Now that styles.css carries its own @font-face rules pointing at
  // /assets/fonts/ (same-origin, since /admin/ is served from this site), the
  // single call above already brings the fonts with it — a second fetch of
  // the same families from a different source would be redundant at best and
  // is exactly the kind of stale duplicate that's easy to miss when a site's
  // font strategy changes later. If you ever reintroduce a Google Fonts URL
  // here, also add it back to ADMIN_CSP in worker.js — the CSP no longer
  // allows fonts.googleapis.com/fonts.gstatic.com.
  try {
    CMS.registerPreviewStyle("/styles.css");
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

  function competitionGalleryPreview() {
    return createClass({
      render: function () {
        var gallery = this.props.entry.get("data").get("gallery");
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
    });
  }

  var PagePreviews = {
    "page-headers": createClass({
      render: function () {
        var data = this.props.entry.get("data");
        // Keep this list in step with the "Page Header Photos" fields in
        // admin/config.yml — a page missing here silently gets no preview.
        var pages = ["about", "contact", "materials", "achievements", "events", "photos", "ghcup", "minimoot"];
        var labels = { about: "About", contact: "Contact", materials: "Materials", achievements: "Achievements",
          events: "Events", photos: "Photo Gallery", ghcup: "The GH Cup", minimoot: "The Mini Moot" };
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
    // The GH Cup and Mini Moot entries carry the same Competition Gallery
    // field, so they share one preview. Both pages' banner photos are
    // previewed by "page-headers" above, not here.
    "ghcup-page": competitionGalleryPreview(),
    "minimoot-page": competitionGalleryPreview(),
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
