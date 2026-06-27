/* GHPLS CMS enhancements: drag-to-position focal point + live "how it looks" preview.
 *
 * Served same-origin from /admin/ (passthrough-copied by Eleventy), so it is as
 * reliable as admin/index.html itself. Everything is wrapped in try/catch and
 * feature-detected: if anything is missing, we bail out quietly and the CMS
 * falls back to its normal behaviour rather than showing a blank panel. */
(function () {
  "use strict";

  var CMS = window.CMS;
  var h = window.h;
  var createClass = window.createClass;

  if (!CMS || !h || !createClass) {
    // Decap globals not available — do nothing, leave the stock CMS untouched.
    return;
  }

  // --- helpers ------------------------------------------------------------

  // Map the old keyword values (center/top/...) to X%,Y% so existing content
  // keeps working when we switch the widget over.
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
    if (m) {
      return [clamp(parseFloat(m[1])), clamp(parseFloat(m[2]))];
    }
    return [50, 50];
  }

  function clamp(n) {
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

  // --- focal-point control widget ----------------------------------------

  var FocalControl = createClass({
    onPointer: function (e, isDown) {
      if (isDown === true) this._drag = true;
      if (isDown === false) { this._drag = false; return; }
      if (!this._drag) return;
      if (!this._pad) return;
      var r = this._pad.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = clamp(((e.clientX - r.left) / r.width) * 100);
      var y = clamp(((e.clientY - r.top) / r.height) * 100);
      this.props.onChange(formatPosition(x, y));
      if (e.preventDefault) e.preventDefault();
    },

    render: function () {
      var self = this;
      var xy = parsePosition(this.props.value);
      var field = this.props.field;
      var imageField =
        (field && field.get && field.get("image_field")) || "photo";

      var path =
        this.props.entry && this.props.entry.getIn
          ? this.props.entry.getIn(["data", imageField])
          : null;
      var src = assetUrl(this.props.getAsset, path);

      var padStyle = {
        position: "relative",
        width: "100%",
        maxWidth: "440px",
        height: "240px",
        borderRadius: "8px",
        border: "1px solid #d6d9e0",
        background: src
          ? "#0f1830 url(" + src + ") center/contain no-repeat"
          : "repeating-conic-gradient(#eef0f4 0% 25%, #f7f8fa 0% 50%) 50% / 24px 24px",
        cursor: "crosshair",
        userSelect: "none",
        touchAction: "none"
      };

      var dotStyle = {
        position: "absolute",
        left: xy[0] + "%",
        top: xy[1] + "%",
        width: "18px",
        height: "18px",
        marginLeft: "-9px",
        marginTop: "-9px",
        borderRadius: "50%",
        background: "#e8a87c",
        border: "3px solid #fff",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.4)",
        pointerEvents: "none"
      };

      var crossH = {
        position: "absolute", left: 0, right: 0, top: xy[1] + "%",
        height: "1px", background: "rgba(232,168,124,0.5)", pointerEvents: "none"
      };
      var crossV = {
        position: "absolute", top: 0, bottom: 0, left: xy[0] + "%",
        width: "1px", background: "rgba(232,168,124,0.5)", pointerEvents: "none"
      };

      var pad = h(
        "div",
        {
          ref: function (el) { self._pad = el; },
          style: padStyle,
          onMouseDown: function (e) { self.onPointer(e, true); self.onPointer(e); },
          onMouseMove: function (e) { self.onPointer(e); },
          onMouseUp: function (e) { self.onPointer(e, false); },
          onMouseLeave: function (e) { self.onPointer(e, false); }
        },
        [
          h("div", { key: "ch", style: crossH }),
          h("div", { key: "cv", style: crossV }),
          h("div", { key: "dot", style: dotStyle })
        ]
      );

      var hint = h(
        "p",
        {
          style: {
            margin: "8px 0 0",
            fontSize: "12px",
            color: "#5b6472",
            lineHeight: 1.4
          }
        },
        src
          ? "Drag the dot to choose what part of the photo stays in view. (" +
            formatPosition(xy[0], xy[1]) + ")"
          : "Upload a photo above, then drag here to position it. (" +
            formatPosition(xy[0], xy[1]) + ")"
      );

      return h(
        "div",
        { className: this.props.classNameWrapper },
        [h("div", { key: "pad", style: { padding: "4px 0" } }, pad),
         h("div", { key: "hint" }, hint)]
      );
    }
  });

  var FocalPreview = createClass({
    render: function () {
      return h("div", {}, this.props.value || "center");
    }
  });

  try {
    CMS.registerWidget("focal-point", FocalControl, FocalPreview);
  } catch (e) {}

  // --- live "how it looks on the site" preview pane -----------------------

  function makePreview(opts) {
    return createClass({
      render: function () {
        var data = this.props.entry.get("data");
        var path = data.get(opts.field);
        var pos = data.get("photoPosition") || "center";
        var fit = opts.fitField
          ? data.get(opts.fitField) || opts.defaultFit
          : opts.defaultFit;
        var zoom = parseFloat(data.get("photoZoom"));
        if (isNaN(zoom) || zoom < 1) zoom = 1;
        var src = assetUrl(this.props.getAsset, path);

        var frameOuter = {
          width: opts.w + "px",
          height: opts.h + "px",
          borderRadius: opts.radius,
          overflow: "hidden",
          border: "1px solid #e3e6ec",
          background: "#f1f2f5",
          boxShadow: "0 4px 18px rgba(0,0,0,0.08)"
        };

        var inner;
        if (src) {
          inner = h("img", {
            src: src,
            style: {
              width: "100%",
              height: "100%",
              objectFit: fit,
              objectPosition: pos,
              transform: zoom !== 1 ? "scale(" + zoom + ")" : "none",
              transformOrigin: pos,
              display: "block",
              background: "#0f1830"
            }
          });
        } else {
          inner = h(
            "div",
            {
              style: {
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9aa1ad",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif"
              }
            },
            "No photo selected yet"
          );
        }

        var label = h(
          "div",
          {
            style: {
              fontSize: "12px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#e8a87c",
              fontWeight: 700,
              marginBottom: "8px",
              fontFamily: "Inter, sans-serif"
            }
          },
          "Preview — how this photo appears on the site"
        );

        var caption = h(
          "div",
          {
            style: {
              marginTop: "10px",
              fontSize: "12px",
              color: "#5b6472",
              fontFamily: "Inter, sans-serif"
            }
          },
          "Fit: " + fit + "  ·  Focus: " + pos +
            (zoom !== 1 ? "  ·  Zoom: " + zoom + "x" : "") +
            (opts.note ? "  ·  " + opts.note : "")
        );

        return h(
          "div",
          {
            style: {
              padding: "24px",
              fontFamily: "Inter, sans-serif",
              color: "#1a2744"
            }
          },
          [
            h("div", { key: "l" }, label),
            h("div", { key: "f", style: frameOuter }, inner),
            h("div", { key: "c" }, caption)
          ]
        );
      }
    });
  }

  var PREVIEWS = [
    { name: "achievements", field: "photo", w: 380, h: 200, radius: "12px",
      fitField: "photoSize", defaultFit: "cover", note: "Achievements card" },
    { name: "events", field: "photo", w: 360, h: 180, radius: "8px",
      fitField: "photoSize", defaultFit: "cover", note: "Upcoming event" },
    { name: "past-events", field: "photo", w: 380, h: 200, radius: "12px",
      fitField: "photoSize", defaultFit: "cover", note: "Past event" },
    { name: "ghcup-winners", field: "photo", w: 300, h: 220, radius: "12px",
      fitField: "photoSize", defaultFit: "cover", note: "GH Cup winner" },
    { name: "photos", field: "image", w: 240, h: 240, radius: "8px",
      fitField: null, defaultFit: "cover", note: "Gallery (square)" },
    { name: "team", field: "photo", w: 140, h: 140, radius: "50%",
      fitField: null, defaultFit: "cover", note: "Team headshot" }
  ];

  PREVIEWS.forEach(function (opts) {
    try {
      CMS.registerPreviewTemplate(opts.name, makePreview(opts));
    } catch (e) {}
  });
})();
