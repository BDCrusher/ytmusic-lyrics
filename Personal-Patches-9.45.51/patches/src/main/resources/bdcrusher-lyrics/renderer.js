(() => {
  // web/node_modules/@braccato/core/dist/util.js
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function positiveModulo(value, divisor) {
    return (value % divisor + divisor) % divisor;
  }
  function isGecko() {
    return typeof CSS !== "undefined" && CSS.supports("-moz-appearance", "none");
  }
  function roundedMs(value) {
    return Math.round(value * 10) / 10;
  }
  function toMs(cssDuration) {
    if (!cssDuration)
      return 0;
    if (cssDuration.endsWith("ms")) {
      return parseFloat(cssDuration.slice(0, -2));
    } else if (cssDuration.endsWith("s")) {
      return parseFloat(cssDuration.slice(0, -1)) * 1e3;
    }
    return 0;
  }
  function getRelativeBounds(parent, child) {
    const parentBound = parent.getBoundingClientRect();
    const childBound = child.getBoundingClientRect();
    return new DOMRect(childBound.x - parentBound.x, childBound.y - parentBound.y, childBound.width, childBound.height);
  }
  function getRelativeLayoutBounds(parent, child) {
    let x = 0;
    let y = 0;
    let element = child;
    while (element && element !== parent) {
      x += element.offsetLeft;
      y += element.offsetTop;
      element = element.offsetParent;
    }
    if (element !== parent) {
      return getRelativeBounds(parent, child);
    }
    return new DOMRect(x, y, Math.max(child.offsetWidth, child.scrollWidth), Math.max(child.offsetHeight, child.scrollHeight));
  }

  // web/node_modules/@braccato/core/dist/engine/motionCurves.js
  var TOLERANCE_PX = 0.1;
  var LONGEST_STOP_SPAN_MS = 100;
  var SHORTEST_STOP_SPAN_MS = 1;
  function curveEndMs(curve) {
    return curve.startMs + curve.durationMs;
  }
  function isRunningAt(curve, timeMs) {
    return curve.startMs <= timeMs && timeMs < curveEndMs(curve);
  }
  function offsetAt(curves, timeMs, easingOf) {
    return curves.filter((curve) => isRunningAt(curve, timeMs)).reduce((sum, curve) => sum + easedOffset(curve, easingOf(curve.easing), timeMs), 0);
  }
  function bakeMotion(curves, nowMs, easingOf) {
    if (curves.length === 1)
      return exactly(curves[0]);
    const endsMs = [...new Set(curves.map(curveEndMs))].sort((a, b) => a - b);
    const stops = [];
    let fromMs = nowMs;
    for (const toMs2 of endsMs) {
      const running = curves.filter((curve) => curve.startMs <= fromMs && curveEndMs(curve) >= toMs2).map((curve) => ({ curve, easing: easingOf(curve.easing) }));
      const path = (timeMs) => {
        let offsetPx = 0;
        for (const { curve, easing: easing2 } of running)
          offsetPx += easedOffset(curve, easing2, timeMs);
        return offsetPx;
      };
      const fromPx = path(fromMs);
      if (stops.at(-1)?.offsetPx !== fromPx)
        stops.push({ timeMs: fromMs, offsetPx: fromPx });
      const spans = Math.ceil((toMs2 - fromMs) / LONGEST_STOP_SPAN_MS);
      for (let span = 1; span <= spans; span++) {
        const spanEndMs = fromMs + (toMs2 - fromMs) * span / spans;
        appendStops(path, stops[stops.length - 1], { timeMs: spanEndMs, offsetPx: path(spanEndMs) }, stops);
      }
      fromMs = toMs2;
    }
    const durationMs = endsMs[endsMs.length - 1] - nowMs;
    const fullScalePx = Math.max(...stops.map((stop) => Math.abs(stop.offsetPx))) || 1;
    const easing = `linear(${stops.map(({ timeMs, offsetPx }) => `${rounded(offsetPx / fullScalePx)} ${rounded(100 * (timeMs - nowMs) / durationMs)}%`).join(", ")})`;
    return {
      keyframes: [
        { translate: translateOf(0), easing },
        { translate: translateOf(fullScalePx), easing: "linear" }
      ],
      startMs: nowMs,
      durationMs
    };
  }
  function appendStops(path, from, to, stops) {
    const middleMs = (from.timeMs + to.timeMs) / 2;
    const middle = { timeMs: middleMs, offsetPx: path(middleMs) };
    const chordPx = (from.offsetPx + to.offsetPx) / 2;
    if (Math.abs(middle.offsetPx - chordPx) <= TOLERANCE_PX || to.timeMs - from.timeMs <= SHORTEST_STOP_SPAN_MS) {
      stops.push(to);
      return;
    }
    appendStops(path, from, middle, stops);
    appendStops(path, middle, to, stops);
  }
  function exactly(curve) {
    return {
      keyframes: [
        { translate: translateOf(curve.fromPx), easing: curve.easing },
        { translate: translateOf(curve.toPx), easing: curve.endEasing }
      ],
      startMs: curve.startMs,
      durationMs: curve.durationMs
    };
  }
  function easedOffset(curve, easing, timeMs) {
    const progress = curve.durationMs > 0 ? Math.min(1, (timeMs - curve.startMs) / curve.durationMs) : 1;
    return curve.fromPx + (curve.toPx - curve.fromPx) * easing(progress);
  }
  function translateOf(offsetPx) {
    return `0px ${Math.round(offsetPx * 1e3) / 1e3}px`;
  }
  function rounded(value) {
    return Math.round(value * 1e6) / 1e6;
  }

  // web/node_modules/@braccato/core/dist/engine/elementMotion.js
  var EASING_TABLE_STEPS = 128;
  function timelineNow(engine) {
    const timelineTime = engine.document.timeline?.currentTime;
    return typeof timelineTime === "number" ? timelineTime : Date.now();
  }
  function addElementCurve(engine, element, curve) {
    const nowMs = timelineNow(engine);
    playCurves(engine, element, [...runningCurves(engine, element, nowMs), curve], nowMs);
  }
  function removeElementCurves(engine, element, kind) {
    const nowMs = timelineNow(engine);
    const running = runningCurves(engine, element, nowMs);
    if (!running.some((curve) => curve.kind === kind))
      return;
    playCurves(engine, element, running.filter((curve) => curve.kind !== kind), nowMs);
  }
  function stopElementMotion(engine, element) {
    const motion = engine.elementMotions.get(element);
    if (!motion)
      return;
    engine.elementMotions.delete(element);
    motion.animation.cancel();
    for (const curve of motion.curves)
      curve.onEnd?.();
  }
  function stopAllElementMotion(engine) {
    for (const element of [...engine.elementMotions.keys()])
      stopElementMotion(engine, element);
  }
  function elementMotionOffsetPx(engine, element) {
    const motion = engine.elementMotions.get(element);
    return motion ? offsetAt(motion.curves, timelineNow(engine), easingLookup(engine)) : 0;
  }
  function runningCurves(engine, element, nowMs) {
    return (engine.elementMotions.get(element)?.curves ?? []).filter((curve) => curveEndMs(curve) > nowMs);
  }
  function playCurves(engine, element, curves, nowMs) {
    const previous = engine.elementMotions.get(element);
    for (const curve of previous?.curves ?? [])
      if (!curves.includes(curve))
        curve.onEnd?.();
    if (curves.length === 0) {
      engine.elementMotions.delete(element);
      previous?.animation.cancel();
      return;
    }
    const baked = bakeMotion(curves, nowMs, easingLookup(engine));
    const animation = element.animate(baked.keyframes, { duration: baked.durationMs, easing: "linear", fill: "none" });
    animation.startTime = baked.startMs;
    const motion = { animation, curves };
    engine.elementMotions.set(element, motion);
    previous?.animation.cancel();
    const settle = () => {
      if (engine.elementMotions.get(element) !== motion)
        return;
      engine.elementMotions.delete(element);
      for (const curve of curves)
        curve.onEnd?.();
    };
    animation.addEventListener("finish", settle, { once: true });
    animation.addEventListener("cancel", settle, { once: true });
  }
  function easingLookup(engine) {
    return (easing) => {
      let table = engine.easingTables.get(easing);
      if (!table) {
        table = sampleEasing(engine, easing);
        engine.easingTables.set(easing, table);
      }
      return tableEasing(table);
    };
  }
  function tableEasing(table) {
    return (progress) => {
      const position = Math.min(Math.max(progress, 0), 1) * EASING_TABLE_STEPS;
      const step = Math.min(Math.floor(position), EASING_TABLE_STEPS - 1);
      return table[step] + (table[step + 1] - table[step]) * (position - step);
    };
  }
  function sampleEasing(engine, easing) {
    const table = Float64Array.from({ length: EASING_TABLE_STEPS + 1 }, (_, step) => step / EASING_TABLE_STEPS);
    const { KeyframeEffect: Effect, Animation: Player } = engine.window;
    if (typeof Effect !== "function" || typeof Player !== "function")
      return table;
    try {
      const effect = new Effect(null, null, { duration: EASING_TABLE_STEPS, easing, fill: "both" });
      const player = new Player(effect, null);
      for (let step = 0; step <= EASING_TABLE_STEPS; step++) {
        player.currentTime = step;
        table[step] = effect.getComputedTiming().progress ?? table[step];
      }
    } catch (error) {
      engine.host.log("Line motion easing could not be sampled, so it is treated as linear", easing, error);
    }
    return table;
  }

  // web/node_modules/@braccato/core/dist/themeSettings.js
  var keyToSettingMap = /* @__PURE__ */ new Map();
  var Setting = class {
    type;
    value;
    defaultValue;
    requiresLyricReload;
    manuallySet = false;
    constructor(type, value, defaultValue, requiresLyricReload) {
      this.type = type;
      this.value = value;
      this.defaultValue = defaultValue;
      this.requiresLyricReload = requiresLyricReload;
    }
    getNumberValue() {
      return this.value;
    }
    getBooleanValue() {
      return this.value;
    }
    getStringValue() {
      return this.value;
    }
    isManuallySet() {
      return this.manuallySet;
    }
    setManuallySet(manuallySet) {
      this.manuallySet = manuallySet;
    }
  };
  var THEME_COMMENT_PATTERN = /\/\*([\s\S]*?)\*\//g;
  var THEME_SETTING_PATTERN = /(blyrics-[\w-]+)\s*=\s*([^;]+);/g;
  function parseThemeConfig(css) {
    const config2 = /* @__PURE__ */ new Map();
    for (const [, comment] of css.matchAll(THEME_COMMENT_PATTERN)) {
      for (const [, key, value] of comment.matchAll(THEME_SETTING_PATTERN)) {
        config2.set(key, value.trim());
      }
    }
    return config2;
  }
  function registerThemeSetting(key, defaultValue, requiresLyricReload = false) {
    let type = typeof defaultValue;
    if (type !== "number" && type !== "boolean" && type !== "string") {
      throw new Error("Invalid type for theme setting");
    }
    let setting = new Setting(type, defaultValue, defaultValue, requiresLyricReload);
    keyToSettingMap.set(key, setting);
    return setting;
  }
  function setThemeSettings(map) {
    let needsLyricReload = false;
    map.forEach((value, key) => {
      let setting = keyToSettingMap.get(key);
      if (setting) {
        let lastValue = setting.value;
        if (setting.type === "number") {
          const parsed = parseFloat(value);
          if (isNaN(parsed)) {
            setting.value = setting.defaultValue;
            setting.setManuallySet(false);
          } else {
            setting.value = parsed;
            setting.setManuallySet(true);
          }
        } else if (setting.type === "boolean") {
          setting.value = value.toLowerCase() === "true";
          setting.setManuallySet(true);
        } else {
          setting.value = value;
          setting.setManuallySet(true);
        }
        if (setting.requiresLyricReload && lastValue !== setting.value) {
          needsLyricReload = true;
        }
      }
    });
    for (const [key, setting] of keyToSettingMap.entries()) {
      if (!map.has(key) && setting.value !== setting.defaultValue) {
        setting.value = setting.defaultValue;
        setting.setManuallySet(false);
        if (setting.requiresLyricReload) {
          needsLyricReload = true;
        }
      } else if (!map.has(key)) {
        setting.setManuallySet(false);
      }
    }
    return needsLyricReload;
  }
  function lyricBuildSettingsKey() {
    const values = [];
    for (const [key, setting] of keyToSettingMap) {
      if (setting.requiresLyricReload)
        values.push(`${key}=${String(setting.value)}`);
    }
    return values.join(";");
  }

  // web/node_modules/@braccato/core/dist/engine/lineScrollStyle.js
  var FALLBACK_DURATION_MS = 750;
  var DEFAULT_TRAILING_DURATION = "calc(750ms + log(var(--blyrics-line-scroll-abs-relative-index) + 2, 2.71828) * 80ms + (var(--blyrics-line-scroll-abs-relative-index) + 1) * 20ms)";
  function themeSetting(property, defaultValue) {
    return [property, registerThemeSetting(property.slice(2), defaultValue)];
  }
  var THEME_SETTINGS = [
    themeSetting("--blyrics-line-scroll-duration", DEFAULT_TRAILING_DURATION),
    themeSetting("--blyrics-line-scroll-above-duration", "calc(750ms + min(var(--blyrics-line-scroll-abs-relative-index), 6) * 20ms)"),
    themeSetting("--blyrics-line-scroll-active-duration", ""),
    themeSetting("--blyrics-line-scroll-below-duration", DEFAULT_TRAILING_DURATION),
    themeSetting("--blyrics-line-scroll-timing-function", "var(--blyrics-lyric-scroll-timing-function)"),
    themeSetting("--blyrics-line-scroll-start-easing", "var(--blyrics-line-scroll-timing-function)"),
    themeSetting("--blyrics-line-scroll-end-easing", "linear"),
    themeSetting("--blyrics-line-scroll-above-start-easing", ""),
    themeSetting("--blyrics-line-scroll-active-start-easing", ""),
    themeSetting("--blyrics-line-scroll-below-start-easing", ""),
    themeSetting("--blyrics-line-scroll-above-end-easing", ""),
    themeSetting("--blyrics-line-scroll-active-end-easing", ""),
    themeSetting("--blyrics-line-scroll-below-end-easing", ""),
    themeSetting("--blyrics-line-scroll-translate-y-start", "var(--blyrics-line-scroll-delta-px)"),
    themeSetting("--blyrics-line-scroll-translate-y-end", "0px"),
    themeSetting("--blyrics-line-scroll-above-translate-y-start", ""),
    themeSetting("--blyrics-line-scroll-active-translate-y-start", ""),
    themeSetting("--blyrics-line-scroll-below-translate-y-start", ""),
    themeSetting("--blyrics-line-scroll-above-translate-y-end", ""),
    themeSetting("--blyrics-line-scroll-active-translate-y-end", ""),
    themeSetting("--blyrics-line-scroll-below-translate-y-end", "")
  ];
  var TRANSLATE_SETTINGS = THEME_SETTINGS.filter(([property]) => property.includes("translate-y")).map(([, setting]) => setting);
  var INDEX_PROPERTY = "--blyrics-line-scroll-index";
  var ACTIVE_INDEX_PROPERTY = "--blyrics-line-scroll-active-index";
  var RELATIVE_INDEX_PROPERTY = "--blyrics-line-scroll-relative-index";
  var ABS_RELATIVE_INDEX_PROPERTY = "--blyrics-line-scroll-abs-relative-index";
  var SIDE_PROPERTY = "--blyrics-line-scroll-side";
  var DELTA_PROPERTY = "--blyrics-line-scroll-delta-px";
  var DISTANCE_PROPERTY = "--blyrics-line-scroll-distance-px";
  var INLINE_PROPERTIES = [
    INDEX_PROPERTY,
    ACTIVE_INDEX_PROPERTY,
    RELATIVE_INDEX_PROPERTY,
    ABS_RELATIVE_INDEX_PROPERTY,
    SIDE_PROPERTY,
    DELTA_PROPERTY,
    DISTANCE_PROPERTY,
    ...THEME_SETTINGS.map(([property]) => property)
  ];
  function themeOverridesScrollTranslate() {
    return TRANSLATE_SETTINGS.some((setting) => setting.isManuallySet());
  }
  function writeScrollVariables(lineElement, variables) {
    const style = lineElement.style;
    style.setProperty(INDEX_PROPERTY, String(variables.index));
    style.setProperty(ACTIVE_INDEX_PROPERTY, String(variables.activeIndex));
    style.setProperty(RELATIVE_INDEX_PROPERTY, String(variables.relativeIndex));
    style.setProperty(ABS_RELATIVE_INDEX_PROPERTY, String(Math.abs(variables.relativeIndex)));
    style.setProperty(SIDE_PROPERTY, variables.side);
    style.setProperty(DELTA_PROPERTY, `${variables.deltaPx}px`);
    style.setProperty(DISTANCE_PROPERTY, `${Math.abs(variables.deltaPx)}px`);
    for (const [property, setting] of THEME_SETTINGS) {
      const value = setting.getStringValue().trim();
      if (value)
        style.setProperty(property, value);
      else
        style.removeProperty(property);
    }
  }
  function clearScrollVariables(lineElement) {
    for (const property of INLINE_PROPERTIES)
      lineElement.style.removeProperty(property);
  }
  function scrollVariable(name, side, differential, fallback) {
    const shared = `var(--blyrics-line-scroll-${name}, ${fallback})`;
    return differential ? `var(--blyrics-line-scroll-${side}-${name}, ${shared})` : shared;
  }
  function resolveScrollTimings(engine, lines, { lineScroll }) {
    const differential = lineScroll.differentialEffects;
    const durations = batchProbeComputedStyle(engine, lines, "transition-duration", (line) => scrollVariable("duration", line.side, differential, `${FALLBACK_DURATION_MS}ms`), (style) => {
      const durationMs = toMs(style.transitionDuration.split(",")[0].trim());
      return durationMs > 0 ? durationMs : FALLBACK_DURATION_MS;
    });
    const easingsAt = (keyframe) => batchProbeComputedStyle(engine, lines, "transition-timing-function", (line) => scrollVariable(`${keyframe}-easing`, line.side, differential, `var(--blyrics-line-scroll-timing-function, ${lineScroll.easing})`), (style) => style.transitionTimingFunction.trim() || lineScroll.easing);
    const startEasings = easingsAt("start");
    const endEasings = easingsAt("end");
    return lines.map((_, index) => ({
      durationMs: durations[index],
      startEasing: startEasings[index],
      endEasing: endEasings[index]
    }));
  }
  function resolveThemedTranslates(engine, lines, { lineScroll }) {
    const translatesAt = (keyframe) => batchProbeComputedStyle(engine, lines, "translate", (line) => {
      const fallback = keyframe === "start" ? "var(--blyrics-line-scroll-delta-px, 0px)" : "0px";
      return `0 ${scrollVariable(`translate-y-${keyframe}`, line.side, lineScroll.differentialEffects, fallback)}`;
    }, (style) => style.translate).map((translate, index) => translateYPx(translate, lines[index].heightPx));
    return { start: translatesAt("start"), end: translatesAt("end") };
  }
  function translateYPx(translate, heightPx) {
    const value = translate.trim();
    if (value === "" || value === "none")
      return 0;
    const [, y = "0px"] = value.match(/calc\([^)]*\)|\S+/g) ?? [];
    const terms = y.replace(/^calc\((.*)\)$/, "$1").replace(/\s+-\s+/g, " + -").split(/\s+\+\s+/);
    let px = 0;
    for (const term of terms) {
      const length = term.trim().match(/^(-?[\d.]+(?:e-?\d+)?)(px|%)?$/);
      if (!length || length[2] === void 0 && Number(length[1]) !== 0)
        return null;
      px += length[2] === "%" ? Number(length[1]) * heightPx / 100 : Number(length[1]);
    }
    return px;
  }
  function batchProbeComputedStyle(engine, lines, property, probeValue, readValue) {
    const previous = lines.map(({ lineElement }) => ({
      value: lineElement.style.getPropertyValue(property),
      priority: lineElement.style.getPropertyPriority(property)
    }));
    for (const line of lines)
      line.lineElement.style.setProperty(property, probeValue(line), "important");
    const values = lines.map((line) => readValue(engine.window.getComputedStyle(line.lineElement)));
    lines.forEach(({ lineElement }, index) => {
      const { value, priority } = previous[index];
      if (value)
        lineElement.style.setProperty(property, value, priority);
      else
        lineElement.style.removeProperty(property);
    });
    return values;
  }

  // web/node_modules/@braccato/core/dist/engine/lineScroll.js
  var SCROLL_PREPARE_LEAD_MS = 120;
  var LINE_SCROLL_WILL_CHANGE_VALUE = "transform, translate";
  var SAME_SCROLL_TOLERANCE_PX = 2;
  function commitOrPrepareLineScroll(engine, request) {
    const pending = engine.pendingLineScroll;
    if (pending && pendingScrollMatches(pending, request)) {
      engine.pendingLineScroll = null;
      startLineScroll(engine, pending.plan);
      return;
    }
    dropPendingLineScroll(engine);
    const plan = planLineScroll(engine, request);
    if (plan)
      startLineScroll(engine, plan);
  }
  function prepareUpcomingLineScroll(engine, request) {
    const pending = engine.pendingLineScroll;
    if (pending && pendingScrollMatches(pending, request))
      return;
    dropPendingLineScroll(engine);
    const plan = planLineScroll(engine, request);
    if (!plan)
      return;
    const { activeLine, fromScrollTop, toScrollTop } = request;
    engine.pendingLineScroll = { plan, activeLineElement: activeLine.lyricElement, fromScrollTop, toScrollTop };
  }
  function dropPendingLineScroll(engine) {
    const pending = engine.pendingLineScroll;
    if (!pending)
      return;
    for (const line of pending.plan)
      releaseLine(engine, line.lineElement, line.token);
    engine.pendingLineScroll = null;
  }
  function pendingScrollMatches(pending, request) {
    return pending.activeLineElement === request.activeLine.lyricElement && Math.abs(pending.fromScrollTop - request.fromScrollTop) <= SAME_SCROLL_TOLERANCE_PX && Math.abs(pending.toScrollTop - request.toScrollTop) <= SAME_SCROLL_TOLERANCE_PX;
  }
  function planLineScroll(engine, request) {
    const { lines, config: config2 } = request;
    const activeIndex = lines.findIndex((line) => line.lyricElement === request.activeLine.lyricElement);
    if (!config2.enabled.scroll || activeIndex < 0)
      return null;
    const deltaPx = request.toScrollTop - request.fromScrollTop;
    const translateThemed = themeOverridesScrollTranslate();
    const targets = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!isLineVisibleDuringScroll(line, request.fromScrollTop, request.toScrollTop, request.viewportHeight))
        continue;
      const lineElement = line.lyricElement;
      const relativeIndex = index - activeIndex;
      const side = scrollSide(relativeIndex, deltaPx);
      const timingKey = `${side}|${Math.abs(relativeIndex)}`;
      const cachedTiming = engine.cachedLineScrollTiming.get(timingKey);
      targets.push({
        lineElement,
        side,
        heightPx: line.height,
        token: claimLine(engine, lineElement),
        relativeIndex,
        timingKey,
        cachedTiming
      });
      if (translateThemed || !cachedTiming) {
        writeScrollVariables(lineElement, { index, activeIndex, relativeIndex, side, deltaPx });
      }
    }
    const timings = getOrResolveScrollTimings(engine, targets, config2);
    const translates = translateThemed ? resolveThemedTranslates(engine, targets, config2) : null;
    const staggerScale = staggerScaleKeepingLinesApart(lines, activeIndex, Math.abs(deltaPx), request.continuesEngineScroll);
    const activeDurationMs = timings[targets.findIndex((target) => target.relativeIndex === 0)]?.durationMs;
    return targets.map(({ lineElement, side, token }, index) => {
      const timing = timings[index];
      return {
        lineElement,
        side,
        token,
        durationMs: activeDurationMs === void 0 ? timing.durationMs : activeDurationMs + (timing.durationMs - activeDurationMs) * staggerScale,
        startEasing: timing.startEasing,
        endEasing: timing.endEasing,
        startPx: translates?.start[index] ?? deltaPx,
        endPx: translates?.end[index] ?? 0
      };
    });
  }
  function scrollSide(relativeIndex, deltaPx) {
    const scrollsUp = deltaPx < 0;
    if (relativeIndex < 0)
      return scrollsUp ? "below" : "above";
    if (relativeIndex > 0)
      return scrollsUp ? "above" : "below";
    return "active";
  }
  function getOrResolveScrollTimings(engine, targets, config2) {
    const misses = targets.filter((target) => target.cachedTiming === void 0);
    const resolved = /* @__PURE__ */ new Map();
    if (misses.length > 0) {
      resolveScrollTimings(engine, misses, config2).forEach((timing, index) => {
        engine.cachedLineScrollTiming.set(misses[index].timingKey, timing);
        resolved.set(misses[index], timing);
      });
    }
    return targets.map((target) => target.cachedTiming ?? resolved.get(target));
  }
  function staggerScaleKeepingLinesApart(lines, activeIndex, distancePx, continuesEngineScroll) {
    if (continuesEngineScroll)
      return 1;
    const active2 = lines[activeIndex];
    const neighbourSteps = [lines[activeIndex - 1], lines[activeIndex + 1]].filter((neighbour) => neighbour !== void 0).map((neighbour) => Math.abs(active2.position - neighbour.position));
    const stepPx = neighbourSteps.length > 0 ? Math.min(...neighbourSteps) : active2.height;
    return Math.min(1, stepPx / distancePx);
  }
  function startLineScroll(engine, plan) {
    const startMs = timelineNow(engine);
    for (const line of plan) {
      if (!line.lineElement.isConnected || !ownsLine(engine, line.lineElement, line.token))
        continue;
      const scroll = { lineElement: line.lineElement, token: line.token, durationMs: line.durationMs };
      engine.runningLineScrolls.push(scroll);
      addElementCurve(engine, line.lineElement, {
        kind: "scroll",
        startMs,
        durationMs: line.durationMs,
        fromPx: line.startPx,
        toPx: line.endPx,
        easing: line.startEasing,
        endEasing: line.endEasing,
        onEnd: () => endLineScroll(engine, scroll)
      });
    }
  }
  function claimLine(engine, lineElement) {
    const token = ++engine.lineScrollAnimationToken;
    engine.lineScrollElementTokens.set(lineElement, token);
    return token;
  }
  function ownsLine(engine, lineElement, token) {
    return engine.lineScrollElementTokens.get(lineElement) === token;
  }
  function releaseLine(engine, lineElement, token) {
    if (!ownsLine(engine, lineElement, token))
      return;
    clearScrollVariables(lineElement);
    engine.lineScrollElementTokens.delete(lineElement);
  }
  function endLineScroll(engine, scroll) {
    const index = engine.runningLineScrolls.indexOf(scroll);
    if (index !== -1)
      engine.runningLineScrolls.splice(index, 1);
    releaseLine(engine, scroll.lineElement, scroll.token);
  }
  function clearLineScrolls(engine) {
    const scrolledElements = new Set(engine.runningLineScrolls.map((scroll) => scroll.lineElement));
    for (const element of scrolledElements)
      removeElementCurves(engine, element, "scroll");
    for (const scroll of [...engine.runningLineScrolls])
      endLineScroll(engine, scroll);
  }
  function isLineVisibleDuringScroll(line, fromScrollTop, toScrollTop, viewportHeight) {
    const visibleTop = Math.min(fromScrollTop, toScrollTop);
    const visibleBottom = Math.max(fromScrollTop, toScrollTop) + viewportHeight;
    return line.position + line.height >= visibleTop && line.position <= visibleBottom;
  }
  function getLineScrollItems(engine, lines) {
    const trailing = [engine.cachedCreditsItem, engine.cachedFooterItem].filter((item) => item !== null);
    return trailing.length > 0 ? [...lines, ...trailing] : lines;
  }
  function measureTrailingItem(lyricsElement, className) {
    const element = lyricsElement.querySelector(`:scope > .${className}`);
    if (!element)
      return null;
    const bounds = getRelativeLayoutBounds(lyricsElement, element);
    return { lyricElement: element, position: bounds.y, height: bounds.height };
  }

  // web/node_modules/@braccato/core/dist/engine/cssValues.js
  function clearStyleCaches(engine) {
    dropPendingLineScroll(engine);
    engine.cachedDurations.clear();
    engine.cachedCSSValues.clear();
    engine.cachedAnimationSettings = null;
    engine.cachedLineScrollTiming.clear();
  }
  function getCSSValue(engine, lyricsElement, property, fallback) {
    let value = engine.cachedCSSValues.get(property);
    if (value === void 0) {
      value = engine.window.getComputedStyle(lyricsElement).getPropertyValue(property).trim() || fallback;
      engine.cachedCSSValues.set(property, value);
    }
    return value;
  }
  function getCSSDurationInMs(engine, lyricsElement, property) {
    let duration = engine.cachedDurations.get(property);
    if (duration === void 0) {
      duration = toMs(getCSSValue(engine, lyricsElement, property, "0ms"));
      engine.cachedDurations.set(property, duration);
    }
    return duration;
  }
  function getCSSNumber(engine, lyricsElement, property, fallback) {
    const value = Number.parseFloat(getCSSValue(engine, lyricsElement, property, `${fallback}`));
    return Number.isFinite(value) ? value : fallback;
  }
  function createThemeReader(engine, lyricsElement) {
    const string = (property, fallback) => getCSSValue(engine, lyricsElement, property, fallback);
    const number = (property, fallback) => getCSSNumber(engine, lyricsElement, property, fallback);
    return {
      string,
      number,
      durationMs: (property, fallback) => Math.max(toMs(string(property, fallback)), 1),
      fraction: (property, fallback) => clamp(number(property, fallback), 0, 1),
      flag: (property, fallback) => {
        const value = string(property, fallback ? "1" : "0").toLowerCase();
        if (value === "false" || value === "off" || value === "none")
          return false;
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric > 0 : fallback;
      }
    };
  }

  // web/node_modules/@braccato/core/dist/engine/clock.js
  var SMOOTH_PLAYBACK_CLOCK = isGecko();
  var CLOCK_RESYNC_THRESHOLD_S = 0.06;
  var CLOCK_SLEW_PER_S = 0.1;
  var NO_PLAYER_SNAPSHOT = -1;
  var playbackClock = {
    lastTime: 0,
    lastPlayState: false,
    lastEventCreationTime: NO_PLAYER_SNAPSHOT,
    smoothedTime: 0,
    smoothedAt: NO_PLAYER_SNAPSHOT
  };
  function resetPlaybackClock() {
    playbackClock.lastTime = 0;
    playbackClock.lastPlayState = false;
    playbackClock.lastEventCreationTime = NO_PLAYER_SNAPSHOT;
    playbackClock.smoothedAt = NO_PLAYER_SNAPSHOT;
  }
  function smoothedPlaybackTime(previousTime, previousAt, rawTime, now, playbackRate) {
    if (previousAt === NO_PLAYER_SNAPSHOT)
      return rawTime;
    const elapsedS = Math.max(0, now - previousAt) / 1e3;
    const predictedTime = previousTime + elapsedS * playbackRate;
    const errorS = rawTime - predictedTime;
    if (errorS >= 0 || Math.abs(errorS) >= CLOCK_RESYNC_THRESHOLD_S)
      return rawTime;
    return predictedTime + errorS * Math.min(1, elapsedS * CLOCK_SLEW_PER_S);
  }
  var TIME_JUMP_THRESHOLD_S = 0.5;
  function advancePlaybackClock(reportedTimeS, { isPlaying, eventCreationTime, followPausedSeeks }, playbackRate, now) {
    const snapshotGapS = (eventCreationTime - playbackClock.lastEventCreationTime) / 1e3;
    const jumped = Math.abs(reportedTimeS - playbackClock.lastTime - snapshotGapS) > TIME_JUMP_THRESHOLD_S;
    const readsMediaClockDirectly = eventCreationTime === NO_PLAYER_SNAPSHOT;
    const mediaClockRanBackwards = readsMediaClockDirectly && isPlaying && reportedTimeS < playbackClock.lastTime - CLOCK_RESYNC_THRESHOLD_S;
    const seekedWhilePaused = followPausedSeeks && !isPlaying && !playbackClock.lastPlayState && reportedTimeS !== playbackClock.lastTime;
    playbackClock.lastTime = reportedTimeS;
    playbackClock.lastPlayState = isPlaying;
    playbackClock.lastEventCreationTime = eventCreationTime;
    const snapshotAgeS = isPlaying && !readsMediaClockDirectly ? (now - eventCreationTime) / 1e3 : 0;
    let timeS = reportedTimeS + snapshotAgeS;
    if (SMOOTH_PLAYBACK_CLOCK) {
      if (isPlaying && !jumped) {
        timeS = smoothedPlaybackTime(playbackClock.smoothedTime, playbackClock.smoothedAt, timeS, now, playbackRate);
      }
      playbackClock.smoothedTime = timeS;
      playbackClock.smoothedAt = isPlaying ? now : NO_PLAYER_SNAPSHOT;
    }
    return { timeS, isPlaying, jumped, mediaClockRanBackwards, seekedWhilePaused };
  }
  function lyricClockShiftS(engine, lyricsElement, options) {
    const syncTypeShiftS = engine.syncType === "richsync" ? getCSSDurationInMs(engine, lyricsElement, "--blyrics-richsync-timing-offset") / 1e3 - options.richsyncOffsetTrim : getCSSDurationInMs(engine, lyricsElement, "--blyrics-timing-offset") / 1e3 - options.lineOffsetTrim;
    return syncTypeShiftS - options.globalLyricOffset - options.lyricOffset;
  }
  function playerTimeForLyricTime(engine, lyricTimeS) {
    const options = engine.lastTickOptions;
    const lyricsElement = engine.lyricsContainer;
    if (!options || !lyricsElement)
      return lyricTimeS;
    return Math.max(0, lyricTimeS - lyricClockShiftS(engine, lyricsElement, options));
  }

  // web/node_modules/@braccato/core/dist/constants.js
  var LYRICS_CLASS = "blyrics-container";
  var LINE_CLASS = "blyrics--line";
  var WORD_CLASS = "blyrics--word";
  var LETTER_CLASS = "blyrics--letter";
  var FOOTER_CLASS = "blyrics-footer";
  var CREDITS_CLASS = "blyrics-credits";
  var CREDITS_TEXT_CLASS = "blyrics-credits__text";
  var CREDITS_NAMES_CLASS = "blyrics-credits__names";
  var CURRENT_LYRICS_CLASS = "blyrics--active";
  var ANIMATING_CLASS = "blyrics--animating";
  var PAUSED_CLASS = "blyrics--paused";
  var ZERO_DURATION_ANIMATION_CLASS = "blyrics-zero-dur-animate";
  var USER_SCROLLING_CLASS = "blyrics-user-scrolling";
  var WORD_STATE_ATTR = "data-word-state";
  var WORD_STATE_UPCOMING = "upcoming";
  var WORD_STATE_ACTIVE = "active";
  var WORD_STATE_PAST = "past";
  var BACKGROUND_LYRIC_CLASS = "blyrics-background-lyric";
  var EXPLICIT_WORD_CLASS = "blyrics-explicit";
  var RTL_CLASS = "blyrics-rtl";
  var TRANSLATED_LYRICS_CLASS = "blyrics--translated";
  var ROMANIZED_LYRICS_CLASS = "blyrics--romanized";
  var CONTENT_LINE_CLASS = "blyrics-content-line";
  var LINE_MAIN_CLASS = "blyrics-line-main";
  var BACKGROUND_LINE_CLASS = "blyrics-background-line";
  var WORD_GROUP_CLASS = "blyrics-word-group";
  var LONG_WORD_GROUP_CLASS = "blyrics-word-group-long";
  var WORD_HIGHLIGHT_CLASS = "blyrics-word-highlight";
  var WORD_HIGHLIGHT_LETTERED_CLASS = "blyrics-word-highlight--lettered";
  var WORD_HIGHLIGHT_SWEEP_CLASS = "blyrics-word-highlight--sweep";
  var WORD_HIGHLIGHT_CONTEXT_CLASS = "blyrics-word-highlight--context";
  var SWEEP_CELL_CLASS = "blyrics-sweep-cell";
  var SWEEP_CONTEXT_CLASS = "blyrics-sweep-context";
  var SWEEP_WINDOW_CLASS = "blyrics-sweep-window";
  var SWEEP_CLONE_CLASS = "blyrics-sweep-clone";
  var SWEEP_TARGET_CLASS = "blyrics-sweep-target";
  var SWEEP_MASK_CLASS = "blyrics-sweep-mask";
  var SWEEP_TEXT_CLASS = "blyrics-sweep-text";
  var SWEEP_GLOW_CLASS = "blyrics-sweep-glow";
  var HIGHLIGHT_RUN_CLASS = "blyrics-highlight-run";
  var LINE_SYNCED_WORD_CLASS = "blyrics-line-synced-word";
  var BIDI_RUN_CLASS = "blyrics-bidi-run";
  var BIDI_SENSITIVE_CLASS = "blyrics-bidi-sensitive";
  var CUSTOM_THEME_STYLE_ID = "blyrics-custom-style";

  // web/node_modules/@braccato/core/dist/engine/liveViews.js
  var liveEngines = /* @__PURE__ */ new Set();

  // web/node_modules/@braccato/core/dist/engine/passiveScroll.js
  var PASSIVE_SCROLL_ENABLED = registerThemeSetting("blyrics-passive-scroll-enabled", true);
  var SECONDS_PER_LINE = registerThemeSetting("blyrics-passive-scroll-seconds-per-line", 3.5);
  var BOTTOM_PAUSE_S = registerThemeSetting("blyrics-passive-scroll-bottom-pause-s", 1.5);
  var RESET_DURATION_S = registerThemeSetting("blyrics-passive-scroll-reset-duration-s", 0.6);
  var TOP_PAUSE_S = registerThemeSetting("blyrics-passive-scroll-top-pause-s", 0.8);
  var MAX_FRAME_STEP_S = 0.5;
  var DRIFT_SCROLL_TOLERANCE_PX = 1;
  function hasNoLyricsPlaceholder(engine) {
    return engine.lyricsContainer?.dataset.noLyrics === "true";
  }
  function hasUnsyncedLyrics(engine) {
    return engine.lyricsContainer !== null && engine.syncType === "none" && !hasNoLyricsPlaceholder(engine);
  }
  function startPassiveScrollLoop(engine) {
    if (engine.passiveRAFId !== null)
      return;
    engine.passiveRAFId = engine.window.requestAnimationFrame(() => passiveScrollFrame(engine));
  }
  function stopPassiveScrollLoop(engine) {
    if (engine.passiveRAFId === null)
      return;
    engine.window.cancelAnimationFrame(engine.passiveRAFId);
    engine.passiveRAFId = null;
  }
  function passiveScrollFrame(engine) {
    engine.passiveRAFId = null;
    if (!engine.passiveScrollEnabled || !PASSIVE_SCROLL_ENABLED.getBooleanValue() || !hasUnsyncedLyrics(engine))
      return;
    advancePassiveScroll(engine, playbackClock.lastPlayState);
    engine.passiveRAFId = engine.window.requestAnimationFrame(() => passiveScrollFrame(engine));
  }
  function advancePassiveScroll(engine, isPlaying) {
    if (!engine.host.isViewVisible() || engine.host.isLoaderActive())
      return;
    const scroller = engine.host.getScrollElement();
    if (!scroller)
      return;
    const now = Date.now();
    if (engine.passiveLastWallTime > 0 && isPlaying) {
      engine.passiveScrollAccumulatedTime += Math.min((now - engine.passiveLastWallTime) / 1e3, MAX_FRAME_STEP_S);
    }
    engine.passiveLastWallTime = now;
    if (engine.scrollResumeTime > now)
      return;
    if (engine.wasUserScrolling)
      resumeFromUserScroll(engine, scroller);
    const scrollDurationS = engine.lines.length * SECONDS_PER_LINE.getNumberValue();
    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
    if (engine.lines.length === 0 || maxScrollTop <= 0)
      return;
    const scrollTop = passiveCycleScrollTop(engine.passiveScrollAccumulatedTime, scrollDurationS, maxScrollTop);
    scroller.scrollTop = scrollTop;
    engine.passiveScrollTop = scroller.scrollTop;
  }
  function isPassiveDriftScroll(engine) {
    const scrollTop = engine.host.getScrollElement()?.scrollTop;
    return engine.passiveScrollTop !== null && scrollTop !== void 0 && Math.abs(scrollTop - engine.passiveScrollTop) < DRIFT_SCROLL_TOLERANCE_PX;
  }
  function resumeFromUserScroll(engine, scroller) {
    engine.host.setResumeAffordanceVisible(false);
    engine.lyricsContainer?.classList.remove(USER_SCROLLING_CLASS);
    engine.wasUserScrolling = false;
    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
    if (maxScrollTop <= 0)
      return;
    const scrollDurationS = engine.lines.length * SECONDS_PER_LINE.getNumberValue();
    engine.passiveScrollAccumulatedTime = scroller.scrollTop / maxScrollTop * scrollDurationS;
  }
  function passiveCycleScrollTop(playedS, scrollDurationS, maxScrollTop) {
    const reachesBottomS = scrollDurationS;
    const leavesBottomS = reachesBottomS + BOTTOM_PAUSE_S.getNumberValue();
    const resetDurationS = RESET_DURATION_S.getNumberValue();
    const reachesTopS = leavesBottomS + resetDurationS;
    const cycleS = playedS % (reachesTopS + TOP_PAUSE_S.getNumberValue());
    if (cycleS < reachesBottomS)
      return cycleS / scrollDurationS * maxScrollTop;
    if (cycleS < leavesBottomS)
      return maxScrollTop;
    if (cycleS < reachesTopS) {
      const remaining = 1 - (cycleS - leavesBottomS) / resetDurationS;
      return maxScrollTop * remaining * remaining;
    }
    return 0;
  }

  // web/node_modules/@braccato/core/dist/engine/userScroll.js
  var PAUSING_LYRICS_SCROLL_LOG = "Pausing Lyrics Autoscroll Due to User Scroll";
  var USER_SCROLL_RESUME_DELAY_MS = 25e3;
  var UNSYNCED_USER_SCROLL_RESUME_DELAY_MS = 5e3;
  var ENGINE_SCROLL_EVENT_WINDOW_MS = 2e3;
  function resetScrollResume(engine) {
    engine.scrollResumeTime = 0;
  }
  function noteUserScroll(engine, lyricsAreUnsynced) {
    if (lyricsAreUnsynced) {
      if (isPassiveDriftScroll(engine))
        return;
    } else if (engine.skipScrolls > 0) {
      engine.skipScrolls--;
      engine.skipScrollsDecayTimes.shift();
      return;
    }
    dropPendingLineScroll(engine);
    if (engine.host.isLoaderActive())
      return;
    const now = Date.now();
    if (engine.scrollResumeTime < now)
      engine.host.log(PAUSING_LYRICS_SCROLL_LOG);
    engine.scrollResumeTime = now + (lyricsAreUnsynced ? UNSYNCED_USER_SCROLL_RESUME_DELAY_MS : USER_SCROLL_RESUME_DELAY_MS);
    engine.wasUserScrolling = true;
    engine.host.setResumeAffordanceVisible(true);
    engine.lyricsContainer?.classList.add(USER_SCROLLING_CLASS);
  }
  function hasContainerResized(engine, width, height) {
    return width !== engine.lyricWidth || height !== engine.lyricHeight;
  }
  function writeEngineScrollTop(engine, scroller, scrollTop, now) {
    engine.scrollPos = scrollTop;
    const scrollTopBeforeWrite = scroller.scrollTop;
    scroller.scrollTop = scrollTop;
    if (scroller.scrollTop !== scrollTopBeforeWrite)
      noteEngineScrollEvent(engine, now);
  }
  function noteEngineScrollEvent(engine, now) {
    engine.skipScrolls += 1;
    engine.skipScrollsDecayTimes.push(now + ENGINE_SCROLL_EVENT_WINDOW_MS);
  }
  function requestRescroll(engine) {
    engine.wasUserScrolling = true;
  }
  function decaySkipScrolls(engine, now, keepsReserve) {
    const firstLive = engine.skipScrollsDecayTimes.findIndex((time) => time > now);
    const expiredCount = firstLive === -1 ? engine.skipScrollsDecayTimes.length : firstLive;
    engine.skipScrollsDecayTimes = engine.skipScrollsDecayTimes.slice(expiredCount);
    engine.skipScrolls = Math.max(keepsReserve ? 1 : 0, engine.skipScrolls - expiredCount);
  }

  // web/node_modules/@braccato/core/dist/engine/wavePool.js
  var waveAnimationPools = /* @__PURE__ */ new WeakMap();
  var pooledWaveKeyframeSignatures = /* @__PURE__ */ new WeakMap();
  function acquireWaveAnimation(engine, letterElement, keyframes, keyframeSignature, timing) {
    const pool = engine.waveAnimationPool;
    const pooled = pool[pool.length - 1];
    const effect = pooled?.effect;
    if (pooled && effect && typeof effect.setKeyframes === "function") {
      pool.pop();
      effect.target = letterElement;
      if (pooledWaveKeyframeSignatures.get(pooled) !== keyframeSignature) {
        effect.setKeyframes(keyframes);
        pooledWaveKeyframeSignatures.set(pooled, keyframeSignature);
      }
      effect.updateTiming(timing);
      pooled.play();
      return pooled;
    }
    const animation = letterElement.animate(keyframes, timing);
    waveAnimationPools.set(animation, pool);
    pooledWaveKeyframeSignatures.set(animation, keyframeSignature);
    return animation;
  }

  // web/node_modules/@braccato/core/dist/engine/lineAnimationState.js
  function releasePart(part) {
    resetPartAnimations(part);
    togglePartClass(part, PAUSED_CLASS, false);
    togglePartClass(part, ANIMATING_CLASS, false);
    part.wordState = WORD_STATE_UPCOMING;
    part.lyricElement.setAttribute(WORD_STATE_ATTR, WORD_STATE_UPCOMING);
    part.highlightElement.setAttribute(WORD_STATE_ATTR, WORD_STATE_UPCOMING);
  }
  function resetPartAnimations(part) {
    for (const animation of part.animations) {
      animation.cancel();
      const pool = waveAnimationPools.get(animation);
      if (pool)
        pool.push(animation);
    }
    part.animations = [];
  }
  function resetLineAnimations(lineData) {
    resetPartAnimations(lineData);
    for (const part of lineData.parts)
      resetPartAnimations(part);
  }
  function hasLineAnimations(lineData) {
    return lineData.animations.length > 0 || lineData.parts.some((part) => part.animations.length > 0);
  }
  function markLineAnimationsStopped(lineData) {
    lineData.isAnimating = false;
    lineData.isAnimationPlayStatePlaying = false;
    lineData.accumulatedOffsetMs = 0;
  }
  function resetLineAnimationState(lineData) {
    resetLineAnimations(lineData);
    markLineAnimationsStopped(lineData);
  }
  function togglePartClass(part, className, force) {
    part.lyricElement.classList.toggle(className, force);
    if ("highlightElement" in part) {
      part.highlightElement.classList.toggle(className, force);
    }
  }
  function setAnimationsPlayState(lineData, isPlaying) {
    const children = [lineData, ...lineData.parts];
    for (const part of children) {
      togglePartClass(part, PAUSED_CLASS, !isPlaying);
      for (const animation of part.animations) {
        if (isPlaying) {
          animation.play();
        } else {
          animation.pause();
        }
      }
    }
  }
  function clearLineStateClasses(lineData) {
    lineData.lyricElement.classList.remove(ANIMATING_CLASS);
    for (const part of [lineData, ...lineData.parts]) {
      togglePartClass(part, PAUSED_CLASS, false);
    }
  }
  function updateWordStates(lineData, currentTime) {
    const parts = lineData.parts;
    const lineEndTime = lineData.time + lineData.duration;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const endTime = part.duration > 0 ? part.time + part.duration : parts[i + 1]?.time ?? lineEndTime;
      let state = WORD_STATE_PAST;
      if (currentTime < part.time) {
        state = WORD_STATE_UPCOMING;
      } else if (currentTime < endTime) {
        state = WORD_STATE_ACTIVE;
      }
      if (part.wordState === state)
        continue;
      part.wordState = state;
      part.lyricElement.setAttribute(WORD_STATE_ATTR, state);
      part.highlightElement.setAttribute(WORD_STATE_ATTR, state);
    }
  }

  // web/node_modules/@braccato/core/dist/language.js
  function normalizeLanguage(language) {
    if (!language || language === "auto" || language === "und")
      return "";
    try {
      return Intl.getCanonicalLocales(language.trim().replaceAll("_", "-"))[0] ?? "";
    } catch {
      return "";
    }
  }
  function detectCjkLanguage(text) {
    if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text))
      return "ja";
    if (new RegExp("\\p{Script=Hangul}", "u").test(text))
      return "ko";
    return null;
  }
  function isCjkLanguage(language) {
    return /^(ja|ko|zh|yue)(-|$)|-(Hans|Hant)(-|$)/i.test(language);
  }
  function resolveLyricLanguages(lyrics, sourceLanguage) {
    const language = normalizeLanguage(sourceLanguage);
    const hints = lyrics.map((line) => line.isInstrumental ? null : detectCjkLanguage(line.words));
    const songHints = new Set(hints.filter((hint) => hint !== null));
    const songHint = songHints.size === 1 ? [...songHints][0] : "";
    const fallback = isCjkLanguage(language) ? language : songHint || language;
    return lyrics.map((line, index) => {
      if (line.isInstrumental)
        return "";
      const hint = hints[index];
      if (hint && fallback.split("-")[0] !== hint)
        return hint;
      if (new RegExp("\\p{Script=Han}", "u").test(line.words) && !isCjkLanguage(fallback))
        return "";
      return fallback;
    });
  }
  function applyLyricLanguage(element, language) {
    const normalized = normalizeLanguage(language);
    element.lang = normalized;
    const romanization = element.querySelector(`.${ROMANIZED_LYRICS_CLASS}`);
    if (romanization)
      romanization.lang = `${normalized ? new Intl.Locale(normalized).language : "und"}-Latn`;
  }

  // web/node_modules/@braccato/core/dist/letters.js
  var graphemeSegmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  var CONJUNCT_VIRAMA_REGEX = /(?:[\u{94D}\u{9CD}\u{A4D}\u{ACD}\u{B4D}\u{C4D}\u{CCD}\u{D4D}\u{1039}\u{17D2}\u{1A60}\u{1B44}\u{1BAB}\u{2D7F}\u{A9C0}\u{AAF6}\u{10A3F}\u{11046}\u{1107F}\u{110B9}\u{11133}\u{111C0}\u{11235}\u{1134D}\u{113D0}\u{11442}\u{114C2}\u{115BF}\u{1163F}\u{116B6}\u{11839}\u{1193E}\u{119E0}\u{11A47}\u{11A99}\u{11C3F}\u{11D45}\u{11D97}\u{11F42}]\u200D?|\u200D\u0DCA|\u0DCA\u200D)$/u;
  var LETTER_START_REGEX = new RegExp("^\\p{L}", "u");
  var MARK_START_REGEX = new RegExp("^\\p{M}", "u");
  var joinsTamilLigature = (previous, next) => previous.endsWith("\u0B95\u0BCD") && next.startsWith("\u0BB7") || previous.endsWith("\u0BB8\u0BCD") && next.startsWith("\u0BB0\u0BC0");
  function letterClusters(text) {
    return joinLetterSegments(Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment));
  }
  function joinLetterSegments(segments) {
    const clusters = [];
    let previous = "";
    for (const segment of segments) {
      const joins = clusters.length > 0 && (MARK_START_REGEX.test(segment) || LETTER_START_REGEX.test(segment) && (CONJUNCT_VIRAMA_REGEX.test(previous) || joinsTamilLigature(previous, segment)));
      if (joins)
        clusters[clusters.length - 1] += segment;
      else
        clusters.push(segment);
      previous = segment;
    }
    return clusters;
  }

  // web/node_modules/@braccato/core/dist/seek.js
  function getSeekTimeFromClick(event, lyricElement) {
    const target = event.target;
    const container = lyricElement.closest(`.${LYRICS_CLASS}`);
    const isRichsync = container?.dataset.sync === "richsync";
    if (!isRichsync || !event.altKey) {
      return parseFloat(lyricElement.dataset.time || "0");
    }
    let wordElement = target.closest(`.${WORD_CLASS}`);
    if (!wordElement) {
      const words = lyricElement.querySelectorAll(`.${WORD_CLASS}`);
      let closestDist = Infinity;
      words.forEach((word) => {
        const rect = word.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(event.clientX - centerX, event.clientY - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          wordElement = word;
        }
      });
    }
    if (!wordElement)
      return null;
    return parseFloat(wordElement.dataset.time || "0");
  }

  // web/node_modules/@braccato/core/dist/text.js
  var testRtl = (text) => /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Mandaic}\p{Script=Hanifi_Rohingya}\p{Script=Samaritan}\p{Script=Yezidi}\p{Script=Mende_Kikakui}\p{Script=Old_Hungarian}]/u.test(text);
  var testJoiningScript = (text) => /[\p{Script_Extensions=Arabic}\p{Script_Extensions=Syriac}\p{Script_Extensions=Nko}\p{Script_Extensions=Mongolian}\p{Script_Extensions=Adlam}\p{Script_Extensions=Mandaic}\p{Script_Extensions=Hanifi_Rohingya}]/u.test(text);
  var SCRIPT_TO_LANG = [
    [new RegExp("\\p{Script=Hiragana}|\\p{Script=Katakana}", "u"), "ja"],
    [new RegExp("\\p{Script=Hangul}", "u"), "ko"],
    [new RegExp("\\p{Script=Han}", "u"), "zh"],
    [new RegExp("\\p{Script=Cyrillic}", "u"), "ru"],
    [new RegExp("\\p{Script=Devanagari}", "u"), "hi"],
    [new RegExp("\\p{Script=Arabic}", "u"), "ar"],
    [new RegExp("\\p{Script=Thai}", "u"), "th"],
    [new RegExp("\\p{Script=Greek}", "u"), "el"],
    [new RegExp("\\p{Script=Hebrew}", "u"), "he"],
    [new RegExp("\\p{Script=Bengali}", "u"), "bn"],
    [new RegExp("\\p{Script=Tamil}", "u"), "ta"],
    [new RegExp("\\p{Script=Telugu}", "u"), "te"],
    [new RegExp("\\p{Script=Malayalam}", "u"), "ml"],
    [new RegExp("\\p{Script=Kannada}", "u"), "kn"],
    [new RegExp("\\p{Script=Gujarati}", "u"), "gu"],
    [new RegExp("\\p{Script=Gurmukhi}", "u"), "pa"],
    [new RegExp("\\p{Script=Sinhala}", "u"), "si"],
    [new RegExp("\\p{Script=Myanmar}", "u"), "my"],
    [new RegExp("\\p{Script=Georgian}", "u"), "ka"],
    [new RegExp("\\p{Script=Khmer}", "u"), "km"],
    [new RegExp("\\p{Script=Lao}", "u"), "lo"]
  ];
  var comparable = (text) => text.toLowerCase().replaceAll(new RegExp("\\p{P}", "gu"), "").trim();
  var isSameText = (a, b) => comparable(a) === comparable(b);

  // web/node_modules/@braccato/core/dist/inject.js
  var disableRichsync = registerThemeSetting("blyrics-disable-richsync", false, true);
  var lineSyncedAnimationDelay = registerThemeSetting("blyrics-line-synced-animation-delay", 50, true);
  var longWordThreshold = registerThemeSetting("blyrics-long-word-threshold", 1500, true);
  var longWordWrapThreshold = registerThemeSetting("blyrics-long-word-wrap-threshold", 10, true);
  var letterWave = registerThemeSetting("blyrics-letter-wave", true, true);
  var hideCredits = registerThemeSetting("blyrics-hide-credits", false, true);
  var LTR_SCRIPT_REGEX = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  var SPACE_REGEX = /^\s+$/u;
  function findNearestAgent(lyrics, fromIndex) {
    for (let i = fromIndex + 1; i < lyrics.length; i++) {
      if (!lyrics[i].isInstrumental && lyrics[i].agent) {
        return lyrics[i].agent;
      }
    }
    for (let i = fromIndex - 1; i >= 0; i--) {
      if (!lyrics[i].isInstrumental && lyrics[i].agent) {
        return lyrics[i].agent;
      }
    }
    return void 0;
  }
  function isNearestLyricRtl(lyrics, fromIndex) {
    for (let i = fromIndex + 1; i < lyrics.length; i++) {
      if (!lyrics[i].isInstrumental && lyrics[i].words?.trim()) {
        return testRtl(lyrics[i].words);
      }
    }
    for (let i = fromIndex - 1; i >= 0; i--) {
      if (!lyrics[i].isInstrumental && lyrics[i].words?.trim()) {
        return testRtl(lyrics[i].words);
      }
    }
    return false;
  }
  function deriveSyncType(lyrics) {
    const hasTimedParts = !disableRichsync.getBooleanValue() && lyrics.some((item) => !item.isInstrumental && item.parts?.some((part) => part.durationMs !== 0) === true);
    if (hasTimedParts)
      return "richsync";
    return lyrics.every((item) => item.startTimeMs === 0) ? "none" : "synced";
  }
  function newPartData(part, span, highlight, wobbleElements, letterElements, highlightLetterElements, sweep) {
    return {
      time: part.startTimeMs / 1e3,
      duration: part.durationMs / 1e3,
      lyricElement: span,
      highlightElement: highlight,
      sweep,
      sweepContext: highlight.classList.contains(WORD_HIGHLIGHT_CONTEXT_CLASS) ? {} : void 0,
      letterElements,
      highlightLetterElements,
      wobbleElements,
      animations: [],
      wordState: WORD_STATE_UPCOMING
    };
  }
  function newLineData(lyricElement, startTimeMs, durationMs) {
    return {
      lyricElement,
      time: startTimeMs / 1e3,
      duration: durationMs / 1e3,
      parts: [],
      isScrolled: false,
      isAnimationPlayStatePlaying: false,
      accumulatedOffsetMs: 0,
      isAnimating: false,
      lastAnimSetupAt: 0,
      isSelected: false,
      height: -1,
      position: -1,
      decorations: /* @__PURE__ */ new Map(),
      animations: []
    };
  }
  function detectDirection(text) {
    for (const char of text) {
      if (testRtl(char))
        return "rtl";
      if (LTR_SCRIPT_REGEX.test(char))
        return "ltr";
    }
    return "auto";
  }
  function applyDirection(element, text) {
    const direction = detectDirection(text);
    element.dir = "auto";
    if (direction === "rtl") {
      element.classList.add(RTL_CLASS);
      element.dataset.direction = "rtl";
    } else if (direction === "ltr") {
      element.dataset.direction = "ltr";
    }
  }
  function applyBidiSensitivity(element, text) {
    if (testRtl(text)) {
      element.classList.add(BIDI_SENSITIVE_CLASS);
    }
  }
  function splitPartIntoTokens(part) {
    const chunks = part.words.match(/\s+|\S+/gu) ?? [];
    if (chunks.length === 0)
      return [];
    const tokens = [];
    let spaceChars = 0;
    for (const chunk of chunks) {
      if (SPACE_REGEX.test(chunk)) {
        tokens.push({ kind: "space", text: chunk });
        spaceChars += chunk.length;
        continue;
      }
      tokens.push({
        kind: "part",
        text: chunk,
        part: {
          words: chunk,
          isBackground: part.isBackground,
          backgroundGroup: part.backgroundGroup,
          explicit: part.explicit
        }
      });
    }
    const nonWhiteSpaceChars = part.words.length - spaceChars;
    let cursor = 0;
    return tokens.map((t2) => {
      if (t2.kind === "part") {
        const startTimeMs = part.startTimeMs + Math.round(part.durationMs * cursor / nonWhiteSpaceChars);
        const endTimeMs = part.startTimeMs + Math.round(part.durationMs * (cursor + t2.text.length) / nonWhiteSpaceChars);
        cursor += t2.text.length;
        return {
          ...t2,
          part: {
            ...t2.part,
            startTimeMs,
            durationMs: endTimeMs - startTimeMs
          }
        };
      }
      return t2;
    });
  }
  function normalizeParts(parts) {
    return parts.flatMap(splitPartIntoTokens);
  }
  function groupTokensByWord(tokens, splitBackgroundGroups) {
    const groups = [];
    let current = null;
    const flush = () => {
      if (current && current.tokens.length > 0) {
        groups.push(current);
      }
      current = null;
    };
    for (const token of tokens) {
      if (token.kind === "space") {
        flush();
        groups.push(token);
        continue;
      }
      const isBackground = token.part?.isBackground === true;
      const backgroundGroup = splitBackgroundGroups ? token.part?.backgroundGroup : void 0;
      if (!current || current.isBackground !== isBackground || current.backgroundGroup !== backgroundGroup) {
        flush();
        current = { text: "", isBackground, backgroundGroup, tokens: [] };
      }
      current.text += token.text;
      current.tokens.push(token);
    }
    flush();
    return groups;
  }
  function appendLongWordBreaks(doc, span, clusters, threshold) {
    if (clusters.length <= threshold) {
      span.textContent = clusters.join("");
      return false;
    }
    for (let i = 0; i < clusters.length; i += threshold) {
      span.appendChild(doc.createTextNode(clusters.slice(i, i + threshold).join("")));
      if (i + threshold < clusters.length) {
        span.appendChild(doc.createElement("wbr"));
      }
    }
    return true;
  }
  function appendLetters(doc, wordElement, chars) {
    wordElement.style.setProperty("--letters", String(chars.length));
    return chars.map((char) => {
      const letter = doc.createElement("span");
      letter.classList.add(LETTER_CLASS);
      letter.textContent = char;
      wordElement.appendChild(letter);
      return letter;
    });
  }
  function fillWordText(doc, host, clusters, wrapThreshold, perLetter, preserveJoining) {
    if (perLetter)
      return appendLetters(doc, host, clusters);
    if (preserveJoining)
      host.textContent = clusters.join("");
    else
      appendLongWordBreaks(doc, host, clusters, wrapThreshold);
    return void 0;
  }
  var SWEEP_GLOW_RADII = ["wide", "tight"];
  function createSweepCell(doc, host, fill) {
    const mask = doc.createElement("span");
    mask.classList.add(SWEEP_MASK_CLASS);
    const text = doc.createElement("span");
    text.classList.add(SWEEP_TEXT_CLASS);
    mask.appendChild(text);
    const letters = fill(text);
    const glows = SWEEP_GLOW_RADII.map((radius) => {
      const glow2 = doc.createElement("span");
      glow2.classList.add(SWEEP_GLOW_CLASS, `${SWEEP_GLOW_CLASS}--${radius}`);
      const glowLetters = fill(glow2);
      text.appendChild(glow2);
      return { glow: glow2, letters: glowLetters };
    });
    host.classList.add(SWEEP_CELL_CLASS);
    host.appendChild(mask);
    return { mask, text, letters, glows };
  }
  function createLetterSweepCells(doc, letters) {
    return letters.map((letter) => {
      const text = letter.textContent ?? "";
      letter.textContent = "";
      return createSweepCell(doc, letter, (into) => {
        into.appendChild(doc.createTextNode(text));
        return void 0;
      });
    });
  }
  function createTimedWordSpan(doc, part, wrapThreshold, perLetter, preserveJoining, atomic) {
    const span = doc.createElement("span");
    const highlight = doc.createElement("span");
    highlight.classList.add(WORD_HIGHLIGHT_CLASS);
    let sweep;
    let letters;
    let highlightLetters;
    const clusters = perLetter || !preserveJoining && part.words.length > wrapThreshold ? letterClusters(part.words) : [part.words];
    for (const wordElement of [span, highlight]) {
      wordElement.classList.add(WORD_CLASS);
      wordElement.dir = "auto";
      if (part.durationMs === 0) {
        wordElement.classList.add(ZERO_DURATION_ANIMATION_CLASS);
        wordElement.classList.add(LINE_SYNCED_WORD_CLASS);
      }
      if (testRtl(part.words))
        wordElement.classList.add(RTL_CLASS);
      if (part.durationMs > longWordThreshold.getNumberValue())
        wordElement.dataset.longWord = "true";
      if (part.isBackground)
        wordElement.classList.add(BACKGROUND_LYRIC_CLASS);
      if (part.explicit)
        wordElement.classList.add(EXPLICIT_WORD_CLASS);
      if (perLetter) {
        wordElement.classList.add("blyrics-word--lettered");
        if (wordElement === highlight)
          wordElement.classList.add(WORD_HIGHLIGHT_LETTERED_CLASS);
      }
      if (wordElement === highlight && atomic) {
        const cell = createSweepCell(doc, highlight, (into) => fillWordText(doc, into, clusters, wrapThreshold, perLetter, preserveJoining));
        sweep = [cell];
        highlightLetters = cell.letters;
      } else {
        const collected = fillWordText(doc, wordElement, clusters, wrapThreshold, perLetter, preserveJoining);
        if (wordElement === span)
          letters = collected;
        else
          highlightLetters = collected;
        if (wordElement === highlight && collected)
          sweep = createLetterSweepCells(doc, collected);
      }
      if (wordElement === highlight && sweep)
        highlight.classList.add(WORD_HIGHLIGHT_SWEEP_CLASS);
      else if (wordElement === highlight)
        highlight.classList.add(WORD_HIGHLIGHT_CONTEXT_CLASS);
      wordElement.dataset.time = String(part.startTimeMs / 1e3);
      wordElement.dataset.duration = String(part.durationMs / 1e3);
      wordElement.dataset.content = part.words;
      wordElement.setAttribute(WORD_STATE_ATTR, WORD_STATE_UPCOMING);
      wordElement.style.setProperty("--blyrics-duration", part.durationMs + "ms");
    }
    return { span, highlight, letters, highlightLetters, sweep };
  }
  function createWordGroup(doc, group, lineData, wordsFlowInline) {
    const wrapThreshold = Math.max(1, longWordWrapThreshold.getNumberValue());
    const mixedDirection = testRtl(group.text) && [...group.text].some((char) => /[\p{Letter}\p{Number}]/u.test(char) && !testRtl(char));
    const preserveJoining = testJoiningScript(group.text);
    const perLetter = letterWave.getBooleanValue() && !preserveJoining && !mixedDirection;
    const isLongGroup = group.text.length > wrapThreshold * 2 && letterClusters(group.text).length > wrapThreshold * 2;
    const lyricGroup = doc.createElement("span");
    const highlightGroup = doc.createElement("span");
    const atomic = !wordsFlowInline && !isLongGroup;
    for (const groupElement of [lyricGroup, highlightGroup]) {
      groupElement.classList.add(WORD_GROUP_CLASS);
      groupElement.dir = "auto";
      groupElement.dataset.content = group.text;
      if (isLongGroup) {
        groupElement.classList.add(LONG_WORD_GROUP_CLASS);
      }
      if (group.isBackground) {
        groupElement.classList.add(BACKGROUND_LYRIC_CLASS);
      }
    }
    for (const token of group.tokens) {
      if (token.kind === "space")
        continue;
      const { span, highlight, letters, highlightLetters, sweep } = createTimedWordSpan(doc, token.part, wrapThreshold, perLetter, preserveJoining, atomic);
      const wobbleElements = lyricGroup.childNodes.length === 0 ? [lyricGroup, highlightGroup] : [];
      lineData.parts.push(newPartData(token.part, span, highlight, wobbleElements, letters, highlightLetters, sweep));
      lyricGroup.appendChild(span);
      highlightGroup.appendChild(highlight);
    }
    return { lyricGroup, highlightGroup };
  }
  function createContentLine(doc, className, text) {
    const line = doc.createElement("div");
    line.classList.add(className);
    applyDirection(line, text);
    applyBidiSensitivity(line, text);
    return line;
  }
  function createBidiRun(doc, text) {
    const run = doc.createElement("span");
    run.classList.add(BIDI_RUN_CLASS);
    applyDirection(run, text);
    return run;
  }
  function createHighlightRun(doc, text) {
    const run = createBidiRun(doc, text);
    run.classList.add(HIGHLIGHT_RUN_CLASS);
    run.setAttribute("aria-hidden", "true");
    return run;
  }
  function createSpaceNode(doc, text, isBackground) {
    if (!isBackground)
      return doc.createTextNode(text);
    const span = doc.createElement("span");
    span.classList.add(BACKGROUND_LYRIC_CLASS);
    span.textContent = text;
    return span;
  }
  function createLyricsLine(doc, parts, line, lyricElement, options = { splitBackgroundLine: true }) {
    const lineText = parts.map((part) => part.words).join("");
    const mainText = options.splitBackgroundLine ? parts.filter((part) => part.isBackground !== true).map((part) => part.words).join("") : lineText;
    const backgroundTextOf = (group) => parts.filter((part) => part.isBackground === true && (part.backgroundGroup ?? 0) === group).map((part) => part.words).join("");
    const main = createContentLine(doc, LINE_MAIN_CLASS, mainText);
    const mainRun = createBidiRun(doc, mainText);
    const mainHighlightRun = createHighlightRun(doc, mainText);
    const groupedTokens = groupTokensByWord(normalizeParts(parts), options.splitBackgroundLine);
    const backgroundRows = /* @__PURE__ */ new Map();
    const backgroundRowOf = (group) => {
      let row = backgroundRows.get(group);
      if (!row) {
        const text = backgroundTextOf(group);
        row = {
          line: createContentLine(doc, BACKGROUND_LINE_CLASS, text),
          run: createBidiRun(doc, text),
          highlightRun: createHighlightRun(doc, text),
          used: false
        };
        row.line.appendChild(row.highlightRun);
        row.line.appendChild(row.run);
        backgroundRows.set(group, row);
      }
      return row;
    };
    backgroundRowOf(0);
    let pendingForegroundSpace = "";
    let pendingBackgroundSpace = "";
    main.appendChild(mainHighlightRun);
    main.appendChild(mainRun);
    for (const item of groupedTokens) {
      if ("kind" in item) {
        pendingForegroundSpace += item.text;
        pendingBackgroundSpace += item.text;
      } else {
        const shouldUseBackgroundLine = options.splitBackgroundLine && item.isBackground;
        const backgroundRow = shouldUseBackgroundLine ? backgroundRowOf(item.backgroundGroup ?? 0) : null;
        const target = backgroundRow ? backgroundRow.run : mainRun;
        const highlightRun = backgroundRow ? backgroundRow.highlightRun : mainHighlightRun;
        const pendingSpace = shouldUseBackgroundLine ? pendingBackgroundSpace : pendingForegroundSpace;
        if (target.childNodes.length > 0 && pendingSpace.length > 0) {
          target.appendChild(createSpaceNode(doc, pendingSpace, shouldUseBackgroundLine));
          highlightRun.appendChild(createSpaceNode(doc, pendingSpace, shouldUseBackgroundLine));
        }
        const contentLine = backgroundRow ? backgroundRow.line : main;
        const { lyricGroup, highlightGroup } = createWordGroup(doc, item, line, contentLine.classList.contains(BIDI_SENSITIVE_CLASS));
        target.appendChild(lyricGroup);
        highlightRun.appendChild(highlightGroup);
        if (backgroundRow) {
          backgroundRow.used = true;
          pendingBackgroundSpace = "";
        } else {
          pendingForegroundSpace = "";
        }
      }
    }
    const usedBackgroundRows = [...backgroundRows].filter(([, row]) => row.used).sort(([a], [b]) => a - b).map(([, row]) => row);
    lyricElement.appendChild(main);
    for (const row of usedBackgroundRows)
      lyricElement.appendChild(row.line);
    return main;
  }
  function buildLineSyncedParts(item) {
    const parts = [];
    const tokens = item.words.match(/\s+|\S+/gu) ?? [];
    let wordIndex = 0;
    for (const token of tokens) {
      const isSpace = SPACE_REGEX.test(token);
      const startTimeMs = item.startTimeMs + wordIndex * lineSyncedAnimationDelay.getNumberValue();
      parts.push({
        startTimeMs,
        words: token,
        durationMs: 0
      });
      if (!isSpace) {
        wordIndex += 1;
      }
    }
    return parts;
  }
  function addSeekHandler(seek, lyricElement, allZero) {
    if (allZero) {
      lyricElement.style.cursor = "unset";
      return;
    }
    lyricElement.addEventListener("click", (event) => {
      const seekTime = getSeekTimeFromClick(event, lyricElement);
      if (seekTime === null)
        return;
      seek(seekTime);
    });
  }
  function repeatsLine(lyricElement, text) {
    const mainRun = [
      ...lyricElement.querySelector(`:scope > .${LINE_MAIN_CLASS}`)?.querySelectorAll(`:scope > .${BIDI_RUN_CLASS}`) ?? []
    ].find((run) => !run.classList.contains(HIGHLIGHT_RUN_CLASS));
    return mainRun?.textContent != null && isSameText(mainRun.textContent, text);
  }
  var decorationSources = /* @__PURE__ */ new WeakMap();
  function rearmLineAnimations(lineData) {
    lineData.isAnimating = false;
  }
  function removeDecoration(lineData, decoration) {
    lineData.parts = lineData.parts.filter((part) => {
      if (!decoration.contains(part.lyricElement))
        return true;
      releasePart(part);
      return false;
    });
    decoration.remove();
  }
  function moveDecorations(from, to) {
    const decorations = Array.from(from.lyricElement.childNodes).filter((node) => node.classList?.contains(ROMANIZED_LYRICS_CLASS) === true || node.classList?.contains(TRANSLATED_LYRICS_CLASS) === true);
    for (const decoration of decorations) {
      from.parts = from.parts.filter((part) => {
        if (!decoration.contains(part.lyricElement))
          return true;
        releasePart(part);
        to.parts.push(part);
        return false;
      });
      to.lyricElement.appendChild(decoration);
    }
  }
  function injectRomanization(doc, lyricElement, lineData, text, timedRomanization = null) {
    const source = JSON.stringify([text, timedRomanization ?? null]);
    const existing = lyricElement.querySelector(`:scope > .${ROMANIZED_LYRICS_CLASS}`);
    if (existing !== null) {
      if (decorationSources.get(existing) === source)
        return;
      removeDecoration(lineData, existing);
    }
    if (repeatsLine(lyricElement, text))
      return;
    const romanizedLine = doc.createElement("div");
    romanizedLine.classList.add(ROMANIZED_LYRICS_CLASS, CONTENT_LINE_CLASS);
    romanizedLine.dir = "auto";
    const language = normalizeLanguage(lyricElement.lang);
    romanizedLine.lang = `${language ? new Intl.Locale(language).language : "und"}-Latn`;
    applyDirection(romanizedLine, text);
    if (timedRomanization && timedRomanization.length > 0 && !disableRichsync.getBooleanValue()) {
      createLyricsLine(doc, timedRomanization, lineData, romanizedLine, { splitBackgroundLine: false });
      rearmLineAnimations(lineData);
    } else {
      romanizedLine.textContent = text;
    }
    decorationSources.set(romanizedLine, source);
    const translation = lyricElement.querySelector(`.${TRANSLATED_LYRICS_CLASS}`);
    lyricElement.insertBefore(romanizedLine, translation);
  }
  function injectTranslation(doc, lyricElement, text, language) {
    const source = JSON.stringify([text, normalizeLanguage(language)]);
    const existing = lyricElement.querySelector(`:scope > .${TRANSLATED_LYRICS_CLASS}`);
    if (existing !== null) {
      if (decorationSources.get(existing) === source)
        return;
      existing.remove();
    }
    if (repeatsLine(lyricElement, text))
      return;
    const translatedLine = doc.createElement("div");
    translatedLine.classList.add(TRANSLATED_LYRICS_CLASS, CONTENT_LINE_CLASS);
    translatedLine.dir = "auto";
    translatedLine.lang = normalizeLanguage(language);
    applyDirection(translatedLine, text);
    translatedLine.textContent = text;
    decorationSources.set(translatedLine, source);
    lyricElement.appendChild(translatedLine);
  }

  // web/node_modules/@braccato/core/dist/imageHighlights.js
  var imageHighlights = registerThemeSetting("blyrics-image-highlights", false, true);
  function imageURL(value) {
    const match = /^url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s'"()]+))\s*\)$/i.exec(value.trim());
    return match ? match[1] ?? match[2] ?? match[3] : null;
  }
  function refreshInstrumentalImages(container, view) {
    if (!container || !imageHighlights.getBooleanValue())
      return;
    for (const svg of container.querySelectorAll(".blyrics--instrumental-icon")) {
      const image = svg.querySelector(".blyrics-instrumental-image");
      if (!image)
        continue;
      const source = imageURL(view.getComputedStyle(svg).getPropertyValue("--blyrics-highlight-image"));
      if (source === image.getAttribute("href"))
        continue;
      svg.removeAttribute("data-image-ready");
      image.onload = () => {
        if (image.getAttribute("href") === source)
          svg.setAttribute("data-image-ready", "");
      };
      image.onerror = () => svg.removeAttribute("data-image-ready");
      if (source)
        image.setAttribute("href", source);
      else
        image.removeAttribute("href");
    }
  }

  // web/node_modules/@braccato/core/dist/engine/letterPlans.js
  var LETTER_WAVE_CREST_OFFSET = 0.4;
  var GECKO_REDRAW = isGecko();
  var GECKO_REDRAW_KEYFRAMES = [{ opacity: 0 }, { opacity: -2e-3 }, { opacity: 0 }];
  var GECKO_REDRAW_PERIOD_MS = 200;
  function swipeRamp({ highlight }) {
    return {
      easing: highlight.swipeEasing,
      startFrom: highlight.swipeStartFrom,
      startTo: highlight.swipeStartTo,
      endFrom: highlight.swipeEndFrom,
      endTo: highlight.swipeEndTo
    };
  }
  function linearForwardSwipeWindows(swipe2, letterCount, swipeDurationMs) {
    if (swipe2.easing !== "linear" || swipeDurationMs <= 0 || letterCount <= 0)
      return null;
    const startFrom = Number.parseFloat(swipe2.startFrom);
    const startTo = Number.parseFloat(swipe2.startTo);
    const endFrom = Number.parseFloat(swipe2.endFrom);
    const endTo = Number.parseFloat(swipe2.endTo);
    const finite = [startFrom, startTo, endFrom, endTo].every(Number.isFinite);
    if (!finite || startTo <= startFrom || endTo <= endFrom)
      return null;
    const startAt = (timeMs) => startFrom + (startTo - startFrom) * timeMs / swipeDurationMs;
    const endAt = (timeMs) => endFrom + (endTo - endFrom) * timeMs / swipeDurationMs;
    const timeWhenEndReaches = (value) => swipeDurationMs * (value - endFrom) / (endTo - endFrom);
    const timeWhenStartReaches = (value) => swipeDurationMs * (value - startFrom) / (startTo - startFrom);
    const windows = [];
    for (let index = 0; index < letterCount; index++) {
      const beginMs = clamp(timeWhenEndReaches(index / letterCount), 0, swipeDurationMs);
      const finishMs = clamp(timeWhenStartReaches((index + 1) / letterCount), 0, swipeDurationMs);
      windows.push({
        delayMs: beginMs,
        durationMs: Math.max(finishMs - beginMs, 1),
        from: { start: startAt(beginMs), end: endAt(beginMs) },
        to: { start: startAt(finishMs), end: endAt(finishMs) }
      });
    }
    return windows;
  }
  function planLetterWave(swipe2, letterCount, wordDurationMs, swipeDurationMs, swipeLeadMs, floatDurationMs) {
    const windows = linearForwardSwipeWindows({ ...swipe2, easing: "linear" }, letterCount, swipeDurationMs);
    if (!windows)
      return evenlySpreadWaves(letterCount, wordDurationMs, floatDurationMs);
    const riseMs = floatDurationMs * LETTER_WAVE_CREST_OFFSET;
    return windows.map((window2) => {
      const touchedMs = window2.delayMs - swipeLeadMs;
      const lightingMs = window2.durationMs;
      if (lightingMs > riseMs)
        return { delayMs: touchedMs, durationMs: lightingMs / LETTER_WAVE_CREST_OFFSET };
      return { delayMs: touchedMs + lightingMs - riseMs, durationMs: floatDurationMs };
    });
  }
  function evenlySpreadWaves(letterCount, wordDurationMs, floatDurationMs) {
    return Array.from({ length: letterCount }, (_, index) => ({
      delayMs: wordDurationMs * index / letterCount,
      durationMs: floatDurationMs
    }));
  }

  // web/node_modules/@braccato/core/dist/engine/sweepPlans.js
  function swipeStops(swipe2) {
    const startFrom = Number.parseFloat(swipe2.startFrom);
    const startTo = Number.parseFloat(swipe2.startTo);
    const fade = Number.parseFloat(swipe2.endTo) - startTo;
    if (![startFrom, startTo, fade].every(Number.isFinite) || startTo <= startFrom)
      return null;
    return { startFrom, startTo, fade: Math.max(fade, 0) };
  }
  var SWEEP_REST = 1.5;
  function cellFade(swipe2, span) {
    const stops = swipeStops(swipe2);
    return stops && span.width > 0 ? stops.fade / span.width : 0;
  }
  function cellReachedAt(swipe2, span) {
    return startStopReaches(swipe2, span.start);
  }
  function cellLitAt(swipe2, span) {
    return startStopReaches(swipe2, span.start + span.width);
  }
  function startStopReaches(swipe2, position) {
    const stops = swipeStops(swipe2);
    return stops ? clamp((position - stops.startFrom) / (stops.startTo - stops.startFrom), 0, 1) : 0;
  }
  function planCellSweep(swipe2, span, rtl) {
    const stops = swipeStops(swipe2);
    if (!stops || span.width <= 0)
      return null;
    const fade = stops.fade / span.width;
    const maskWidths = 3 + fade;
    const sign = rtl ? -1 : 1;
    const startAt = (progress) => (stops.startFrom + (stops.startTo - stops.startFrom) * progress - span.start) / span.width;
    const progressAt = (start) => (start * span.width + span.start - stops.startFrom) / (stops.startTo - stops.startFrom);
    const offsets = [0, progressAt(-fade), progressAt(SWEEP_REST), 1].map((offset) => clamp(offset, 0, 1));
    const unique = offsets.filter((offset, position) => offsets.indexOf(offset) === position);
    const mask = [];
    const text = [];
    for (const offset of unique) {
      const behind = sign * (clamp(startAt(offset), -fade, SWEEP_REST) - SWEEP_REST);
      mask.push({ offset, translate: `${behind * 100 / maskWidths}% 0` });
      text.push({ offset, translate: `${-behind * 100}% 0` });
    }
    return { mask, text };
  }

  // web/node_modules/@braccato/core/dist/engine/contextSweep.js
  function placeContextSweeps(line, config2) {
    for (const part of line.parts)
      if (part.sweepContext)
        part.sweepContext.unplaced = true;
    const placements = line.parts.flatMap((part) => part.sweepContext ? [measure(part)] : []);
    for (const placement of placements)
      if (placement)
        place(placement, config2);
  }
  var WORD_COLORS = ["--blyrics-lyric-active-color", "--blyrics-glow-color"];
  function measure(part) {
    const word = part.lyricElement;
    const run = word.closest(`.${BIDI_RUN_CLASS}:not(.${HIGHLIGHT_RUN_CLASS})`);
    const contentLine = run?.parentElement;
    if (!run || !contentLine || !part.sweepContext || typeof word.getClientRects !== "function")
      return null;
    const lineRect = contentLine.getBoundingClientRect();
    const scale = contentLine.offsetWidth > 0 ? lineRect.width / contentLine.offsetWidth : 1;
    const local = (rect) => ({
      x: (rect.left - lineRect.left) / scale,
      y: (rect.top - lineRect.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale
    });
    const runBox = local(run.getBoundingClientRect());
    const fragments = Array.from(word.getClientRects(), local).filter((box) => box.width > 0);
    if (fragments.length === 0)
      return null;
    const style = word.ownerDocument.defaultView?.getComputedStyle(part.highlightElement);
    const colors = WORD_COLORS.map((name) => [name, style?.getPropertyValue(name).trim() ?? ""]);
    const key = JSON.stringify([[runBox, fragments].flat().map((box) => Object.values(box).map(Math.round)), colors]);
    return { part, context: part.sweepContext, contentLine, run, runBox, fragments, colors, key };
  }
  function hasUnplacedContextSweeps(line) {
    return line.isAnimating && line.parts.some((part) => part.sweepContext?.unplaced);
  }
  function place({ part, context, contentLine, run, runBox, fragments, colors, key }, config2) {
    const placedAt = key + JSON.stringify(swipeRamp(config2));
    if (context.placedAt === placedAt && context.host?.isConnected) {
      context.unplaced = false;
      return;
    }
    context.host?.remove();
    const doc = contentLine.ownerDocument;
    const host = doc.createElement("span");
    host.classList.add(SWEEP_CONTEXT_CLASS);
    host.setAttribute("aria-hidden", "true");
    for (const [name, value] of colors)
      if (value)
        host.style.setProperty(name, value);
    const wordIndex = Array.from(run.querySelectorAll(`.${WORD_CLASS}`)).indexOf(part.lyricElement);
    const lineCopy = run.cloneNode(true);
    lineCopy.classList.add(SWEEP_CLONE_CLASS);
    lineCopy.querySelectorAll(`.${WORD_CLASS}`)[wordIndex]?.classList.add(SWEEP_TARGET_CLASS);
    const wordWidth = fragments.reduce((sum, box) => sum + box.width, 0);
    const direction = part.lyricElement.classList.contains(RTL_CLASS) ? "rtl" : "ltr";
    let start = 0;
    const cells = fragments.map((box) => {
      const window2 = doc.createElement("span");
      window2.classList.add(SWEEP_WINDOW_CLASS);
      window2.dir = direction;
      Object.assign(window2.style, {
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`
      });
      const span = { start: start / wordWidth, width: box.width / wordWidth };
      start += box.width;
      window2.style.setProperty("--blyrics-sweep-fade", String(cellFade(swipeRamp(config2), span)));
      const cell = createSweepCell(doc, window2, (into) => {
        const copy = lineCopy.cloneNode(true);
        Object.assign(copy.style, {
          left: `${runBox.x - box.x}px`,
          top: `${runBox.y - box.y}px`,
          width: `${runBox.width}px`
        });
        into.appendChild(copy);
        return void 0;
      });
      host.appendChild(window2);
      return { ...cell, span };
    });
    contentLine.appendChild(host);
    context.host = host;
    context.placedAt = placedAt;
    context.unplaced = false;
    part.sweep = cells.length > 0 ? cells : void 0;
  }

  // web/node_modules/@braccato/core/dist/engine/culling.js
  var ONE_VIEWPORT_OVERSCAN = "100% 0px 100% 0px";
  function setupLineCullObserver(engine) {
    engine.lineCullObserver?.disconnect();
    engine.lineCullObserver = null;
    clearOffscreenLineCulling(engine);
    const Observer = engine.window.IntersectionObserver;
    if (engine.layout === "stage" || typeof Observer !== "function" || engine.lines.length === 0)
      return;
    engine.host.getScrollElement()?.style.setProperty("overflow-anchor", "none");
    pinCulledLineHeights(engine);
    const observer = new Observer((entries) => {
      for (const entry of entries) {
        const element = entry.target;
        if (entry.isIntersecting) {
          if (engine.culledLineElements.delete(element))
            uncullLine(element);
          restartUnplacedLine(engine, element);
        } else if (!engine.culledLineElements.has(element)) {
          cullLine(element);
          engine.culledLineElements.add(element);
        }
      }
    }, { root: null, rootMargin: ONE_VIEWPORT_OVERSCAN, threshold: 0 });
    for (const line of engine.lines)
      observer.observe(line.lyricElement);
    engine.lineCullObserver = observer;
  }
  function restartUnplacedLine(engine, element) {
    const line = engine.lines.find((candidate) => candidate.lyricElement === element);
    if (line && hasUnplacedContextSweeps(line))
      resetLineAnimationState(line);
  }
  function clearOffscreenLineCulling(engine) {
    for (const element of engine.culledLineElements)
      uncullLine(element);
    engine.culledLineElements = /* @__PURE__ */ new Set();
  }
  function pinCulledLineHeights(engine) {
    const renderedHeights = engine.lines.map((line) => line.lyricElement.offsetHeight);
    engine.lines.forEach((line, index) => {
      line.lyricElement.style.setProperty("contain-intrinsic-block-size", `auto ${renderedHeights[index]}px`);
    });
  }
  function cullLine(element) {
    element.style.setProperty("content-visibility", "auto");
  }
  function uncullLine(element) {
    element.style.removeProperty("content-visibility");
  }
  function updateVisibleLyricWillChange(engine, lines, fromScrollTop, toScrollTop, viewportHeight) {
    const visibleElements = /* @__PURE__ */ new Set();
    for (const line of lines) {
      if (!isLineVisibleDuringScroll(line, fromScrollTop, toScrollTop, viewportHeight))
        continue;
      line.lyricElement.style.setProperty("will-change", LINE_SCROLL_WILL_CHANGE_VALUE);
      visibleElements.add(line.lyricElement);
    }
    for (const element of engine.visibleWillChangeElements) {
      if (!visibleElements.has(element))
        element.style.removeProperty("will-change");
    }
    engine.visibleWillChangeElements = visibleElements;
  }
  function clearVisibleLyricWillChange(engine) {
    for (const element of engine.visibleWillChangeElements)
      element.style.removeProperty("will-change");
    engine.visibleWillChangeElements = /* @__PURE__ */ new Set();
  }

  // web/node_modules/@braccato/core/dist/engine/motionPreference.js
  var REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  // web/node_modules/@braccato/core/dist/engine/decorationSlides.js
  var DECORATION_SLIDE_MS = 350;
  var DECORATION_SLIDE_EASING = "cubic-bezier(0.25, 1, 0.5, 1)";
  var DECORATION_MIN_SHIFT_PX = 0.5;
  function slideElementBy(engine, element, dy) {
    addElementCurve(engine, element, {
      kind: "slide",
      startMs: timelineNow(engine),
      durationMs: DECORATION_SLIDE_MS,
      fromPx: dy,
      toPx: 0,
      easing: DECORATION_SLIDE_EASING,
      endEasing: "linear"
    });
  }
  function decorationSlideAllowed(engine, container) {
    if (engine.window.matchMedia(REDUCED_MOTION_QUERY).matches)
      return false;
    return engine.window.getComputedStyle(container).getPropertyValue("--blyrics-animate-decoration-entry").trim() !== "0";
  }
  function lineDecorators(lineElement) {
    return [
      ...lineElement.querySelectorAll(`.${ROMANIZED_LYRICS_CLASS}`),
      ...lineElement.querySelectorAll(`.${TRANSLATED_LYRICS_CLASS}`)
    ];
  }
  function captureDecorationSlide(engine) {
    const container = engine.lyricsContainer;
    if (!container || engine.layout === "stage" || !decorationSlideAllowed(engine, container))
      return null;
    const before = engine.lines.map((line) => ({
      line,
      position: line.position,
      decorations: new Map(line.decorations)
    }));
    return () => {
      for (const { line, position, decorations } of before) {
        const lineShift = position - line.position;
        if (Math.abs(lineShift) >= DECORATION_MIN_SHIFT_PX)
          slideElementBy(engine, line.lyricElement, lineShift);
        for (const [element, was] of decorations) {
          const now = line.decorations.get(element);
          if (now === void 0)
            continue;
          const ownShift = was - now - lineShift;
          if (Math.abs(ownShift) >= DECORATION_MIN_SHIFT_PX)
            slideElementBy(engine, element, ownShift);
        }
      }
    };
  }

  // web/node_modules/@braccato/core/dist/stage.js
  var STAGE_LEAD_S = 0.5;
  var STAGE_HANDOFF_S = 0.12;
  var STAGE_OVERLAP_S = 0.15;
  function overlapsPrevious(items, index) {
    const previous = items[index - 1];
    return previous !== void 0 && previous.kind === "line" && items[index].kind !== "blank" && items[index].start < previous.end - STAGE_OVERLAP_S;
  }
  function stageEnterTimes(items) {
    return items.map((item, index) => {
      const early = item.start - STAGE_LEAD_S;
      const previous = items[index - 1];
      if (item.kind === "credits" && previous?.kind === "instrumental")
        return (previous.start + previous.end) / 2;
      if (previous?.kind !== "line" || overlapsPrevious(items, index))
        return early;
      return Math.max(early, Math.min(previous.end, item.start) - STAGE_HANDOFF_S);
    });
  }
  function planStage(items, timeS) {
    const enterTimes = stageEnterTimes(items);
    let current = -1;
    enterTimes.forEach((enterTime, index) => {
      if (enterTime <= timeS)
        current = index;
    });
    const roles = items.map((_, index) => index < current ? "gone" : index > current ? "queued" : "current");
    if (current < 0)
      return roles;
    const previous = items[current - 1];
    if (previous?.kind === "line" && overlapsPrevious(items, current) && timeS < previous.end) {
      roles[current - 1] = "previous";
    }
    return roles;
  }
  function stageTextSpan(offsetLeft, offsetWidth, box, textRects, padding, originX) {
    const whole = { left: offsetLeft, width: offsetWidth };
    if (box.width <= 0 || offsetWidth <= 0 || originX === 1)
      return whole;
    const scale = box.width / offsetWidth;
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    for (const rect of textRects) {
      if (rect.width <= 0)
        continue;
      start = Math.min(start, (rect.x - box.x) / scale);
      end = Math.max(end, (rect.x + rect.width - box.x) / scale);
    }
    if (start > end)
      return whole;
    const contentLeft = padding.left;
    const contentRight = offsetWidth - padding.right;
    if (originX === 0) {
      start = contentLeft;
    } else {
      const centre = (contentLeft + contentRight) / 2;
      const half = Math.max(end - centre, centre - start);
      start = centre - half;
      end = centre + half;
    }
    const left = Math.max(0, start - padding.left);
    const right = Math.min(offsetWidth, end + padding.right);
    return { left: offsetLeft + left, width: right - left };
  }
  function unionBox(box, next) {
    if (box === null)
      return next;
    const x = Math.min(box.x, next.x);
    const y = Math.min(box.y, next.y);
    return {
      x,
      y,
      width: Math.max(box.x + box.width, next.x + next.width) - x,
      height: Math.max(box.y + box.height, next.y + next.height) - y
    };
  }
  function queuedStageY(stageHeight, height, gap) {
    return stageHeight - height + gap;
  }
  function layoutStage(roles, items, metrics, previousY, geometry) {
    const { stageHeight, gap } = geometry;
    const current = roles.indexOf("current");
    const currentY = current >= 0 ? stageHeight - metrics[current].height : stageHeight;
    const placements = roles.map((role, index) => {
      const { height } = metrics[index];
      switch (role) {
        case "current":
          return { y: currentY, visible: true };
        case "previous":
          return { y: currentY - gap - height, visible: true };
        case "queued":
          return { y: queuedStageY(stageHeight, height, gap), visible: false };
        case "gone":
          return { y: previousY[index] ?? currentY, visible: false };
      }
    });
    let box = null;
    roles.forEach((role, index) => {
      const { kind } = items[index];
      if (role !== "current" && role !== "previous" || kind === "instrumental" || kind === "blank")
        return;
      const { height, left, width, originX } = metrics[index];
      const scale = geometry.activeScale;
      box = unionBox(box, {
        x: left + width * originX * (1 - scale),
        y: placements[index].y + height * (1 - scale) / 2,
        width: width * scale,
        height: height * scale
      });
    });
    return { placements, box };
  }

  // web/node_modules/@braccato/core/dist/engine/stageMotion.js
  var STAGE_MOTION = { durationMs: 380, easing: "cubic-bezier(0.2, 0, 0, 1)" };
  var STAGE_OPACITY_PROPERTY = "--blyrics-stage-opacity";
  var STAGE_FADE_IN_MS = 300;
  var STAGE_FADE_IN_DELAY_MS = 70;
  var STAGE_FADE_OUT_MS = 220;
  var HANDOFF_BLUR = "blur(3px)";
  var STAGE_GAP_EM = 0.32;
  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  var UNMEASURED = { height: 0, left: 0, width: 0, originX: 0 };
  var stageOpacityRegistrations = /* @__PURE__ */ new WeakSet();
  function applyStage(engine, timeS, instant) {
    const container = engine.lyricsContainer;
    if (!container)
      return;
    registerStageOpacity(engine);
    const { elements, items } = stageElements(engine);
    const roles = planStage(items, timeS);
    const key = roles.join(",");
    if (key === engine.stageKey && !instant)
      return;
    engine.stageKey = key;
    const remeasured = engine.stageRemeasured;
    engine.stageRemeasured = false;
    const metrics = elements.map((element) => engine.stageMetrics.get(element) ?? UNMEASURED);
    const geometry = {
      stageHeight: container.clientHeight,
      gap: engine.stageFontSize * STAGE_GAP_EM,
      activeScale: getCSSNumber(engine, container, "--blyrics-active-scale", 1)
    };
    const floorShift = remeasured && engine.stageHeight > 0 ? geometry.stageHeight - engine.stageHeight : 0;
    engine.stageHeight = geometry.stageHeight;
    const previousYs = elements.map((element) => {
      const y = engine.stageY.get(element);
      return y === void 0 ? null : y + floorShift;
    });
    const { placements, box } = layoutStage(roles, items, metrics, previousYs, geometry);
    const moves = prepareStageMoves(engine, elements, roles, placements, metrics, geometry, { remeasured, instant });
    const reduced = engine.window.matchMedia(REDUCED_MOTION_QUERY).matches;
    elements.forEach((element, index) => {
      if (element.dataset.stageRole !== roles[index])
        element.dataset.stageRole = roles[index];
    });
    for (const move of moves)
      placeStageElement(engine, move, instant, reduced);
    if (!sameBox(box, engine.stageBox)) {
      engine.stageBox = box;
      engine.host.onStageLayout?.(box);
    }
  }
  function prepareStageMoves(engine, elements, roles, placements, metrics, geometry, { remeasured, instant }) {
    const moves = [];
    elements.forEach((element, index) => {
      const placement = placements[index];
      const role = element.dataset.stageRole;
      const previousY = engine.stageY.get(element);
      const wasVisible = role !== void 0 && isStageRoleVisible(role);
      const onScreen = placement.visible || element.dataset.stageVisible !== void 0;
      if (remeasured && !instant && onScreen && role === roles[index]) {
        if (previousY !== placement.y)
          snapStageElement(engine, element, placement.y);
        return;
      }
      const unchanged = previousY !== void 0 && wasVisible === placement.visible && (!placement.visible || previousY === placement.y);
      if (unchanged && !instant)
        return;
      const risesFromBelowFloor = role === "queued" && placement.visible;
      moves.push({
        element,
        placement,
        wasVisible,
        fromY: risesFromBelowFloor ? queuedStageY(geometry.stageHeight, metrics[index].height, geometry.gap) : currentTranslateY(engine, element, previousY ?? placement.y),
        fromOpacity: Number(engine.window.getComputedStyle(element).opacity) || 0
      });
    });
    return moves;
  }
  function placeStageElement(engine, { element, placement, wasVisible, fromY, fromOpacity }, instant, reduced) {
    engine.stageMoves.get(element)?.cancel();
    engine.stageFades.get(element)?.cancel();
    engine.stageMoves.set(element, element.animate([{ translate: `0 ${fromY}px` }, { translate: `0 ${placement.y}px` }], {
      duration: instant || reduced ? 0 : STAGE_MOTION.durationMs,
      easing: STAGE_MOTION.easing,
      fill: "forwards"
    }));
    const showing = placement.visible;
    const fadeMs = instant ? 0 : showing ? STAGE_FADE_IN_MS : STAGE_FADE_OUT_MS;
    const delayMs = showing && !instant ? STAGE_FADE_IN_DELAY_MS : 0;
    if (showing)
      element.dataset.stageVisible = "";
    else if (fadeMs === 0)
      delete element.dataset.stageVisible;
    const fade = element.animate([{ [STAGE_OPACITY_PROPERTY]: fromOpacity }, { [STAGE_OPACITY_PROPERTY]: showing ? 1 : 0 }], {
      duration: fadeMs,
      delay: delayMs,
      easing: showing ? "ease-out" : "ease",
      // Backwards fill preserves the sampled opacity during the replacement fade's delay.
      fill: "both"
    });
    if (!showing && fadeMs > 0) {
      fade.onfinish = () => {
        if (engine.stageFades.get(element) === fade)
          delete element.dataset.stageVisible;
      };
    }
    engine.stageFades.set(element, fade);
    engine.stageY.set(element, placement.y);
    engine.stageBlurs.get(element)?.cancel();
    engine.stageBlurs.delete(element);
    if (fadeMs === 0 || reduced || wasVisible === showing)
      return;
    const blurs = showing ? [HANDOFF_BLUR, "none"] : ["none", HANDOFF_BLUR];
    engine.stageBlurs.set(element, element.animate(blurs.map((filter) => ({ filter })), {
      duration: fadeMs,
      delay: showing ? STAGE_FADE_IN_DELAY_MS : 0,
      easing: showing ? "ease-out" : "ease",
      // Add to the theme's filter; release the blur once focused.
      composite: "add",
      fill: showing ? "backwards" : "forwards"
    }));
  }
  function snapStageElement(engine, element, y) {
    engine.stageMoves.get(element)?.cancel();
    engine.stageMoves.set(element, element.animate([{ translate: `0 ${y}px` }], { duration: 0, fill: "forwards" }));
    engine.stageY.set(element, y);
  }
  function registerStageOpacity(engine) {
    const css = engine.window.CSS;
    if (stageOpacityRegistrations.has(engine.window) || typeof css?.registerProperty !== "function")
      return;
    stageOpacityRegistrations.add(engine.window);
    try {
      css.registerProperty({ name: STAGE_OPACITY_PROPERTY, syntax: "<number>", inherits: false, initialValue: "0" });
    } catch (error) {
      engine.host.log("Stage opacity property was already registered", error);
    }
  }
  function measureStage(engine) {
    engine.stageMetrics.clear();
    const container = engine.lyricsContainer;
    if (!container)
      return;
    engine.stageFontSize = Number.parseFloat(engine.window.getComputedStyle(container).fontSize) || 16;
    const range = engine.document.createRange();
    for (const element of stageElements(engine).elements) {
      const style = engine.window.getComputedStyle(element);
      const originX = originXOf(style.textAlign);
      const padding = {
        left: Number.parseFloat(style.paddingLeft) || 0,
        right: Number.parseFloat(style.paddingRight) || 0
      };
      const contentRects = collectContentRects(engine, range, element, contentWidthOf(element, style), []);
      const span = stageTextSpan(element.offsetLeft, element.offsetWidth, element.getBoundingClientRect(), contentRects, padding, originX);
      engine.stageMetrics.set(element, { height: element.offsetHeight, left: span.left, width: span.width, originX });
    }
    forceStageReplan(engine);
    engine.stageRemeasured = true;
  }
  function replaceStageElements(engine, dropped, previousOf) {
    for (const [line, previous] of previousOf)
      carryStageState(engine, previous.lyricElement, line.lyricElement);
    for (const line of dropped)
      forgetStageElement(engine, line.lyricElement);
    forceStageReplan(engine);
  }
  function carryStageState(engine, from, to) {
    const role = from.dataset.stageRole;
    const y = engine.stageY.get(from);
    if (role === void 0 || y === void 0)
      return;
    to.dataset.stageRole = role;
    if (from.dataset.stageVisible !== void 0)
      to.dataset.stageVisible = "";
    const move = continueAnimation(engine.stageMoves.get(from), to);
    if (move === null) {
      snapStageElement(engine, to, y);
    } else {
      engine.stageMoves.set(to, move);
      engine.stageY.set(to, y);
    }
    const visible = isStageRoleVisible(role);
    const fade = continueAnimation(engine.stageFades.get(from), to) ?? to.animate([{ [STAGE_OPACITY_PROPERTY]: visible ? 1 : 0 }], { duration: 0, fill: "forwards" });
    if (!visible) {
      fade.onfinish = () => {
        if (engine.stageFades.get(to) === fade)
          delete to.dataset.stageVisible;
      };
    }
    engine.stageFades.set(to, fade);
    const blur = continueAnimation(engine.stageBlurs.get(from), to);
    if (blur !== null)
      engine.stageBlurs.set(to, blur);
  }
  function forgetStageElement(engine, element) {
    for (const animations of [engine.stageMoves, engine.stageFades, engine.stageBlurs]) {
      animations.get(element)?.cancel();
      animations.delete(element);
    }
    engine.stageY.delete(element);
    engine.stageMetrics.delete(element);
  }
  function resetStage(engine) {
    for (const animations of [engine.stageMoves, engine.stageFades, engine.stageBlurs]) {
      for (const animation of animations.values())
        animation.cancel();
      animations.clear();
    }
    engine.stageMetrics.clear();
    engine.stageY.clear();
    forceStageReplan(engine);
    engine.stageHeight = 0;
    if (engine.stageBox !== null) {
      engine.stageBox = null;
      engine.host.onStageLayout?.(null);
    }
  }
  function currentTranslateY(engine, element, fallback) {
    const y = Number.parseFloat(engine.window.getComputedStyle(element).translate.split(" ")[1] ?? "");
    return Number.isFinite(y) ? y : fallback;
  }
  function forceStageReplan(engine) {
    engine.stageKey = "";
  }
  function continueAnimation(animation, element) {
    const effect = animation?.effect;
    if (!animation || typeof effect?.getKeyframes !== "function")
      return null;
    if (animation.playState === "finished" || animation.playState === "idle")
      return null;
    const continued = element.animate(effect.getKeyframes(), { ...effect.getTiming(), composite: effect.composite });
    continued.playbackRate = animation.playbackRate;
    continued.currentTime = animation.currentTime;
    if (animation.playState === "paused")
      continued.pause();
    return continued;
  }
  function stageElements(engine) {
    const elements = [];
    const items = [];
    let lastEnd = 0;
    for (const line of engine.lines) {
      const end = line.time + line.duration;
      lastEnd = Math.max(lastEnd, end);
      elements.push(line.lyricElement);
      items.push({ kind: stageItemKind(line.lyricElement), start: line.time, end });
    }
    const credits = engine.lyricsContainer?.querySelector(`:scope > .${CREDITS_CLASS}`);
    if (credits) {
      elements.push(credits);
      items.push({ kind: "credits", start: lastEnd, end: Number.POSITIVE_INFINITY });
    }
    return { elements, items };
  }
  function stageItemKind(element) {
    if (element.dataset.instrumental === "true")
      return "instrumental";
    if (element.dataset.blank === "true")
      return "blank";
    return "line";
  }
  function isStageRoleVisible(role) {
    return role !== "queued" && role !== "gone";
  }
  function sameBox(a, b) {
    if (a === null || b === null)
      return a === b;
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  }
  function originXOf(align) {
    if (align === "center")
      return 0.5;
    if (align === "right" || align === "end")
      return 1;
    return 0;
  }
  function contentWidthOf(element, style) {
    const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
    return element.clientWidth - padding;
  }
  function fillsWidth(element, contentWidth) {
    return element.offsetWidth >= contentWidth - 1;
  }
  function collectContentRects(engine, range, node, contentWidth, rects) {
    for (const child of node.childNodes) {
      if (child.nodeType === TEXT_NODE) {
        range.selectNodeContents(child);
        rects.push(...range.getClientRects());
        continue;
      }
      if (child.nodeType !== ELEMENT_NODE)
        continue;
      const element = child;
      const style = engine.window.getComputedStyle(element);
      if (style.display === "none")
        continue;
      if (style.display === "contents")
        collectContentRects(engine, range, element, contentWidth, rects);
      else if (style.display.startsWith("inline"))
        rects.push(...element.getClientRects());
      else if (!fillsWidth(element, contentWidth))
        rects.push(element.getBoundingClientRect());
      else
        collectContentRects(engine, range, element, contentWidthOf(element, style), rects);
    }
    return rects;
  }

  // web/node_modules/@braccato/core/dist/engine/renderedLines.js
  function clearOnScreenLyrics(engine) {
    if (!engine.lyricsContainer)
      return false;
    engine.lyricsContainer.replaceChildren();
    resetStage(engine);
    return true;
  }
  function getRenderedLines(engine) {
    return engine.lines;
  }
  function getRenderedSyncType(engine) {
    return engine.syncType;
  }
  function clearLyrics(engine) {
    engine.scrollPos = -1;
    dropPendingLineScroll(engine);
    stopAllElementMotion(engine);
    clearVisibleLyricWillChange(engine);
    engine.lineCullObserver?.disconnect();
    engine.lineCullObserver = null;
    clearOffscreenLineCulling(engine);
    for (const line of engine.lines) {
      resetLineAnimationState(line);
      line.isSelected = false;
    }
    engine.skipScrollsDecayTimes = [];
    engine.lastScrollElements = [];
    engine.pinnedScrollLine = null;
    engine.lastScrollDebugContext.activeElms = [];
    engine.lastScrollDebugContext.centers = [];
    engine.passiveScrollAccumulatedTime = 0;
    engine.passiveLastWallTime = 0;
    engine.passiveScrollTop = null;
    stopPassiveScrollLoop(engine);
    engine.lines = [];
    engine.cachedFooterItem = null;
    engine.cachedCreditsItem = null;
    engine.creditsFocused = false;
    engine.lyricsContainer = null;
    engine.waveAnimationPool.length = 0;
    resetStage(engine);
  }
  function replaceRenderedLines(engine, lines, dropped, previousOf) {
    for (const [line, previous] of previousOf)
      carrySelection(line, previous);
    dropPendingLineScroll(engine);
    const droppedElements = new Set(dropped.map((line) => line.lyricElement));
    for (const element of droppedElements)
      stopElementMotion(engine, element);
    for (const line of dropped) {
      resetLineAnimationState(line);
      line.isSelected = false;
      engine.visibleWillChangeElements.delete(line.lyricElement);
      engine.culledLineElements.delete(line.lyricElement);
    }
    const successorOf = /* @__PURE__ */ new Map();
    for (const [line, previous] of previousOf)
      successorOf.set(previous, line);
    const carry = (line) => successorOf.get(line) ?? (droppedElements.has(line.lyricElement) ? null : line);
    const carryAll = (from) => from.map(carry).filter((line) => line !== null);
    engine.lastScrollElements = carryAll(engine.lastScrollElements);
    engine.lastScrollDebugContext.activeElms = carryAll(engine.lastScrollDebugContext.activeElms);
    engine.pinnedScrollLine = engine.pinnedScrollLine === null ? null : carry(engine.pinnedScrollLine);
    engine.lines = lines;
    if (engine.layout === "stage")
      replaceStageElements(engine, dropped, previousOf);
  }
  function carrySelection(line, previous) {
    line.isScrolled = previous.isScrolled;
    line.isSelected = previous.isSelected;
    togglePartClass(line, CURRENT_LYRICS_CLASS, previous.lyricElement.classList.contains(CURRENT_LYRICS_CLASS));
    togglePartClass(line, ANIMATING_CLASS, previous.lyricElement.classList.contains(ANIMATING_CLASS));
  }
  function settleSwappedLines(engine, before, scrollTopBefore) {
    const container = engine.lyricsContainer;
    const scroller = engine.host.getScrollElement();
    if (container === null || scroller === null || engine.layout === "stage")
      return;
    const now = Date.now();
    const followed = followedLine(engine, before, scrollTopBefore, now);
    const followedWas = followed === void 0 ? void 0 : before.get(followed)?.position;
    if (followed !== void 0 && followedWas !== void 0 && isMeasured(followedWas) && isMeasured(followed.position)) {
      const moved = followed.position - followedWas;
      if (Math.abs(moved) >= DECORATION_MIN_SHIFT_PX)
        scroller.scrollTop = scrollTopBefore + moved;
    }
    const appliedShift = scroller.scrollTop - scrollTopBefore;
    if (appliedShift !== 0) {
      noteEngineScrollEvent(engine, now);
      if (engine.scrollPos >= 0)
        engine.scrollPos += appliedShift;
    }
    if (!decorationSlideAllowed(engine, container))
      return;
    for (const line of engine.lines) {
      const was = before.get(line);
      if (was === void 0 || !isMeasured(was.position) || !isMeasured(line.position))
        continue;
      const onScreenShift = was.position + was.motionOffset - line.position + appliedShift;
      if (Math.abs(onScreenShift) >= DECORATION_MIN_SHIFT_PX)
        slideElementBy(engine, line.lyricElement, onScreenShift);
    }
  }
  function followedLine(engine, before, scrollTopBefore, now) {
    const readerOwnsScroll = engine.scrollResumeTime > now;
    if (readerOwnsScroll) {
      return engine.lines.find((line) => {
        const was = before.get(line);
        return was !== void 0 && was.position + was.height > scrollTopBefore;
      });
    }
    return engine.lastScrollElements.findLast((line) => before.has(line)) ?? engine.lines.find((line) => before.has(line) && line.isScrolled);
  }
  function isMeasured(position) {
    return position >= 0;
  }

  // web/node_modules/@braccato/core/dist/engine/scrollViewport.js
  var TARGET_SCROLL_POSITION_RATIO = registerThemeSetting("blyrics-target-scroll-pos-ratio", 0.37);
  var NO_SCROLL_INSETS = { top: 0, bottom: 0 };
  function getTargetScrollRatio(engine, lyricsElement) {
    const themed = Number.parseFloat(getCSSValue(engine, lyricsElement, "--blyrics-target-scroll-pos-ratio", ""));
    return Number.isFinite(themed) ? clamp(themed, 0, 1) : TARGET_SCROLL_POSITION_RATIO.getNumberValue();
  }
  function setupTabRendererObserver(engine, element) {
    engine.tabRendererResizeObserver?.disconnect();
    engine.tabRendererResizeObserver = new engine.window.ResizeObserver(() => {
      dropPendingLineScroll(engine);
      if (element.isConnected)
        measureScrollViewport(engine, element);
    });
    engine.tabRendererResizeObserver.observe(element);
    engine.observedTabRenderer = element;
    measureScrollViewport(engine, element);
  }
  function measureScrollViewport(engine, element) {
    const height = element.getBoundingClientRect().height;
    const { scrollPaddingTop, scrollPaddingBottom } = engine.window.getComputedStyle(element);
    engine.cachedTabRendererHeight = height;
    engine.cachedScrollInsets = resolveScrollInsets(scrollPaddingTop, scrollPaddingBottom, height);
  }
  function resolveScrollInsets(scrollPaddingTop, scrollPaddingBottom, viewportHeight) {
    const top = resolveScrollInset(scrollPaddingTop, viewportHeight);
    const bottom = resolveScrollInset(scrollPaddingBottom, viewportHeight);
    const leavesABand = top + bottom < viewportHeight;
    return leavesABand ? { top, bottom } : NO_SCROLL_INSETS;
  }
  function resolveScrollInset(value, viewportHeight) {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount) || amount <= 0)
      return 0;
    return value.trim().endsWith("%") ? viewportHeight * amount / 100 : amount;
  }
  function findScrollAnchor(sungLines, scrollTime) {
    const latestRunning = sungLines.findLast((line) => line.time <= scrollTime && scrollTime < line.time + line.duration);
    return latestRunning ?? sungLines.findLast((line) => line.time <= scrollTime) ?? sungLines[0];
  }
  function computeActiveLinesScrollTop(sungLines, anchor, viewportHeight, insets, targetOffset) {
    const first = sungLines[0];
    const last = sungLines[sungLines.length - 1];
    const visibleBottom = viewportHeight - insets.bottom;
    const clampToLineBounds = (scrollTop, line) => Math.min(Math.max(scrollTop, line.position + line.height - visibleBottom), line.position - insets.top);
    const averageCentre = sungLines.reduce((total, line) => total + line.position + line.height / 2, 0) / sungLines.length;
    const showingLast = clampToLineBounds(averageCentre - targetOffset, last);
    const showingFirstTop = Math.min(showingLast, first.position - insets.top);
    return {
      scrollTop: clampToLineBounds(showingFirstTop, anchor),
      overflowsBand: last.position + last.height - first.position > visibleBottom - insets.top
    };
  }
  function computeScrollPadding(measurements) {
    const { viewportHeight, targetScrollRatio, lastLineCentre } = measurements;
    const contentHeight = measurements.contentHeightWithoutBottomPadding;
    const belowTarget = viewportHeight * (1 - targetScrollRatio);
    const top = Math.max(0, viewportHeight * targetScrollRatio - measurements.firstLineHeight / 2);
    const lastLineAtTarget = (lastLineCentre === null ? viewportHeight : lastLineCentre + belowTarget) - contentHeight;
    const fillsViewport = viewportHeight - contentHeight;
    const unrenderedFloor = belowTarget - (measurements.footerHeight + measurements.lastLineHeight / 2);
    const bottom = Math.max(lastLineAtTarget, fillsViewport, unrenderedFloor, 0);
    return { top, bottom: Math.ceil(bottom) };
  }
  function applyScrollPadding(engine) {
    const lyricsElement = engine.lyricsContainer;
    const scroller = engine.host.getScrollElement();
    if (!lyricsElement || !scroller)
      return;
    if (hasNoLyricsPlaceholder(engine)) {
      setScrollPadding(engine, lyricsElement, { top: 0, bottom: 0 });
      return;
    }
    const bounds = (element) => element ? getRelativeLayoutBounds(lyricsElement, element) : null;
    const child = (className) => lyricsElement.querySelector(`:scope > .${className}`);
    const lines = lyricsElement.querySelectorAll(`:scope > .${LINE_CLASS}`);
    const creditsBounds = bounds(child(CREDITS_CLASS));
    const lastTargetBounds = creditsBounds && creditsBounds.height > 0 ? creditsBounds : bounds(lines[lines.length - 1] ?? null);
    const currentBottomPadding = Number.parseFloat(engine.window.getComputedStyle(lyricsElement).paddingBottom) || 0;
    setScrollPadding(engine, lyricsElement, computeScrollPadding({
      viewportHeight: scroller.getBoundingClientRect().height,
      targetScrollRatio: getTargetScrollRatio(engine, lyricsElement),
      contentHeightWithoutBottomPadding: Math.max(0, lyricsElement.scrollHeight - currentBottomPadding),
      firstLineHeight: bounds(lines[0] ?? null)?.height ?? 0,
      lastLineCentre: lastTargetBounds ? lastTargetBounds.y + lastTargetBounds.height / 2 : null,
      lastLineHeight: lastTargetBounds?.height ?? 0,
      footerHeight: bounds(child(FOOTER_CLASS))?.height ?? 0
    }));
  }
  function setScrollPadding(engine, lyricsElement, { top, bottom }) {
    const rootStyle = engine.document.documentElement.style;
    rootStyle.setProperty("--blyrics-padding-top", `${top}px`);
    rootStyle.setProperty("--blyrics-padding-bottom", `${bottom}px`);
    lyricsElement.style.setProperty("padding-bottom", `${bottom}px`);
  }

  // web/node_modules/@braccato/core/dist/engine/glow.js
  var HALF_8BIT_ALPHA_STEP = 0.5 / 255;
  function resolveGlowFilter(engine, lyricsElement, end, defaultRadius) {
    const override = getCSSValue(engine, lyricsElement, `--blyrics-highlight-glow-filter-${end}`, "");
    if (override)
      return override;
    const radius = getCSSValue(engine, lyricsElement, `--blyrics-highlight-glow-radius-${end}`, defaultRadius);
    return `drop-shadow(0 0 ${radius} var(--blyrics-glow-color))`;
  }
  function isGlowRestingInvisible(glowTo) {
    const value = glowTo.trim();
    if (value === "" || value === "none")
      return true;
    const engineDropShadow = value.match(/^drop-shadow\(\s*0\s+0\s+(\S+)\s+var\(--blyrics-glow-color\)\)$/);
    return engineDropShadow ? Number.parseFloat(engineDropShadow[1]) === 0 : false;
  }
  function suppressInvisibleWordGlows(engine, line, config2) {
    const containerGlowShows = config2.highlight.glowContainerAlpha >= HALF_8BIT_ALPHA_STEP;
    if (containerGlowShows) {
      for (const part of line.parts)
        part.glowSuppressed = false;
      return;
    }
    for (const part of line.parts) {
      const color = engine.window.getComputedStyle(part.highlightElement).getPropertyValue("--blyrics-glow-color");
      const alpha = parseColorAlpha(color) ?? 1;
      part.glowSuppressed = alpha < HALF_8BIT_ALPHA_STEP;
    }
  }
  function parseColorAlpha(value) {
    const color = value.trim().toLowerCase();
    if (color === "")
      return null;
    if (color === "transparent")
      return 0;
    const slashAlpha = color.match(/\/\s*([0-9]*\.?[0-9]+%?)\s*\)\s*$/);
    if (slashAlpha)
      return alphaToken(slashAlpha[1]);
    const commaAlpha = color.match(/^(?:rgba|hsla)\([^)]*,\s*([0-9]*\.?[0-9]+%?)\s*\)$/);
    if (commaAlpha)
      return alphaToken(commaAlpha[1]);
    const hexWithAlpha = color.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/);
    if (hexWithAlpha) {
      const digits = hexWithAlpha[1];
      const alphaHex = digits.length === 8 ? digits.slice(6) : digits.slice(3).repeat(2);
      return Number.parseInt(alphaHex, 16) / 255;
    }
    const opaqueFunction = /^(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(/.test(color);
    const opaqueHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(color);
    const namedColor = /^[a-z]+$/.test(color);
    return opaqueFunction || opaqueHex || namedColor ? 1 : null;
  }
  function alphaToken(token) {
    const value = token.endsWith("%") ? Number.parseFloat(token) / 100 : Number.parseFloat(token);
    return clamp(value, 0, 1);
  }

  // web/node_modules/@braccato/core/dist/instrumental.js
  var INSTRUMENTAL_WAVE_PATH_HIGH = "M -4 3 Q 1 2 5 3 Q 10 4 14 3 Q 18 2 22 3 Q 26 4 30 3 L 30 4 L -4 4 Z";
  var INSTRUMENTAL_WAVE_PATH_LOW = "M -4 3 Q 1 4 5 3 Q 10 2 14 3 Q 18 4 22 3 Q 26 2 30 3 L 30 4 L -4 4 Z";
  var nextInstrumentalId = 0;
  function createInstrumentalElement(doc, container, durationMs) {
    container.classList.add("blyrics--instrumental");
    container.style.setProperty("--blyrics-duration", `${durationMs}ms`);
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = doc.createElementNS(svgNS, "svg");
    svg.classList.add("blyrics--instrumental-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    const defs = doc.createElementNS(svgNS, "defs");
    const idSuffix = nextInstrumentalId++;
    const filterId = `blyrics-glow-${idSuffix}`;
    const clipId = `blyrics-wave-clip-${idSuffix}`;
    const filter = doc.createElementNS(svgNS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-100%");
    filter.setAttribute("y", "-100%");
    filter.setAttribute("width", "300%");
    filter.setAttribute("height", "300%");
    const feGaussianBlur = doc.createElementNS(svgNS, "feGaussianBlur");
    feGaussianBlur.setAttribute("in", "SourceGraphic");
    feGaussianBlur.setAttribute("stdDeviation", "5");
    feGaussianBlur.setAttribute("result", "blur");
    filter.appendChild(feGaussianBlur);
    const feColorMatrix = doc.createElementNS(svgNS, "feColorMatrix");
    feColorMatrix.setAttribute("in", "blur");
    feColorMatrix.setAttribute("type", "matrix");
    feColorMatrix.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.6 0");
    feColorMatrix.setAttribute("result", "fadedBlur");
    filter.appendChild(feColorMatrix);
    const feMerge = doc.createElementNS(svgNS, "feMerge");
    const feMergeNode1 = doc.createElementNS(svgNS, "feMergeNode");
    feMergeNode1.setAttribute("in", "fadedBlur");
    feMerge.appendChild(feMergeNode1);
    const feMergeNode2 = doc.createElementNS(svgNS, "feMergeNode");
    feMergeNode2.setAttribute("in", "SourceGraphic");
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feMerge);
    defs.appendChild(filter);
    const clipPath = doc.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipId);
    clipPath.classList.add("blyrics--wave-clip");
    const waveRect = doc.createElementNS(svgNS, "path");
    waveRect.classList.add("blyrics--wave-rect");
    waveRect.setAttribute("d", "M -4 3.9 L 30 3.9 L 30 30 L -4 30 Z");
    clipPath.appendChild(waveRect);
    const wavePath = doc.createElementNS(svgNS, "path");
    wavePath.classList.add("blyrics--wave-path");
    wavePath.setAttribute("d", INSTRUMENTAL_WAVE_PATH_HIGH);
    clipPath.appendChild(wavePath);
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    const bgPath = doc.createElementNS(svgNS, "path");
    bgPath.classList.add("blyrics--instrumental-bg");
    bgPath.setAttribute("d", "M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21");
    svg.appendChild(bgPath);
    const g = doc.createElementNS(svgNS, "g");
    g.setAttribute("filter", `url(#${filterId})`);
    const fillPath = doc.createElementNS(svgNS, "path");
    fillPath.classList.add("blyrics--instrumental-fill");
    fillPath.setAttribute("clip-path", `url(#${clipId})`);
    fillPath.setAttribute("d", "M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21");
    if (imageHighlights.getBooleanValue()) {
      fillPath.classList.remove("blyrics--instrumental-fill");
      fillPath.classList.add("blyrics-instrumental-color");
      const fill = doc.createElementNS(svgNS, "g");
      fill.classList.add("blyrics--instrumental-fill");
      fill.appendChild(fillPath);
      const shapeId = `${clipId}-image-shape`;
      const shape = doc.createElementNS(svgNS, "clipPath");
      shape.setAttribute("id", shapeId);
      const shapePath = doc.createElementNS(svgNS, "path");
      shapePath.setAttribute("d", fillPath.getAttribute("d"));
      shape.appendChild(shapePath);
      defs.appendChild(shape);
      const silhouette = doc.createElementNS(svgNS, "g");
      silhouette.setAttribute("clip-path", `url(#${shapeId})`);
      const wave = doc.createElementNS(svgNS, "g");
      wave.setAttribute("clip-path", `url(#${clipId})`);
      const image = doc.createElementNS(svgNS, "image");
      image.classList.add("blyrics-instrumental-image");
      image.setAttribute("x", "0");
      image.setAttribute("y", "0");
      image.setAttribute("width", "24");
      image.setAttribute("height", "24");
      image.setAttribute("preserveAspectRatio", "none");
      wave.appendChild(image);
      silhouette.appendChild(wave);
      fill.appendChild(silhouette);
      g.appendChild(fill);
      filter.setAttribute("color-interpolation-filters", "sRGB");
      feGaussianBlur.setAttribute("stdDeviation", "1");
      filter.removeChild(feColorMatrix);
      feMergeNode1.setAttribute("in", "blur");
    } else {
      g.appendChild(fillPath);
    }
    svg.appendChild(g);
    container.appendChild(svg);
    return container;
  }

  // web/node_modules/@braccato/core/dist/engine/animationTiming.js
  var songClockTracks = /* @__PURE__ */ new WeakMap();
  function followSongClock(engine, animation, track) {
    songClockTracks.set(animation, {
      ...track,
      appliedTimingOffsetMs: track.appliedTimingOffsetMs ?? engine.learnedAnimationTimingOffsetMs
    });
    animation.playbackRate = engine.playbackRate;
    return animation;
  }
  function mirrorHighlightAnimations(part, animations) {
    const target = part.sweepContext?.host;
    if (!target)
      return [];
    const mirrors = [];
    for (const animation of animations) {
      const effect = animation.effect;
      if (!effect || effect.target !== part.highlightElement)
        continue;
      const mirror = target.animate(effect.getKeyframes(), effect.getTiming());
      mirror.playbackRate = animation.playbackRate;
      mirror.currentTime = animation.currentTime;
      const track = songClockTracks.get(animation);
      if (track)
        songClockTracks.set(mirror, { ...track, skipDriftSample: true });
      mirrors.push(mirror);
    }
    return mirrors;
  }
  function applyPlaybackRateToRunningAnimations(engine) {
    const followRate = (animations) => {
      for (const animation of animations) {
        if (songClockTracks.has(animation))
          animation.playbackRate = engine.playbackRate;
      }
    };
    for (const line of engine.lines) {
      followRate(line.animations);
      for (const part of line.parts)
        followRate(part.animations);
    }
  }
  function correctedAnimationTimeMs(targetTimeMs, appliedTimingOffsetMs, maxTimeMs) {
    const scheduledTimeMs2 = targetTimeMs - appliedTimingOffsetMs;
    return maxTimeMs === void 0 ? scheduledTimeMs2 : Math.min(scheduledTimeMs2, maxTimeMs);
  }
  function correctedWrappedAnimationTimeMs(targetTimeMs, appliedTimingOffsetMs, wrapDurationMs) {
    return positiveModulo(targetTimeMs - appliedTimingOffsetMs, wrapDurationMs);
  }
  function correctedScrollTimeS(engine, lyricTimeS) {
    return lyricTimeS - engine.learnedAnimationTimingOffsetMs / 1e3;
  }
  function largestDriftSample(line, lyricTimeS) {
    let largest = accumulateLargestDriftSample(line, lyricTimeS, null);
    for (const part of line.parts)
      largest = accumulateLargestDriftSample(part, lyricTimeS, largest);
    return largest;
  }
  function accumulateLargestDriftSample(part, lyricTimeS, largest) {
    for (const animation of part.animations) {
      const sample = driftSample(part, animation, lyricTimeS);
      if (sample && (!largest || Math.abs(sample.offsetMs) > Math.abs(largest.offsetMs)))
        largest = sample;
    }
    return largest;
  }
  function driftSample(part, animation, lyricTimeS) {
    const track = songClockTracks.get(animation);
    if (!track || track.skipDriftSample || animation.playState === "idle")
      return null;
    const rawActualTimeMs = timingValueToMs(animation.currentTime);
    if (rawActualTimeMs === null)
      return null;
    const expectedTimeMs = normalizedTimeMs(animation, (lyricTimeS - part.time) * 1e3 + track.offsetMs, track);
    const actualTimeMs = normalizedTimeMs(animation, rawActualTimeMs, track);
    if (expectedTimeMs === null || actualTimeMs === null)
      return null;
    const wrapDurationMs = track.wrapDurationMs ?? 0;
    const offsetMs = wrapDurationMs > 0 ? wrappedOffsetMs(actualTimeMs, expectedTimeMs, wrapDurationMs) : actualTimeMs - expectedTimeMs;
    return {
      actualTimeMs,
      appliedTimingOffsetMs: track.appliedTimingOffsetMs,
      biasOffsetMs: offsetMs + track.appliedTimingOffsetMs,
      expectedTimeMs,
      offsetMs,
      playState: animation.playState
    };
  }
  function normalizedTimeMs(animation, timeMs, track) {
    if (!Number.isFinite(timeMs) || timeMs < 0)
      return null;
    if (track.wrapDurationMs && track.wrapDurationMs > 0)
      return positiveModulo(timeMs, track.wrapDurationMs);
    const endTimeMs = timingValueToMs(animation.effect?.getComputedTiming().endTime);
    return endTimeMs !== null && Number.isFinite(endTimeMs) ? Math.min(timeMs, endTimeMs) : timeMs;
  }
  function wrappedOffsetMs(actualTimeMs, expectedTimeMs, wrapDurationMs) {
    return positiveModulo(actualTimeMs - expectedTimeMs + wrapDurationMs / 2, wrapDurationMs) - wrapDurationMs / 2;
  }
  function timingValueToMs(value) {
    if (typeof value === "number")
      return Number.isFinite(value) || value === Number.POSITIVE_INFINITY ? value : null;
    if (typeof value === "string") {
      const durationMs = toMs(value);
      return durationMs > 0 ? durationMs : null;
    }
    const numeric = value;
    if (typeof numeric?.to !== "function")
      return null;
    try {
      const ms = numeric.to("ms").value;
      return typeof ms === "number" && Number.isFinite(ms) ? ms : null;
    } catch {
      return null;
    }
  }

  // web/node_modules/@braccato/core/dist/engine/instrumentalAnimations.js
  var FILL_SELECTOR = ".blyrics--instrumental-fill";
  var WAVE_CLIP_SELECTOR = ".blyrics--wave-clip";
  var WAVE_PATH_SELECTOR = ".blyrics--wave-path";
  var INSTANT_MS = 1;
  var INSTRUMENTAL_WAVE_PATH_HIGH_FALLBACK = `path("${INSTRUMENTAL_WAVE_PATH_HIGH}")`;
  var INSTRUMENTAL_WAVE_PATH_LOW_FALLBACK = `path("${INSTRUMENTAL_WAVE_PATH_LOW}")`;
  function startInstrumentalAnimations(engine, line, config2, lyricTimeS, appliedTimingOffsetMs) {
    const elapsedMs = (lyricTimeS - line.time) * 1e3;
    const lineDurationMs = Math.max(line.duration * 1e3, 1);
    const enabled = config2.enabled.instrumental;
    const { instrumental } = config2;
    const followSong2 = (animation, currentTimeMs, wrapDurationMs) => {
      if (!animation)
        return;
      followSongClock(engine, animation, { appliedTimingOffsetMs, offsetMs: 0, wrapDurationMs });
      animation.currentTime = currentTimeMs;
    };
    const scheduled = (durationMs) => correctedAnimationTimeMs(elapsedMs, appliedTimingOffsetMs, durationMs);
    const fillFadeMs = enabled ? instrumental.fillFadeDurationMs : INSTANT_MS;
    const fillFade = animateChild(line, FILL_SELECTOR, [{ opacity: 0 }, { opacity: 1 }], {
      duration: fillFadeMs,
      easing: enabled ? instrumental.fillFadeEasing : "linear",
      fill: "forwards"
    });
    followSong2(fillFade, scheduled(fillFadeMs));
    if (!enabled)
      return;
    const travel = (selector, from, to, easing) => animateChild(line, selector, [{ transform: from }, { transform: to }], {
      duration: lineDurationMs,
      easing,
      fill: "both"
    });
    followSong2(travel(WAVE_CLIP_SELECTOR, instrumental.fillFrom, instrumental.fillTo, instrumental.fillEasing), scheduled(lineDurationMs));
    followSong2(travel(WAVE_PATH_SELECTOR, instrumental.waveFrom, instrumental.waveTo, instrumental.waveEasing), scheduled(lineDurationMs));
    const oscillationMs = instrumental.waveOscillationDurationMs;
    const oscillation = animateChild(line, WAVE_PATH_SELECTOR, [{ d: instrumental.wavePathHigh }, { d: instrumental.wavePathLow, offset: 0.5 }, { d: instrumental.wavePathHigh }], { duration: oscillationMs, easing: instrumental.waveOscillationEasing, iterations: Infinity });
    const wrapMs = Math.max(oscillationMs, 1);
    followSong2(oscillation, correctedWrappedAnimationTimeMs(elapsedMs, appliedTimingOffsetMs, wrapMs), oscillationMs);
  }
  function startInstrumentalExitAnimations(line, config2, lyricTimeS) {
    if (lyricTimeS < line.time)
      return;
    const fades = config2.enabled.instrumental && config2.enabled.highlightFade;
    animateChild(line, FILL_SELECTOR, [{ opacity: 1 }, { opacity: 0 }], {
      duration: fades ? config2.highlight.fadeOutDurationMs : INSTANT_MS,
      easing: config2.enabled.instrumental ? config2.highlight.fadeOutEasing : "linear",
      fill: "none"
    });
  }
  function animateChild(line, selector, keyframes, options) {
    const element = line.lyricElement.querySelector(selector);
    if (!element)
      return null;
    const animation = element.animate(keyframes, options);
    line.animations.push(animation);
    return animation;
  }

  // web/node_modules/@braccato/core/dist/engine/animationConfig.js
  var EARLY_SCROLL_CONSIDER = registerThemeSetting("blyrics-early-scroll-consider-s", 0.54);
  var DEFAULT_SCROLL_EASING = "cubic-bezier(0.86, 0, 0.2, 1)";
  function getAnimationSettings(engine, lyricsElement) {
    engine.cachedAnimationSettings ??= {
      config: readAnimationConfig(engine, lyricsElement),
      scrollTiming: { earlyScrollConsiderS: Math.max(0, EARLY_SCROLL_CONSIDER.getNumberValue()) }
    };
    return engine.cachedAnimationSettings;
  }
  function readAnimationConfig(engine, lyricsElement) {
    const css = createThemeReader(engine, lyricsElement);
    const glowTo = resolveGlowFilter(engine, lyricsElement, "to", "0");
    return {
      enabled: {
        lineScale: css.flag("--blyrics-animate-line-scale", true),
        wordWobble: css.flag("--blyrics-animate-word-wobble", true),
        highlightSwipe: css.flag("--blyrics-animate-highlight-swipe", true),
        highlightGlow: css.flag("--blyrics-animate-highlight-glow", true),
        highlightFade: css.flag("--blyrics-animate-highlight-fade", true),
        scroll: css.flag("--blyrics-animate-scroll", true),
        instrumental: css.flag("--blyrics-animate-instrumental", true)
      },
      line: {
        durationMs: css.durationMs("--blyrics-scale-transition-duration", "0.166s"),
        enterEasing: css.string("--blyrics-line-enter-easing", "ease"),
        exitEasing: css.string("--blyrics-line-exit-easing", "ease"),
        enterFrom: css.string("--blyrics-line-enter-transform-from", "scale(var(--blyrics-scale))"),
        enterTo: css.string("--blyrics-line-enter-transform-to", "scale(var(--blyrics-active-scale))"),
        exitFrom: css.string("--blyrics-line-exit-transform-from", "scale(var(--blyrics-active-scale))"),
        exitTo: css.string("--blyrics-line-exit-transform-to", "scale(var(--blyrics-scale))")
      },
      highlight: {
        fadeInDurationMs: css.durationMs("--blyrics-lyric-highlight-fade-in-duration", "0.33s"),
        fadeOutDurationMs: css.durationMs("--blyrics-lyric-highlight-fade-out-duration", "0.5s"),
        fadeInEasing: css.string("--blyrics-lyric-highlight-fade-in-easing", "ease"),
        fadeOutEasing: css.string("--blyrics-lyric-highlight-fade-out-easing", "ease"),
        swipeEasing: css.string("--blyrics-highlight-swipe-easing", "linear"),
        swipeStartFrom: css.string("--blyrics-highlight-swipe-start-from", "-0.2"),
        swipeEndFrom: css.string("--blyrics-highlight-swipe-end-from", "-0.1"),
        swipeStartTo: css.string("--blyrics-highlight-swipe-start-to", "1.4"),
        swipeEndTo: css.string("--blyrics-highlight-swipe-end-to", "1.5"),
        glowTo,
        glowDurationRatio: css.number("--blyrics-highlight-glow-duration-ratio", 1.2),
        glowMinDurationMs: css.durationMs("--blyrics-highlight-glow-min-duration", "1.2s"),
        glowEasing: css.string("--blyrics-highlight-glow-easing", "ease"),
        glowContainerAlpha: parseColorAlpha(css.string("--blyrics-glow-color", "")) ?? 1,
        glowRestingInvisible: isGlowRestingInvisible(glowTo)
      },
      word: {
        wobbleDurationMs: css.durationMs("--blyrics-wobble-duration", "1s"),
        wobbleEasing: css.string("--blyrics-word-wobble-easing", "ease"),
        wobblePeakEasing: css.string("--blyrics-word-wobble-peak-easing", "ease-in-out"),
        wobbleEndEasing: css.string("--blyrics-word-wobble-end-easing", "ease-out"),
        wobbleFrom: css.string("--blyrics-word-wobble-transform-from", "scaleX(1)"),
        wobblePeak: css.string("--blyrics-word-wobble-transform-peak", "translateX(0.05em) scaleX(1.025)"),
        wobbleSettle: css.string("--blyrics-word-wobble-transform-settle", "translateX(0) scaleX(1)"),
        wobbleTo: css.string("--blyrics-word-wobble-transform-to", "scaleX(1)"),
        wobblePeakOffset: css.fraction("--blyrics-word-wobble-peak-offset", 0.125),
        wobbleSettleOffset: css.fraction("--blyrics-word-wobble-settle-offset", 0.75)
      },
      letterWave: {
        transform: css.string("--blyrics-letter-wave-transform", "translateY(-0.06em)"),
        settle: css.string("--blyrics-letter-wave-settle", "translateY(-0.05em)"),
        emphasisScale: css.string("--blyrics-letter-wave-emphasis-scale", "1.08"),
        durationMs: css.durationMs("--blyrics-letter-wave-duration", "0.9s"),
        riseEasing: css.string("--blyrics-letter-wave-rise-easing", "ease-in-out"),
        fallEasing: css.string("--blyrics-letter-wave-fall-easing", "ease-in-out")
      },
      instrumental: {
        fillFadeDurationMs: css.durationMs("--blyrics-instrumental-fill-fade-duration", "150ms"),
        fillFadeEasing: css.string("--blyrics-instrumental-fill-fade-easing", "ease"),
        fillFrom: css.string("--blyrics-instrumental-fill-transform-from", "translateY(78%)"),
        fillTo: css.string("--blyrics-instrumental-fill-transform-to", "translateY(-4%)"),
        fillEasing: css.string("--blyrics-instrumental-fill-easing", "linear"),
        waveFrom: css.string("--blyrics-instrumental-wave-transform-from", "scaleY(1.2)"),
        waveTo: css.string("--blyrics-instrumental-wave-transform-to", "scaleY(0.0001)"),
        waveEasing: css.string("--blyrics-instrumental-wave-easing", "ease-in"),
        wavePathHigh: css.string("--blyrics-instrumental-wave-path-high", INSTRUMENTAL_WAVE_PATH_HIGH_FALLBACK),
        wavePathLow: css.string("--blyrics-instrumental-wave-path-low", INSTRUMENTAL_WAVE_PATH_LOW_FALLBACK),
        waveOscillationDurationMs: css.durationMs("--blyrics-instrumental-wave-oscillation-duration", "1.25s"),
        waveOscillationEasing: css.string("--blyrics-instrumental-wave-oscillation-easing", "ease-in-out")
      },
      lineScroll: {
        easing: css.string("--blyrics-lyric-scroll-timing-function", DEFAULT_SCROLL_EASING),
        differentialEffects: !engine.window.matchMedia(REDUCED_MOTION_QUERY).matches
      }
    };
  }

  // web/node_modules/@braccato/core/dist/engine/debugOverlay.js
  var DEBUG_OVERLAY_ENABLED = registerThemeSetting("blyrics-debug-renderer", false);
  var GUIDE_START_X = 40;
  var GUIDE_END_X = 1e3;
  var LAST_SCROLL_COLUMN_X = 160;
  function isDebugOverlayEnabled() {
    return DEBUG_OVERLAY_ENABLED.getBooleanValue();
  }
  function drawScrollDebugOverlay(engine, frame) {
    const transform = engine.window.getComputedStyle(frame.lyricsElement).transform;
    const viewTop = frame.scrollTop - new engine.window.DOMMatrix(transform).f;
    const ctx = engine.host.debug?.beginFrame(viewTop);
    if (!ctx)
      return;
    const guide = (color, label, y) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.fillText(label, 0, y);
      ctx.beginPath();
      ctx.moveTo(GUIDE_START_X, y);
      ctx.lineTo(GUIDE_END_X, y);
      ctx.stroke();
    };
    guide("green", "visible top", frame.scrollTop);
    guide("blue", "visible bottom", frame.scrollTop + frame.viewportHeight);
    guide("yellow", "target", frame.scrollTop + frame.targetOffset);
    const last = engine.lastScrollDebugContext;
    drawLineColumn(ctx, viewTop, 0, "realtime", frame.followedLines, frame.lineCenters, frame.scrollTimeS, frame);
    drawLineColumn(ctx, viewTop, LAST_SCROLL_COLUMN_X, "last scroll", last.activeElms, last.centers, last.lyricScrollTime, frame);
  }
  function drawLineColumn(ctx, viewTop, x, title, lines, centers, scrollTimeS, { endingThresholdS }) {
    ctx.strokeStyle = "red";
    ctx.fillStyle = "red";
    ctx.fillText(title, x + 2, viewTop + 45);
    ctx.fillText(`scroll time: ${scrollTimeS.toFixed(3)}`, x + 2, viewTop + 60);
    for (const line of lines) {
      const untilStartS = line.time - scrollTimeS;
      const endS = line.time + line.duration;
      const untilEndS = endS - scrollTimeS;
      const color = untilEndS < endingThresholdS ? "gray" : untilStartS > 0 ? "magenta" : "orange";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + 5, line.position);
      ctx.lineTo(x + 5, line.position + line.height);
      ctx.stroke();
      ctx.fillText(`time: start=${line.time.toFixed(2)} end=${endS.toFixed(2)}`, x + 15, line.position);
      ctx.fillText(`till active: ${untilStartS.toFixed(2)}`, x + 15, line.position + 15);
      ctx.fillText(`till end: ${untilEndS.toFixed(2)}`, x + 15, line.position + 30);
    }
    ctx.strokeStyle = "pink";
    ctx.fillStyle = "pink";
    for (const center of centers) {
      ctx.beginPath();
      ctx.arc(x + 5, center, 5, 0, 2 * Math.PI, false);
      ctx.fill();
    }
  }

  // web/node_modules/@braccato/core/dist/engine/autoScroll.js
  var LYRIC_ENDING_THRESHOLD_S = registerThemeSetting("blyrics-lyric-ending-threshold-s", 0.5);
  var SCROLL_DEADBAND_PX = 2;
  function followFocusedLines(tick) {
    const { engine, lyricsElement, now } = tick;
    if (isAutoScrolling(engine, now))
      scrollToFocusedLines(tick);
    if (engine.wasUserScrolling && engine.scrollResumeTime < now) {
      engine.host.setResumeAffordanceVisible(false);
      lyricsElement.classList.remove(USER_SCROLLING_CLASS);
      engine.wasUserScrolling = false;
    }
    decaySkipScrolls(engine, now, !tick.countEveryUserScroll);
  }
  function isAutoScrolling(engine, now) {
    return engine.scrollResumeTime < now || engine.scrollPos === -1;
  }
  function lastSungLine(engine) {
    return engine.lines.findLast((line) => line.lyricElement.dataset.instrumental !== "true");
  }
  function scrollToFocusedLines(tick) {
    const { engine, lyricsElement, scroller, scrollTimeS, config: config2, smoothScroll, jumped } = tick;
    const followedLines = tick.focusedLines.length > 0 ? tick.focusedLines : engine.lines.slice(0, 1);
    const leadLine = followedLines.at(-1);
    if (!leadLine)
      return;
    const targetOffset = scroller.height * getTargetScrollRatio(engine, lyricsElement);
    const endingThresholdS = LYRIC_ENDING_THRESHOLD_S.getNumberValue();
    const sungLines = followedLines.filter((line) => line === leadLine || scrollTimeS < line.time + line.duration - endingThresholdS);
    const lineCenters = sungLines.map((line) => line.position + line.height / 2);
    const anchor = findScrollAnchor(sungLines, scrollTimeS);
    const target = computeActiveLinesScrollTop(sungLines, anchor, scroller.height, engine.cachedScrollInsets, targetOffset);
    const toScrollTop = clamp(creditsAwareScrollTop(engine, target.scrollTop, targetOffset), 0, scroller.maxScrollTop);
    if (isDebugOverlayEnabled()) {
      drawScrollDebugOverlay(engine, {
        lyricsElement,
        scrollTop: scroller.scrollTop,
        viewportHeight: scroller.height,
        targetOffset,
        followedLines,
        lineCenters,
        scrollTimeS,
        endingThresholdS
      });
    }
    const pinned2 = engine.pinnedScrollLine;
    const pinnedLineFinished = pinned2 !== null && pinned2 !== anchor && (!sungLines.includes(pinned2) || scrollTimeS >= pinned2.time + pinned2.duration);
    const mustCommit = tick.focusChanged || pinnedLineFinished || engine.wasUserScrolling;
    const fromScrollTop = scroller.scrollTop;
    const moves = Math.abs(toScrollTop - fromScrollTop) > SCROLL_DEADBAND_PX;
    const animatesScroll = smoothScroll && config2.enabled.scroll;
    const request = () => ({
      lines: getLineScrollItems(engine, engine.lines),
      activeLine: leadLine,
      fromScrollTop,
      toScrollTop,
      viewportHeight: scroller.height,
      config: config2,
      continuesEngineScroll: !jumped && !engine.wasUserScrolling && engine.scrollPos >= 0 && Math.abs(fromScrollTop - engine.scrollPos) <= SCROLL_DEADBAND_PX
    });
    const msUntilLeadLine = (leadLine.time - scrollTimeS) * 1e3;
    const leadLineIsNext = msUntilLeadLine > 0 && msUntilLeadLine <= SCROLL_PREPARE_LEAD_MS;
    if (animatesScroll && moves && !mustCommit && leadLineIsNext && !engine.lastScrollElements.includes(leadLine)) {
      updateVisibleLyricWillChange(engine, engine.lines, fromScrollTop, toScrollTop, scroller.height);
      prepareUpcomingLineScroll(engine, request());
    }
    if (!mustCommit)
      return;
    engine.lastScrollElements = followedLines;
    engine.pinnedScrollLine = target.overflowsBand ? anchor : null;
    engine.lastScrollDebugContext = { lyricScrollTime: scrollTimeS, centers: lineCenters, activeElms: followedLines };
    if (smoothScroll && moves) {
      if (config2.enabled.scroll) {
        updateVisibleLyricWillChange(engine, engine.lines, fromScrollTop, toScrollTop, scroller.height);
        commitOrPrepareLineScroll(engine, request());
      }
    } else {
      dropPendingLineScroll(engine);
    }
    writeEngineScrollTop(engine, scroller.element, toScrollTop, tick.now);
  }
  function creditsAwareScrollTop(engine, scrollTop, targetOffset) {
    const credits = engine.cachedCreditsItem;
    const lastLine = lastSungLine(engine);
    if (!engine.creditsFocused || !credits || !lastLine)
      return scrollTop;
    const creditsCentered = credits.position + credits.height / 2 - targetOffset;
    const lastLineAtTop = lastLine.position - engine.cachedScrollInsets.top;
    return Math.min(creditsCentered, lastLineAtTop);
  }

  // web/node_modules/@braccato/core/dist/engine/timingLogs.js
  var TIMING_LOGS_ENABLED = registerThemeSetting("blyrics-debug-animation-timing", false);
  var VISIBILITY_LOG_WINDOW_MS = 3e3;
  var PER_LINE_LOG_INTERVAL_MS = 750;
  var LOGGED_OFFSET_THRESHOLD_MS = 30;
  var lastLogTimes = /* @__PURE__ */ new WeakMap();
  function shouldLogAnimationTiming(engine, line, sample, now) {
    if (!TIMING_LOGS_ENABLED.getBooleanValue())
      return false;
    const inVisibilityWindow = now < engine.animationTimingVisibilityLogUntil;
    if (!inVisibilityWindow && Math.abs(sample.offsetMs) < LOGGED_OFFSET_THRESHOLD_MS)
      return false;
    if (now - (lastLogTimes.get(line) ?? 0) < PER_LINE_LOG_INTERVAL_MS)
      return false;
    lastLogTimes.set(line, now);
    return true;
  }
  function logAnimationTiming(engine, reason, line, lineIndex, sample, lyricTimeS, accumulatedOffsetMs, learnedOffsetMs = engine.learnedAnimationTimingOffsetMs) {
    if (!TIMING_LOGS_ENABLED.getBooleanValue())
      return;
    engine.host.log("WAAPI timing", {
      reason,
      lineIndex,
      lineTimeS: roundedSeconds(line.time),
      mediaTimeS: roundedSeconds(lyricTimeS),
      actualTimeMs: roundedMs(sample.actualTimeMs),
      expectedTimeMs: roundedMs(sample.expectedTimeMs),
      offsetMs: roundedMs(sample.offsetMs),
      learnedOffsetMs: roundedMs(learnedOffsetMs),
      appliedTimingOffsetMs: roundedMs(sample.appliedTimingOffsetMs),
      biasOffsetMs: roundedMs(sample.biasOffsetMs),
      residualOffsetMs: roundedMs(sample.offsetMs),
      accumulatedOffsetMs: roundedMs(accumulatedOffsetMs),
      playState: sample.playState,
      text: linePreview(line)
    });
  }
  function logAnimationCleanup(engine, reason, line, lineIndex, lyricTimeS, staleAfterS) {
    if (!TIMING_LOGS_ENABLED.getBooleanValue())
      return;
    engine.host.log("Animation cleanup", {
      reason,
      lineIndex,
      lineTimeS: roundedSeconds(line.time),
      mediaTimeS: roundedSeconds(lyricTimeS),
      staleAnimationEndTimeS: roundedSeconds(staleAfterS),
      runningAnimationCount: countAnimations(line),
      text: linePreview(line)
    });
  }
  function noteVisibilityChange(engine) {
    if (!TIMING_LOGS_ENABLED.getBooleanValue() || !engine.lyricsContainer)
      return;
    const visibilityState = engine.document.visibilityState;
    const runningAnimationCount = engine.lines.reduce((count, line) => count + countAnimations(line), 0);
    if (visibilityState !== "visible") {
      engine.host.log("Visibility changed; WAAPI animations left intact", {
        visibilityState,
        runningAnimationCount,
        resetSkipped: true
      });
      return;
    }
    engine.animationTimingVisibilityLogUntil = Date.now() + VISIBILITY_LOG_WINDOW_MS;
    engine.host.log("Visibility changed; keeping WAAPI animations for timing verification", {
      visibilityState,
      runningAnimationCount,
      resetSkipped: true,
      timingLogWindowMs: VISIBILITY_LOG_WINDOW_MS
    });
  }
  function countAnimations(line) {
    return line.parts.reduce((count, part) => count + part.animations.length, line.animations.length);
  }
  function roundedSeconds(timeS) {
    return roundedMs(timeS * 1e3) / 1e3;
  }
  function linePreview(line) {
    return line.lyricElement.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
  }

  // web/node_modules/@braccato/core/dist/engine/animationDrift.js
  var LEARN_RATE = 0.08;
  var LEARN_SAMPLE_LIMIT_MS = 80;
  var MAX_LEARNED_OFFSET_MS = 80;
  var ACCUMULATION_DECAY = 1.08;
  var ACCUMULATION_WEIGHT = 0.4;
  var RESET_THRESHOLD_MS = 100;
  function correctLineDrift({ engine, line, lineIndex, lyricTimeS, isPlaying, now }) {
    const sample = largestDriftSample(line, lyricTimeS);
    line.accumulatedOffsetMs /= ACCUMULATION_DECAY;
    if (sample === null)
      return;
    if (!isUsableForDrift(sample, isPlaying)) {
      if (shouldLogAnimationTiming(engine, line, sample, now)) {
        logAnimationTiming(engine, "ignored-sample", line, lineIndex, sample, lyricTimeS, line.accumulatedOffsetMs);
      }
      return;
    }
    const learnedOffsetMs = learnTimingOffset(engine, sample);
    line.accumulatedOffsetMs += sample.offsetMs * ACCUMULATION_WEIGHT;
    if (shouldLogAnimationTiming(engine, line, sample, now)) {
      const accumulatedMs = line.accumulatedOffsetMs;
      logAnimationTiming(engine, "sample", line, lineIndex, sample, lyricTimeS, accumulatedMs, learnedOffsetMs);
    }
    const drifted = Math.abs(line.accumulatedOffsetMs) > RESET_THRESHOLD_MS;
    if (line.isAnimating && isPlaying && drifted) {
      logAnimationTiming(engine, "drift-reset", line, lineIndex, sample, lyricTimeS, line.accumulatedOffsetMs);
      resetLineAnimationState(line);
    }
  }
  function isUsableForDrift(sample, isPlaying) {
    return isPlaying && (sample.playState === "running" || sample.playState === "finished");
  }
  function learnTimingOffset(engine, sample) {
    if (Math.abs(sample.biasOffsetMs) > LEARN_SAMPLE_LIMIT_MS)
      return engine.learnedAnimationTimingOffsetMs;
    const learned = engine.learnedAnimationTimingOffsetMs;
    engine.learnedAnimationTimingOffsetMs = clamp(learned + (sample.biasOffsetMs - learned) * LEARN_RATE, -MAX_LEARNED_OFFSET_MS, MAX_LEARNED_OFFSET_MS);
    return engine.learnedAnimationTimingOffsetMs;
  }

  // web/node_modules/@braccato/core/dist/engine/wordAnimations.js
  var SWIPE_LEAD_RATIO = registerThemeSetting("blyrics-swipe-lead-ratio", 0.1);
  var SWIPE_DURATION_RATIO = registerThemeSetting("blyrics-swipe-duration-ratio", 1.6);
  var LINE_SYNCED_WORD_CLASS2 = "blyrics-line-synced-word";
  var INSTANT_MS2 = 1;
  var SHOWN = [{ opacity: 1 }, { opacity: 1 }];
  var FADE_IN = [{ opacity: 0 }, { opacity: 1 }];
  var FADE_OUT = [{ opacity: 1 }, { opacity: 0 }];
  var glowDelaysMs = /* @__PURE__ */ new WeakMap();
  function startWordAnimations(engine, part, config2, lyricTimeS, appliedTimingOffsetMs) {
    resetPartAnimations(part);
    const word = wordTimeline(engine, part, config2, lyricTimeS, appliedTimingOffsetMs);
    const highlight = part.lyricElement.classList.contains(LINE_SYNCED_WORD_CLASS2) ? lineSyncedHighlight(word) : richSyncedHighlight(word);
    const motion = config2.enabled.wordWobble ? [...wobble(word), ...letterWave2(word)] : [];
    part.animations = [...highlight, ...mirrorHighlightAnimations(part, highlight), ...motion];
  }
  function startWordExitAnimation(part, config2) {
    const glows = part.animations.filter((animation) => glowStarted(animation));
    part.animations = part.animations.filter((animation) => !glows.includes(animation));
    resetPartAnimations(part);
    const fades = config2.enabled.highlightFade;
    const durationMs = fades ? config2.highlight.fadeOutDurationMs : INSTANT_MS2;
    const fadeOut = part.highlightElement.animate(FADE_OUT, {
      duration: durationMs,
      easing: fades ? config2.highlight.fadeOutEasing : "linear",
      fill: "none"
    });
    part.animations = [fadeOut, ...mirrorHighlightAnimations(part, [fadeOut]), ...glows];
    fadeOut.addEventListener("finish", () => resetPartAnimations(part), { once: true });
  }
  function glowStarted(animation) {
    const delayMs = glowDelaysMs.get(animation);
    return delayMs !== void 0 && Number(animation.currentTime) >= delayMs;
  }
  function wordTimeline(engine, part, config2, lyricTimeS, appliedTimingOffsetMs) {
    const durationMs = Math.max(0, part.duration * 1e3);
    return {
      engine,
      part,
      config: config2,
      appliedTimingOffsetMs,
      elapsedMs: (lyricTimeS - part.time) * 1e3,
      durationMs,
      swipeLeadMs: durationMs * SWIPE_LEAD_RATIO.getNumberValue(),
      swipeDurationMs: durationMs * SWIPE_DURATION_RATIO.getNumberValue(),
      glowDurationMs: Math.max(durationMs * config2.highlight.glowDurationRatio, config2.highlight.glowMinDurationMs)
    };
  }
  function scheduledTimeMs(word, elapsedMs, durationMs) {
    return correctedAnimationTimeMs(elapsedMs, word.appliedTimingOffsetMs, durationMs);
  }
  function followSong(word, animation, currentTimeMs, { offsetMs = 0, skipDriftSample = false } = {}) {
    const { appliedTimingOffsetMs } = word;
    followSongClock(word.engine, animation, { appliedTimingOffsetMs, offsetMs, skipDriftSample });
    animation.currentTime = currentTimeMs;
    return animation;
  }
  function glowShows(part, config2) {
    return config2.enabled.highlightGlow && !part.glowSuppressed;
  }
  function richSyncedHighlight(word) {
    const { part, config: config2 } = word;
    const swipes = config2.enabled.highlightSwipe;
    const animations = swipes ? swipe(word) : [];
    const show = part.highlightElement.animate(SHOWN, { duration: INSTANT_MS2, easing: "linear", fill: "forwards" });
    animations.push(followSong(word, show, scheduledTimeMs(word, word.elapsedMs, INSTANT_MS2)));
    if (glowShows(part, config2))
      animations.push(...glow(word, word.glowDurationMs, swipes));
    return animations;
  }
  function lineSyncedHighlight(word) {
    const { part, config: config2 } = word;
    const fades = config2.enabled.highlightFade;
    const durationMs = fades ? config2.highlight.fadeInDurationMs : INSTANT_MS2;
    const fadeIn = part.highlightElement.animate(FADE_IN, {
      duration: durationMs,
      easing: fades ? config2.highlight.fadeInEasing : "linear",
      fill: "forwards"
    });
    const animations = [followSong(word, fadeIn, scheduledTimeMs(word, word.elapsedMs, durationMs))];
    if (glowShows(part, config2))
      animations.push(...glow(word, config2.highlight.glowMinDurationMs, false));
    return animations;
  }
  function swipe(word) {
    const { part, swipeLeadMs, swipeDurationMs } = word;
    const currentTimeMs = scheduledTimeMs(word, word.elapsedMs + swipeLeadMs, swipeDurationMs);
    return part.sweep ? compositedSwipe(word, part.sweep, currentTimeMs) : [];
  }
  function compositedSwipe(word, cells, currentTimeMs) {
    const { part, config: config2, swipeLeadMs, swipeDurationMs } = word;
    const rtl = part.highlightElement.classList.contains(RTL_CLASS);
    const timing = {
      duration: swipeDurationMs,
      easing: config2.highlight.swipeEasing,
      fill: "both"
    };
    const animations = [];
    cells.forEach((cell, index) => {
      const span = cell.span ?? { start: index / cells.length, width: 1 / cells.length };
      const plan = planCellSweep(swipeRamp(config2), span, rtl);
      if (!plan)
        return;
      for (const [element, keyframes] of [
        [cell.mask, plan.mask],
        [cell.text, plan.text]
      ]) {
        const slide = element.animate(keyframes, timing);
        animations.push(followSong(word, slide, currentTimeMs, { offsetMs: swipeLeadMs, skipDriftSample: animations.length > 0 }));
      }
    });
    return animations;
  }
  function glow(word, durationMs, followsSwipe) {
    return word.part.sweep ? sweepGlow(word, word.part.sweep, durationMs, followsSwipe) : [];
  }
  var TIGHT_GLOW_AT = 0.6;
  var LATEST_GLOW_PEAK = TIGHT_GLOW_AT / 2;
  function sweepGlow(word, cells, durationMs, followsSwipe) {
    const { engine, config: config2, swipeLeadMs, swipeDurationMs } = word;
    const fades = config2.highlight.glowRestingInvisible;
    const easeGlow = easingLookup(engine)(config2.highlight.glowEasing);
    const ramp = swipeRamp(config2);
    return cells.flatMap((cell, cellIndex) => {
      const span = cell.span ?? { start: cellIndex / cells.length, width: 1 / cells.length };
      const delayMs = followsSwipe ? Math.max(0, cellReachedAt(ramp, span) * swipeDurationMs - swipeLeadMs) : 0;
      const litMs = followsSwipe ? cellLitAt(ramp, span) * swipeDurationMs - swipeLeadMs : delayMs;
      const riseMs = Math.max(0, litMs - delayMs);
      const peak = durationMs > 0 ? Math.min(easeGlow(riseMs / durationMs), LATEST_GLOW_PEAK) : 0;
      const timing = {
        delay: delayMs,
        duration: durationMs,
        easing: config2.highlight.glowEasing,
        fill: fades ? "none" : "forwards"
      };
      const currentTimeMs = scheduledTimeMs(word, word.elapsedMs, delayMs + durationMs);
      const halos = haloKeyframes(fades, peak);
      return cell.glows.map((halo, index) => {
        const fade = halo.glow.animate(index === 0 ? halos.wide : halos.tight, timing);
        glowDelaysMs.set(fade, delayMs);
        return followSong(word, fade, currentTimeMs, { skipDriftSample: true });
      });
    });
  }
  function haloKeyframes(fades, peak) {
    const rises = peak > 0;
    const wideRise = rises ? [{ opacity: 0 }, { opacity: 1, offset: peak }] : [{ opacity: 1 }];
    const tightWait = rises ? [{ opacity: 0 }, { opacity: 0, offset: peak }] : [{ opacity: 0 }];
    if (!fades)
      return { wide: [...wideRise, { opacity: 1 }], tight: [{ opacity: 0 }, { opacity: 0 }] };
    return {
      wide: [...wideRise, { opacity: 0, offset: TIGHT_GLOW_AT }, { opacity: 0 }],
      tight: [...tightWait, { opacity: 1, offset: TIGHT_GLOW_AT }, { opacity: 0 }]
    };
  }
  function wobble(word) {
    const { wobbleFrom, wobblePeak, wobblePeakOffset, wobblePeakEasing, wobbleSettle, wobbleSettleOffset } = word.config.word;
    const { wobbleTo, wobbleEndEasing, wobbleDurationMs, wobbleEasing } = word.config.word;
    const keyframes = [
      { transform: wobbleFrom },
      { transform: wobblePeak, offset: wobblePeakOffset, easing: wobblePeakEasing },
      { transform: wobbleSettle, offset: Math.max(wobblePeakOffset, wobbleSettleOffset) },
      { transform: wobbleTo, easing: wobbleEndEasing }
    ];
    const timing = { duration: wobbleDurationMs, easing: wobbleEasing, fill: "forwards" };
    const currentTimeMs = scheduledTimeMs(word, word.elapsedMs, wobbleDurationMs);
    return word.part.wobbleElements.map((element) => followSong(word, element.animate(keyframes, timing), currentTimeMs));
  }
  function letterWave2(word) {
    const { part, config: config2 } = word;
    const letterCount = part.letterElements?.length ?? 0;
    if (letterCount === 0)
      return [];
    const run = planLetterWaveRun(word, letterCount);
    const glowLetterSets = glowShows(part, config2) ? part.sweep?.flatMap((cell) => cell.glows.map((glow2) => glow2.letters)) ?? [] : [];
    const animations = [];
    floatLetters(word, run, part.letterElements, true, animations);
    floatLetters(word, run, part.highlightLetterElements, false, animations);
    for (const glowLetters of glowLetterSets)
      floatLetters(word, run, glowLetters, false, animations);
    return animations;
  }
  function planLetterWaveRun(word, letterCount) {
    const { config: config2 } = word;
    const emphasise = word.part.lyricElement.dataset.longWord === "true";
    const emphasisPeak = emphasise ? ` scale(${config2.letterWave.emphasisScale})` : "";
    const emphasisRest = emphasise ? " scale(1)" : "";
    const keyframes = [
      { transform: `translateY(0)${emphasisRest}`, easing: config2.letterWave.riseEasing },
      {
        transform: `${config2.letterWave.transform}${emphasisPeak}`,
        offset: LETTER_WAVE_CREST_OFFSET,
        easing: config2.letterWave.fallEasing
      },
      { transform: `${config2.letterWave.settle}${emphasisRest}` }
    ];
    const waves = planLetterWave(swipeRamp(config2), letterCount, word.durationMs, word.swipeDurationMs, word.swipeLeadMs, config2.letterWave.durationMs);
    const headStartMs = Math.max(0, -Math.min(...waves.map((wave) => wave.delayMs)));
    const waveEndsMs = waves.map((wave) => wave.delayMs + wave.durationMs);
    const lastWaveEndMs = Math.max(...waveEndsMs);
    return {
      waves,
      keyframes,
      signature: JSON.stringify(keyframes),
      headStartMs,
      lastEndingWaveIndex: waveEndsMs.lastIndexOf(lastWaveEndMs),
      startAtMs: scheduledTimeMs(word, word.elapsedMs + headStartMs, headStartMs + lastWaveEndMs)
    };
  }
  function floatLetters(word, run, letters, isBaseText, animations) {
    letters?.forEach((letterElement, index) => {
      const wave = run.waves[index];
      const delayMs = wave.delayMs + run.headStartMs;
      const float = acquireWaveAnimation(word.engine, letterElement, run.keyframes, run.signature, {
        duration: wave.durationMs,
        delay: delayMs,
        fill: "forwards"
      });
      const skipDriftSample = !isBaseText || index !== run.lastEndingWaveIndex;
      animations.push(followSong(word, float, run.startAtMs, { offsetMs: run.headStartMs, skipDriftSample }));
      if (!GECKO_REDRAW || !isBaseText)
        return;
      const redraw = letterElement.animate(GECKO_REDRAW_KEYFRAMES, {
        duration: GECKO_REDRAW_PERIOD_MS,
        iterations: wave.durationMs / GECKO_REDRAW_PERIOD_MS,
        delay: delayMs,
        composite: "add"
      });
      animations.push(followSong(word, redraw, run.startAtMs, { offsetMs: run.headStartMs, skipDriftSample: true }));
    });
  }

  // web/node_modules/@braccato/core/dist/engine/lineAnimations.js
  function startLineAnimations(engine, line, config2, lyricTimeS) {
    const appliedTimingOffsetMs = engine.learnedAnimationTimingOffsetMs;
    if (!isInstrumental(line))
      placeContextSweeps(line, config2);
    startLineEntrance(engine, line, config2, lyricTimeS, appliedTimingOffsetMs);
    if (isInstrumental(line)) {
      startInstrumentalAnimations(engine, line, config2, lyricTimeS, appliedTimingOffsetMs);
      return;
    }
    suppressInvisibleWordGlows(engine, line, config2);
    for (const part of line.parts)
      startWordAnimations(engine, part, config2, lyricTimeS, appliedTimingOffsetMs);
  }
  function startLineExitAnimations(line, config2, lyricTimeS) {
    startLineExit(line, config2);
    if (isInstrumental(line)) {
      startInstrumentalExitAnimations(line, config2, lyricTimeS);
      return;
    }
    for (const part of line.parts) {
      if (lyricTimeS >= part.time)
        startWordExitAnimation(part, config2);
      else
        resetPartAnimations(part);
    }
  }
  function isInstrumental(line) {
    return line.lyricElement.dataset.instrumental === "true";
  }
  function startLineEntrance(engine, line, config2, lyricTimeS, appliedTimingOffsetMs) {
    resetPartAnimations(line);
    if (!config2.enabled.lineScale)
      return;
    const { enterFrom, enterTo, enterEasing, durationMs } = config2.line;
    const entrance = line.lyricElement.animate([{ transform: enterFrom }, { transform: enterTo }], {
      duration: durationMs,
      easing: enterEasing,
      fill: "forwards"
    });
    followSongClock(engine, entrance, { appliedTimingOffsetMs, offsetMs: 0 });
    const elapsedMs = (lyricTimeS - line.time) * 1e3;
    entrance.currentTime = correctedAnimationTimeMs(elapsedMs, appliedTimingOffsetMs, durationMs);
    line.animations = [entrance];
  }
  function startLineExit(line, config2) {
    resetPartAnimations(line);
    if (!config2.enabled.lineScale)
      return;
    const { exitFrom, exitTo, exitEasing, durationMs } = config2.line;
    const exit = line.lyricElement.animate([{ transform: exitFrom }, { transform: exitTo }], {
      duration: durationMs,
      easing: exitEasing,
      fill: "none"
    });
    line.animations = [exit];
    exit.addEventListener("finish", () => resetPartAnimations(line), { once: true });
  }

  // web/node_modules/@braccato/core/dist/engine/lineLifecycle.js
  var ANIMATION_PREPARE_AHEAD_S = 2;
  var LINE_END_GRACE_S = 0.05;
  var STALE_ANIMATION_GRACE_S = 0.05;
  function driveLineAnimations(tick) {
    const { engine, lyricTimeS, playhead } = tick;
    const lines = engine.lines;
    const prepareAheadS = playhead.isPlaying ? ANIMATION_PREPARE_AHEAD_S : 0;
    const linesToStart = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const nextLineStartS = lines[index + 1]?.time ?? Infinity;
      const animationEndS = Math.max(nextLineStartS, line.time + line.duration + LINE_END_GRACE_S);
      if (lyricTimeS + prepareAheadS >= line.time && lyricTimeS < animationEndS) {
        updateLineAnimationState(tick, line, index);
        if (!line.isAnimating)
          linesToStart.push(line);
      } else {
        retireLine(tick, line, index, animationEndS);
      }
    }
    for (const line of linesToStart)
      startLine(tick, line);
  }
  function updateLineAnimationState(tick, line, index) {
    const { lyricTimeS, playhead } = tick;
    if (!line.isSelected) {
      line.isSelected = true;
      line.lyricElement.classList.add(ANIMATING_CLASS);
    }
    if (line.isAnimationPlayStatePlaying !== playhead.isPlaying) {
      line.isAnimationPlayStatePlaying = playhead.isPlaying;
      setAnimationsPlayState(line, playhead.isPlaying);
      if (playhead.isPlaying)
        line.isAnimating = false;
    }
    const playbackDiscontinuity = playhead.jumped && playhead.isPlaying || playhead.mediaClockRanBackwards || playhead.seekedWhilePaused;
    if (playbackDiscontinuity && line.isAnimating)
      resetLineAnimationState(line);
    updateWordStates(line, lyricTimeS);
    correctLineDrift({
      engine: tick.engine,
      line,
      lineIndex: index,
      lyricTimeS,
      isPlaying: playhead.isPlaying,
      now: tick.now
    });
  }
  function retireLine({ engine, lyricTimeS, playhead, config: config2 }, line, index, animationEndS) {
    const staleAfterS = animationEndS + config2.highlight.fadeOutDurationMs / 1e3 + STALE_ANIMATION_GRACE_S;
    const isStale = lyricTimeS > staleAfterS;
    const wasSelected = line.isSelected;
    if (wasSelected) {
      if (playhead.isPlaying || playhead.jumped || playhead.seekedWhilePaused) {
        if (isStale) {
          logAnimationCleanup(engine, "selected-stale-reset", line, index, lyricTimeS, staleAfterS);
          resetLineAnimationState(line);
        } else {
          startLineExitAnimations(line, config2, lyricTimeS);
          markLineAnimationsStopped(line);
        }
      } else {
        setAnimationsPlayState(line, false);
        line.isAnimationPlayStatePlaying = false;
      }
      line.isSelected = false;
      clearLineStateClasses(line);
    } else if (hasLineAnimations(line) && (playhead.jumped || isStale)) {
      logAnimationCleanup(engine, playhead.jumped ? "time-jump-reset" : "stale-reset", line, index, lyricTimeS, staleAfterS);
      resetLineAnimationState(line);
    }
    if (wasSelected || playhead.jumped)
      updateWordStates(line, lyricTimeS);
  }
  function startLine({ engine, lyricTimeS, playhead, config: config2, now }, line) {
    startLineAnimations(engine, line, config2, lyricTimeS);
    line.isAnimating = true;
    line.lastAnimSetupAt = now;
    line.isAnimationPlayStatePlaying = playhead.isPlaying;
    line.accumulatedOffsetMs = 0;
    if (!playhead.isPlaying)
      setAnimationsPlayState(line, false);
  }

  // web/node_modules/@braccato/core/dist/engine/tick.js
  var NO_LYRICS_ELEMENT_LOG = "No lyrics element found on the page, skipping lyrics injection";
  var TICK_ERROR_LOG = "Error in lyrics tick:";
  function resolveTickOptions(options) {
    return {
      isPlaying: options.isPlaying,
      eventCreationTime: options.eventCreationTime ?? NO_PLAYER_SNAPSHOT,
      smoothScroll: options.smoothScroll ?? true,
      globalLyricOffset: options.globalLyricOffset ?? 0,
      lyricOffset: options.lyricOffset ?? 0,
      richsyncOffsetTrim: options.richsyncOffsetTrim ?? 0,
      lineOffsetTrim: options.lineOffsetTrim ?? 0,
      passiveScrollEnabled: options.passiveScrollEnabled ?? false,
      playbackRate: usablePlaybackRate(options.playbackRate),
      followPausedSeeks: options.followPausedSeeks ?? false,
      countEveryUserScroll: options.countEveryUserScroll ?? false
    };
  }
  function usablePlaybackRate(rate) {
    return rate !== void 0 && Number.isFinite(rate) && rate > 0 ? rate : 1;
  }
  function tickView(engine, reportedTimeS, options) {
    rememberTickOptions(engine, options);
    if (reportedTimeS === 0 && !options.isPlaying)
      return "ok";
    if (hasNoLyricsPlaceholder(engine)) {
      stopPassiveScrollLoop(engine);
      return "ok";
    }
    if (hasUnsyncedLyrics(engine)) {
      followUnsyncedLyrics(engine, options);
      return "ok";
    }
    const now = Date.now();
    const playhead = advancePlaybackClock(reportedTimeS, options, engine.playbackRate, now);
    if (playhead.jumped)
      dropPendingLineScroll(engine);
    if (!engine.host.isViewVisible()) {
      clearVisibleLyricWillChange(engine);
      return "ok";
    }
    if (engine.host.syncAdState())
      return "ok";
    const lyricsElement = engine.lyricsContainer;
    if (!lyricsElement) {
      engine.host.log(NO_LYRICS_ELEMENT_LOG);
      return "lyrics-missing";
    }
    try {
      renderSyncedLyrics(engine, lyricsElement, playhead, options, now);
    } catch (error) {
      if (!isUndefinedAccessError(error))
        engine.host.log(TICK_ERROR_LOG, error);
    }
    return "ok";
  }
  function rememberTickOptions(engine, options) {
    engine.lastTickOptions = options;
    engine.passiveScrollEnabled = options.passiveScrollEnabled;
    if (engine.playbackRate === options.playbackRate)
      return;
    engine.playbackRate = options.playbackRate;
    applyPlaybackRateToRunningAnimations(engine);
  }
  function followUnsyncedLyrics(engine, { isPlaying, passiveScrollEnabled }) {
    if (engine.layout === "stage")
      return;
    if (isPlaying && !playbackClock.lastPlayState)
      engine.scrollResumeTime = 0;
    playbackClock.lastPlayState = isPlaying;
    if (passiveScrollEnabled)
      startPassiveScrollLoop(engine);
  }
  function isUndefinedAccessError(error) {
    return error.message?.includes("undefined") ?? false;
  }
  function renderSyncedLyrics(engine, lyricsElement, playhead, options, now) {
    const lyricTimeS = playhead.timeS + lyricClockShiftS(engine, lyricsElement, options);
    const scrollTimeS = correctedScrollTimeS(engine, lyricTimeS) + getCSSDurationInMs(engine, lyricsElement, "--blyrics-scroll-timing-offset") / 1e3;
    const { config: config2, scrollTiming } = getAnimationSettings(engine, lyricsElement);
    const isStage = engine.layout === "stage";
    const scroller = isStage ? null : readScrollerBeforeWrites(engine);
    if (!isStage && !scroller) {
      clearVisibleLyricWillChange(engine);
      return;
    }
    if (scroller && config2.enabled.scroll) {
      const pendingScrollTop = engine.pendingLineScroll?.toScrollTop ?? scroller.scrollTop;
      updateVisibleLyricWillChange(engine, engine.lines, scroller.scrollTop, pendingScrollTop, scroller.height);
    } else {
      stopLineScrolling(engine);
    }
    const focus = focusLines(engine, scrollTimeS, scrollTiming.earlyScrollConsiderS);
    driveLineAnimations({ engine, lyricTimeS, playhead, config: config2, now });
    const creditsFocusChanged = updateCreditsFocus(engine, lyricsElement, scrollTimeS);
    if (!scroller) {
      applyStage(engine, lyricTimeS, playhead.jumped);
      return;
    }
    followFocusedLines({
      engine,
      lyricsElement,
      scroller,
      focusedLines: focus.lines,
      scrollTimeS,
      config: config2,
      smoothScroll: options.smoothScroll,
      countEveryUserScroll: options.countEveryUserScroll,
      jumped: playhead.jumped,
      focusChanged: playhead.jumped || focus.reachedUncommittedLine || creditsFocusChanged,
      now
    });
  }
  function readScrollerBeforeWrites(engine) {
    const element = engine.host.getScrollElement();
    if (!element)
      return null;
    if (element !== engine.observedTabRenderer)
      setupTabRendererObserver(engine, element);
    return {
      element,
      height: engine.cachedTabRendererHeight ?? element.getBoundingClientRect().height,
      scrollTop: element.scrollTop,
      maxScrollTop: Math.max(0, element.scrollHeight - element.clientHeight)
    };
  }
  function stopLineScrolling(engine) {
    dropPendingLineScroll(engine);
    clearVisibleLyricWillChange(engine);
    clearLineScrolls(engine);
  }
  function focusLines(engine, scrollTimeS, earlyScrollConsiderS) {
    const lines = engine.lines;
    const focused = [];
    let reachedUncommittedLine = false;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const nextLineStartS = lines[index + 1]?.time ?? Infinity;
      const inFocus = scrollTimeS >= line.time - earlyScrollConsiderS && (scrollTimeS < nextLineStartS || scrollTimeS < line.time + line.duration);
      setLineCurrent(line, inFocus);
      if (!inFocus)
        continue;
      focused.push(line);
      engine.selectedElementIndex = index;
      if (scrollTimeS >= line.time && !engine.lastScrollElements.includes(line))
        reachedUncommittedLine = true;
    }
    return { lines: focused, reachedUncommittedLine };
  }
  function setLineCurrent(line, current) {
    if (line.isScrolled === current)
      return;
    line.isScrolled = current;
    line.lyricElement.classList.toggle(CURRENT_LYRICS_CLASS, current);
  }
  function updateCreditsFocus(engine, lyricsElement, scrollTimeS) {
    const lastLine = lastSungLine(engine);
    const focused = lastLine !== void 0 && (engine.cachedCreditsItem?.height ?? 0) > 0 && scrollTimeS >= lastLine.time + lastLine.duration;
    if (focused === engine.creditsFocused)
      return false;
    engine.creditsFocused = focused;
    if (focused)
      lyricsElement.dataset.creditsFocused = "true";
    else
      delete lyricsElement.dataset.creditsFocused;
    return true;
  }
  function relayout(engine, linesAreRendered) {
    if (engine.layout === "stage") {
      if (!linesAreRendered || !engine.lyricsContainer)
        return false;
      engine.cachedCreditsItem = measureTrailingItem(engine.lyricsContainer, CREDITS_CLASS);
      measureStage(engine);
      return restartContextSweeps(engine);
    }
    applyScrollPadding(engine);
    const scrollElement = engine.host.getScrollElement();
    if (scrollElement)
      measureScrollViewport(engine, scrollElement);
    if (!linesAreRendered)
      return false;
    const lyricsElement = engine.lyricsContainer;
    if (!lyricsElement)
      return false;
    engine.lyricWidth = lyricsElement.clientWidth;
    engine.lyricHeight = lyricsElement.clientHeight;
    measureLinePositions(engine, lyricsElement);
    const restarted = restartContextSweeps(engine);
    engine.cachedCreditsItem = measureTrailingItem(lyricsElement, CREDITS_CLASS);
    engine.cachedFooterItem = measureTrailingItem(lyricsElement, FOOTER_CLASS);
    setupLineCullObserver(engine);
    requestRescroll(engine);
    engine.host.debug?.resize();
    return restarted;
  }
  function restartContextSweeps(engine) {
    let restarted = false;
    for (const line of engine.lines) {
      if (line.isAnimating && line.parts.some((part) => part.sweepContext)) {
        resetLineAnimationState(line);
        restarted = true;
      }
    }
    return restarted;
  }
  function measureLinePositions(engine, lyricsElement) {
    clearOffscreenLineCulling(engine);
    for (const line of engine.lines) {
      const bounds = getRelativeLayoutBounds(lyricsElement, line.lyricElement);
      line.position = bounds.y;
      line.height = bounds.height;
      line.decorations = new Map(lineDecorators(line.lyricElement).map((element) => [element, getRelativeLayoutBounds(lyricsElement, element).y]));
    }
  }
  function cancelLyricPositionUpdate(engine) {
    if (engine.pendingLyricsUpdateFrame === null)
      return;
    engine.window.cancelAnimationFrame(engine.pendingLyricsUpdateFrame);
    engine.pendingLyricsUpdateFrame = null;
  }
  function retickFromPlaybackClock(engine, buildTickOptions) {
    const options = buildTickOptions(playbackClock.lastEventCreationTime, playbackClock.lastPlayState);
    return tickView(engine, playbackClock.lastTime, resolveTickOptions(options));
  }
  function retickAtLastTime(engine) {
    if (engine.lastTickOptions)
      tickView(engine, playbackClock.lastTime, engine.lastTickOptions);
  }
  function scheduleLyricPositionUpdate(engine, isViewRendering, retick) {
    if (engine.pendingLyricsUpdateFrame !== null)
      return;
    dropPendingLineScroll(engine);
    engine.pendingLyricsUpdateFrame = engine.window.requestAnimationFrame(() => {
      engine.pendingLyricsUpdateFrame = null;
      const isRendering = isViewRendering();
      const playSlide = isRendering ? captureDecorationSlide(engine) : null;
      relayout(engine, isRendering);
      playSlide?.();
      if (isRendering)
        retick();
    });
  }

  // web/node_modules/@braccato/core/dist/engine/instance.js
  function createAnimationEngineInstance(engineDocument, engineWindow, host, layout = "scroll") {
    const reducedMotionQuery = engineWindow.matchMedia(REDUCED_MOTION_QUERY);
    const handleReducedMotionChange = () => clearStyleCaches(engine);
    const engine = {
      document: engineDocument,
      window: engineWindow,
      host,
      lines: [],
      lyricsContainer: null,
      syncType: "none",
      lyricWidth: 0,
      lyricHeight: 0,
      skipScrolls: 0,
      skipScrollsDecayTimes: [],
      scrollResumeTime: 0,
      scrollPos: -1,
      selectedElementIndex: 0,
      wasUserScrolling: false,
      lastScrollElements: [],
      pinnedScrollLine: null,
      lastScrollDebugContext: {
        activeElms: [],
        centers: [],
        lyricScrollTime: 0
      },
      passiveScrollAccumulatedTime: 0,
      passiveLastWallTime: 0,
      passiveScrollTop: null,
      cachedTabRendererHeight: null,
      cachedScrollInsets: NO_SCROLL_INSETS,
      cachedFooterItem: null,
      cachedCreditsItem: null,
      creditsFocused: false,
      cachedLineScrollTiming: /* @__PURE__ */ new Map(),
      tabRendererResizeObserver: null,
      observedTabRenderer: null,
      runningLineScrolls: [],
      elementMotions: /* @__PURE__ */ new Map(),
      easingTables: /* @__PURE__ */ new Map(),
      lineScrollAnimationToken: 0,
      pendingLineScroll: null,
      lineScrollElementTokens: /* @__PURE__ */ new WeakMap(),
      visibleWillChangeElements: /* @__PURE__ */ new Set(),
      culledLineElements: /* @__PURE__ */ new Set(),
      waveAnimationPool: [],
      lineCullObserver: null,
      cachedDurations: /* @__PURE__ */ new Map(),
      cachedCSSValues: /* @__PURE__ */ new Map(),
      cachedAnimationSettings: null,
      passiveScrollEnabled: false,
      lastTickOptions: null,
      playbackRate: 1,
      passiveRAFId: null,
      pendingLyricsUpdateFrame: null,
      learnedAnimationTimingOffsetMs: 0,
      animationTimingVisibilityLogUntil: 0,
      layout,
      stageKey: "",
      stageRemeasured: false,
      stageHeight: 0,
      stageBox: null,
      stageMetrics: /* @__PURE__ */ new Map(),
      stageY: /* @__PURE__ */ new Map(),
      stageMoves: /* @__PURE__ */ new Map(),
      stageFades: /* @__PURE__ */ new Map(),
      stageBlurs: /* @__PURE__ */ new Map(),
      stageFontSize: 16,
      destroy: () => {
        liveEngines.delete(engine);
        reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
        engine.tabRendererResizeObserver?.disconnect();
        engine.tabRendererResizeObserver = null;
        engine.observedTabRenderer = null;
        engine.lineCullObserver?.disconnect();
        engine.lineCullObserver = null;
        stopPassiveScrollLoop(engine);
        cancelLyricPositionUpdate(engine);
      }
    };
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    liveEngines.add(engine);
    return engine;
  }

  // web/node_modules/@braccato/core/dist/view.js
  var INITIAL_SKIP_SCROLLS = 2;
  var SKIP_SCROLL_DECAY_MS = 2e3;
  function buildInstrumentalLine(doc, lyricElement, lyrics, lineIndex) {
    createInstrumentalElement(doc, lyricElement, lyrics[lineIndex].durationMs);
    lyricElement.dataset.instrumental = "true";
    const agent = findNearestAgent(lyrics, lineIndex);
    if (agent) {
      lyricElement.dataset.agent = agent;
    }
    if (isNearestLyricRtl(lyrics, lineIndex)) {
      lyricElement.classList.add(RTL_CLASS);
      lyricElement.dataset.direction = "rtl";
    }
  }
  function buildSungLine(doc, lyricElement, lyricItem, line) {
    const parts = lyricItem.parts && lyricItem.parts.length > 0 && !disableRichsync.getBooleanValue() ? lyricItem.parts : buildLineSyncedParts(lyricItem);
    applyDirection(lyricElement, lyricItem.words);
    createLyricsLine(doc, parts, line, lyricElement);
    lyricElement.style.setProperty("--blyrics-duration", lyricItem.durationMs + "ms");
    if (lyricItem.agent) {
      lyricElement.dataset.agent = lyricItem.agent;
    }
  }
  function formatSongwriters(names) {
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}` : names[0] ?? "";
  }
  function buildCredits(doc, songwriters) {
    const credits = doc.createElement("p");
    credits.className = CREDITS_CLASS;
    const text = doc.createElement("span");
    text.className = CREDITS_TEXT_CLASS;
    const names = doc.createElement("span");
    names.className = CREDITS_NAMES_CLASS;
    names.dir = "auto";
    names.textContent = formatSongwriters(songwriters);
    text.appendChild(names);
    credits.appendChild(text);
    return credits;
  }
  var lineSignatures = /* @__PURE__ */ new WeakMap();
  var decorationKeys = /* @__PURE__ */ new WeakMap();
  function decorationKey(item) {
    return JSON.stringify([
      item.words,
      item.translation ?? null,
      item.translations ?? null,
      item.romanization ?? null,
      item.timedRomanization ?? null
    ]);
  }
  var builtViews = /* @__PURE__ */ new WeakMap();
  var builtTimings = /* @__PURE__ */ new WeakMap();
  function lineTimings(line, parts = line.parts) {
    return [line.time, line.duration, ...parts.flatMap((part) => [part.time, part.duration])];
  }
  function timingsUnchanged(line) {
    const built = builtTimings.get(line);
    if (built === void 0)
      return false;
    const now = lineTimings(line, line.parts.slice(0, (built.length - 2) / 2));
    return now.length === built.length && now.every((value, index) => value === built[index]);
  }
  function buildContext(engine, lyrics, options) {
    return {
      allZero: lyrics.every((item) => item.startTimeMs === 0),
      languages: resolveLyricLanguages(lyrics, options.language),
      seek: (timeS) => engine.host.seek(playerTimeForLyricTime(engine, timeS))
    };
  }
  function viewKey(context) {
    return `${context.allZero}|${lyricBuildSettingsKey()}`;
  }
  function lineSignature(lyrics, lineIndex) {
    const item = lyrics[lineIndex];
    const parts = item.parts?.map((part) => [
      part.startTimeMs,
      part.durationMs,
      part.words,
      part.isBackground === true,
      part.backgroundGroup ?? null,
      part.explicit === true
    ]);
    const neighbours = item.isInstrumental ? [findNearestAgent(lyrics, lineIndex), isNearestLyricRtl(lyrics, lineIndex)] : null;
    return JSON.stringify([
      item.startTimeMs,
      item.durationMs,
      item.words,
      item.isInstrumental === true,
      item.agent ?? null,
      parts ?? null,
      neighbours,
      decorationKey(item)
    ]);
  }
  function buildLine(doc, lyrics, lineIndex, context) {
    const lyricItem = lyrics[lineIndex];
    const lyricElement = doc.createElement("div");
    const line = newLineData(lyricElement, lyricItem.startTimeMs, lyricItem.durationMs);
    lyricElement.dataset.time = String(line.time);
    lyricElement.dataset.duration = String(line.duration);
    lyricElement.dataset.lineNumber = String(lineIndex);
    lyricElement.classList.add(LINE_CLASS);
    lyricElement.dir = "auto";
    applyLyricLanguage(lyricElement, context.languages[lineIndex]);
    addSeekHandler(context.seek, lyricElement, context.allZero);
    if (lyricItem.isInstrumental) {
      buildInstrumentalLine(doc, lyricElement, lyrics, lineIndex);
    } else {
      buildSungLine(doc, lyricElement, lyricItem, line);
      if (!lyricItem.words?.trim())
        lyricElement.dataset.blank = "true";
    }
    lineSignatures.set(line, lineSignature(lyrics, lineIndex));
    decorationKeys.set(line, decorationKey(lyricItem));
    builtTimings.set(line, lineTimings(line));
    return line;
  }
  function writeContainerState(engine, container, lyrics, options, creditsBefore = null) {
    const doc = engine.document;
    const syncType = deriveSyncType(lyrics);
    container.dataset.sync = syncType;
    if (engine.layout === "stage") {
      container.dataset.layout = "stage";
      const sung = lyrics.filter((item) => !item.isInstrumental && item.words?.trim() && item.agent !== "v1000");
      const onRight = (item) => item.agent === "v2" || item.agent === "v3";
      if (sung.some(onRight) && sung.some((item) => !onRight(item))) {
        container.dataset.stageDuet = "";
      } else {
        delete container.dataset.stageDuet;
      }
    }
    container.dataset.loaderVisible = String(options.loaderVisible);
    if (options.noLyrics) {
      container.dataset.noLyrics = "true";
    } else {
      delete container.dataset.noLyrics;
    }
    container.querySelector(`:scope > .${CREDITS_CLASS}`)?.remove();
    const songwriters = options.songwriters ?? [];
    if (songwriters.length > 0 && !options.noLyrics && !hideCredits.getBooleanValue()) {
      container.insertBefore(buildCredits(doc, songwriters), creditsBefore);
    }
    engine.syncType = syncType;
  }
  function setLyrics(engine, mount, lyrics, options) {
    const doc = engine.document;
    const container = doc.createElement("div");
    container.className = LYRICS_CLASS;
    if (isGecko())
      container.dataset.browserEngine = "gecko";
    mount.replaceChildren(container);
    const context = buildContext(engine, lyrics, options);
    const lines = [];
    for (const lineIndex of lyrics.keys()) {
      const line = buildLine(doc, lyrics, lineIndex, context);
      lines.push(line);
      container.appendChild(line.lyricElement);
    }
    engine.skipScrolls = INITIAL_SKIP_SCROLLS;
    engine.skipScrollsDecayTimes = Array.from({ length: INITIAL_SKIP_SCROLLS }, () => Date.now() + SKIP_SCROLL_DECAY_MS);
    engine.scrollResumeTime = 0;
    writeContainerState(engine, container, lyrics, options);
    engine.lines = lines;
    engine.lyricsContainer = container;
    builtViews.set(engine, { mount, key: viewKey(context), songKey: options.songKey });
    refreshInstrumentalImages(container, engine.window);
    engine.lyricWidth = container.clientWidth;
    engine.lyricHeight = container.clientHeight;
    setupLineCullObserver(engine);
  }
  function matchLines(previous, next) {
    const matches = next.map(() => null);
    let start = 0;
    while (start < previous.length && start < next.length && previous[start] === next[start]) {
      matches[start] = start;
      start++;
    }
    let previousEnd = previous.length;
    let nextEnd = next.length;
    while (previousEnd > start && nextEnd > start && previous[previousEnd - 1] === next[nextEnd - 1]) {
      previousEnd--;
      nextEnd--;
      matches[nextEnd] = previousEnd;
    }
    const rows = previousEnd - start;
    const columns = nextEnd - start;
    if (rows === 0 || columns === 0 || rows * columns > MATCH_SEARCH_LIMIT)
      return matches;
    const lengths = new Uint16Array((rows + 1) * (columns + 1));
    const at2 = (row2, column2) => row2 * (columns + 1) + column2;
    for (let row2 = rows - 1; row2 >= 0; row2--) {
      for (let column2 = columns - 1; column2 >= 0; column2--) {
        lengths[at2(row2, column2)] = previous[start + row2] === next[start + column2] ? lengths[at2(row2 + 1, column2 + 1)] + 1 : Math.max(lengths[at2(row2 + 1, column2)], lengths[at2(row2, column2 + 1)]);
      }
    }
    let row = 0;
    let column = 0;
    while (row < rows && column < columns) {
      if (previous[start + row] === next[start + column]) {
        matches[start + column] = start + row;
        row++;
        column++;
      } else if (lengths[at2(row + 1, column)] >= lengths[at2(row, column + 1)]) {
        row++;
      } else {
        column++;
      }
    }
    return matches;
  }
  var MATCH_SEARCH_LIMIT = 25e4;
  function takeOverlapping(candidates, line) {
    const end = line.time + line.duration;
    const index = candidates.findIndex((old) => {
      const oldEnd = old.time + old.duration;
      return old.time === line.time || old.time < end && line.time < oldEnd;
    });
    return index === -1 ? void 0 : candidates.splice(index, 1)[0];
  }
  function swapLyrics(engine, mount, lyrics, options) {
    const container = engine.lyricsContainer;
    const built = builtViews.get(engine);
    if (container === null || built === void 0 || built.mount !== mount || container.parentElement !== mount) {
      return null;
    }
    if (options.songKey === void 0 || options.songKey !== built.songKey)
      return null;
    const previousLines = engine.lines;
    if (lyrics.length === 0 || previousLines.length === 0)
      return null;
    if (previousLines.some((line) => line.lyricElement.parentNode !== container))
      return null;
    const context = buildContext(engine, lyrics, options);
    if (built.key !== viewKey(context))
      return null;
    const doc = engine.document;
    const previousSignatures = previousLines.map((line) => timingsUnchanged(line) ? lineSignatures.get(line) ?? "" : `\0moved:${lineSignatures.get(line)}`);
    const nextSignatures = lyrics.map((_, lineIndex) => lineSignature(lyrics, lineIndex));
    const children = Array.from(container.childNodes);
    const oldCredits = container.querySelector(`:scope > .${CREDITS_CLASS}`);
    const lastOwned = oldCredits ?? previousLines[previousLines.length - 1].lyricElement;
    const trailing = children[children.indexOf(lastOwned) + 1] ?? null;
    const matches = matchLines(previousSignatures, nextSignatures);
    const kept = /* @__PURE__ */ new Set();
    const lines = [];
    const replaced = /* @__PURE__ */ new Map();
    const positions = /* @__PURE__ */ new Map();
    let previousCursor = 0;
    let unmatchedOld = [];
    const collectUnmatchedUntil = (end) => {
      unmatchedOld = previousLines.slice(previousCursor, end);
      previousCursor = end;
    };
    for (const [lineIndex, match] of matches.entries()) {
      if (match !== null) {
        const line2 = previousLines[match];
        previousCursor = match + 1;
        unmatchedOld = [];
        kept.add(line2);
        line2.lyricElement.dataset.lineNumber = String(lineIndex);
        applyLyricLanguage(line2.lyricElement, context.languages[lineIndex]);
        lines.push(line2);
        positions.set(line2, { position: line2.position, height: line2.height, motionOffset: 0 });
        continue;
      }
      if (unmatchedOld.length === 0) {
        const nextMatch = matches.slice(lineIndex).find((value) => value !== null);
        collectUnmatchedUntil(nextMatch ?? previousLines.length);
      }
      const line = buildLine(doc, lyrics, lineIndex, context);
      const standsFor = takeOverlapping(unmatchedOld, line);
      if (standsFor !== void 0) {
        replaced.set(line, standsFor);
        positions.set(line, {
          position: standsFor.position,
          height: standsFor.height,
          // A kept line finishes its own line scroll; this one starts where the line it replaced was.
          motionOffset: elementMotionOffsetPx(engine, standsFor.lyricElement)
        });
        if (decorationKeys.get(standsFor) === decorationKeys.get(line))
          moveDecorations(standsFor, line);
      }
      lines.push(line);
    }
    const dropped = previousLines.filter((line) => !kept.has(line));
    let following = oldCredits ?? trailing;
    for (let index = lines.length - 1; index >= 0; index--) {
      const element = lines[index].lyricElement;
      if (!kept.has(lines[index]))
        container.insertBefore(element, following);
      following = element;
    }
    replaceRenderedLines(engine, lines, dropped, replaced);
    for (const line of dropped)
      line.lyricElement.remove();
    writeContainerState(engine, container, lyrics, options, trailing);
    refreshInstrumentalImages(container, engine.window);
    return positions;
  }

  // web/node_modules/@braccato/core/dist/renderer.js
  var SEEK_EVENT = "braccato:seek";
  var DESTROYED_SET_LYRICS_LOG = "Lyrics were handed to a renderer that has been destroyed; nothing was built";
  var FONT_MEASURE_LOG = "The lines could not be re-measured after the document's faces loaded";
  var SCROLLABLE_OVERFLOW = /* @__PURE__ */ new Set(["auto", "scroll"]);
  function noop() {
  }
  function areLinesMeasurable(lines) {
    if (lines.length === 0)
      return true;
    return lines.some((line) => line.lyricElement.getClientRects().length > 0);
  }
  function findScrollElement(rendererWindow, mount) {
    for (let element = mount; element !== null; element = element.parentElement) {
      if (SCROLLABLE_OVERFLOW.has(rendererWindow.getComputedStyle(element).overflowY))
        return element;
    }
    if (mount === null)
      return null;
    return mount.ownerDocument.scrollingElement;
  }
  function withHostDefaults(overrides, rendererWindow, currentMount) {
    const given = overrides ?? {};
    let walkedMount;
    let walkedScrollElement = null;
    function scrollElementForCurrentMount() {
      const mount = currentMount();
      if (mount !== walkedMount) {
        walkedMount = mount;
        walkedScrollElement = findScrollElement(rendererWindow, mount);
      }
      return walkedScrollElement;
    }
    return {
      host: {
        isViewVisible: given.isViewVisible ?? (() => true),
        isLoaderActive: given.isLoaderActive ?? (() => false),
        syncAdState: given.syncAdState ?? (() => false),
        getScrollElement: given.getScrollElement ?? scrollElementForCurrentMount,
        setResumeAffordanceVisible: given.setResumeAffordanceVisible ?? noop,
        seek: given.seek ?? ((timeS) => {
          currentMount()?.dispatchEvent(new rendererWindow.CustomEvent(SEEK_EVENT, { detail: timeS, bubbles: true }));
        }),
        log: given.log ?? noop,
        onStageLayout: given.onStageLayout,
        debug: given.debug
      },
      forgetScrollElement() {
        walkedMount = void 0;
      }
    };
  }
  function createLyricsRenderer(rendererOptions) {
    const rendererDocument = rendererOptions.document;
    const rendererWindow = rendererOptions.window;
    let mount = rendererOptions.mount ?? null;
    let containerResizeObserver = null;
    let createdThemeStyleElement = null;
    let isDestroyed = false;
    let currentLyrics = [];
    let currentLanguage = "";
    const { host, forgetScrollElement } = withHostDefaults(rendererOptions.host, rendererWindow, () => mount);
    const engine = createAnimationEngineInstance(rendererDocument, rendererWindow, host, rendererOptions.layout ?? "scroll");
    let imageMediaQueries = [];
    const refreshImagePaint = () => refreshInstrumentalImages(engine.lyricsContainer, rendererWindow);
    function syncImagePaint() {
      if (imageHighlights.getBooleanValue() && imageMediaQueries.length === 0) {
        imageMediaQueries = ["(dynamic-range: high)", "(forced-colors: active)"].map((query) => rendererWindow.matchMedia(query));
        for (const query of imageMediaQueries)
          query.addEventListener("change", refreshImagePaint);
      } else if (!imageHighlights.getBooleanValue()) {
        for (const query of imageMediaQueries)
          query.removeEventListener("change", refreshImagePaint);
        imageMediaQueries = [];
      }
      refreshImagePaint();
    }
    function measure2(measureLines = true) {
      forgetScrollElement();
      if (relayout(engine, measureLines && areLinesMeasurable(getRenderedLines(engine))))
        retickAtLastTime(engine);
    }
    function stopObservingContainer() {
      containerResizeObserver?.disconnect();
      containerResizeObserver = null;
    }
    function clearBuiltView() {
      stopObservingContainer();
      engine.lyricsContainer?.remove();
      clearLyrics(engine);
      currentLyrics = [];
      currentLanguage = "";
    }
    function observeContainer(container) {
      stopObservingContainer();
      const observer = new rendererWindow.ResizeObserver((entries) => {
        const target = entries[entries.length - 1]?.target;
        if (!target)
          return;
        if (hasContainerResized(engine, target.clientWidth, target.clientHeight))
          measure2();
      });
      observer.observe(container);
      containerResizeObserver = observer;
    }
    function adoptThemeStyleSheet(css) {
      const existingElement = createdThemeStyleElement ?? rendererDocument.getElementById(CUSTOM_THEME_STYLE_ID);
      if (existingElement !== null) {
        if (existingElement.textContent !== css)
          existingElement.textContent = css;
        return;
      }
      const styleElement = rendererDocument.createElement("style");
      styleElement.id = CUSTOM_THEME_STYLE_ID;
      styleElement.textContent = css;
      rendererDocument.head.appendChild(styleElement);
      createdThemeStyleElement = styleElement;
    }
    const remeasureForViewport = () => measure2();
    rendererWindow.addEventListener("resize", remeasureForViewport);
    void rendererDocument.fonts.ready.then(() => {
      if (isDestroyed)
        return;
      measure2();
    }).catch((error) => host.log(FONT_MEASURE_LOG, error));
    return {
      setLyrics(lyrics, options) {
        if (isDestroyed) {
          host.log(DESTROYED_SET_LYRICS_LOG);
          return;
        }
        const nextMount = options?.mount ?? mount;
        if (!nextMount) {
          throw new Error("A lyrics renderer needs a mount: give one to createLyricsRenderer or to setLyrics");
        }
        const viewOptions = {
          language: options?.language,
          loaderVisible: options?.loaderVisible ?? false,
          noLyrics: options?.noLyrics ?? false,
          songwriters: options?.songwriters,
          songKey: options?.songKey
        };
        const scrollTopBefore = host.getScrollElement()?.scrollTop ?? 0;
        const swapped = swapLyrics(engine, nextMount, lyrics, viewOptions);
        if (swapped === null) {
          clearBuiltView();
          mount = nextMount;
          setLyrics(engine, nextMount, lyrics, viewOptions);
        }
        syncImagePaint();
        currentLyrics = lyrics;
        currentLanguage = normalizeLanguage(options?.language);
        measure2();
        if (swapped !== null) {
          settleSwappedLines(engine, swapped, scrollTopBefore);
        } else if (engine.lyricsContainer) {
          observeContainer(engine.lyricsContainer);
        }
      },
      setLanguage(language) {
        const normalized = normalizeLanguage(language);
        if (isDestroyed || currentLyrics.length === 0 || normalized === currentLanguage)
          return;
        currentLanguage = normalized;
        const languages = resolveLyricLanguages(currentLyrics, normalized);
        getRenderedLines(engine).forEach((line, index) => applyLyricLanguage(line.lyricElement, languages[index]));
        measure2();
      },
      setTheme(css) {
        if (isDestroyed)
          return false;
        const needsLyricRebuild = setThemeSettings(parseThemeConfig(css));
        adoptThemeStyleSheet(css);
        syncImagePaint();
        clearStyleCaches(engine);
        measure2();
        return needsLyricRebuild;
      },
      tick(currentTimeS, options) {
        if (isDestroyed)
          return "lyrics-missing";
        return tickView(engine, currentTimeS, resolveTickOptions(options));
      },
      relayout(measureLines = true) {
        if (isDestroyed)
          return;
        measure2(measureLines);
      },
      clear() {
        if (isDestroyed)
          return;
        clearBuiltView();
      },
      destroy() {
        if (isDestroyed)
          return;
        isDestroyed = true;
        clearBuiltView();
        createdThemeStyleElement?.remove();
        createdThemeStyleElement = null;
        rendererWindow.removeEventListener("resize", remeasureForViewport);
        for (const query of imageMediaQueries)
          query.removeEventListener("change", refreshImagePaint);
        imageMediaQueries = [];
        engine.destroy();
      },
      noteUserScroll() {
        if (isDestroyed)
          return;
        noteUserScroll(engine, hasUnsyncedLyrics(engine));
      },
      noteVisibilityChange() {
        if (isDestroyed)
          return;
        noteVisibilityChange(engine);
      },
      resumeAutoscroll() {
        if (isDestroyed)
          return;
        resetScrollResume(engine);
      },
      clearOnScreenLyrics() {
        if (isDestroyed)
          return false;
        return clearOnScreenLyrics(engine);
      },
      scheduleLyricPositionUpdate(isTicking, retick) {
        if (isDestroyed)
          return;
        scheduleLyricPositionUpdate(engine, () => isTicking() && areLinesMeasurable(getRenderedLines(engine)), retick);
      },
      retickFromPlaybackClock(buildOptions2) {
        if (isDestroyed)
          return "lyrics-missing";
        return retickFromPlaybackClock(engine, buildOptions2);
      },
      // All three answer for an emptied view. `container` and `lines` are the state clearing drops, so
      // they answer that way already; `syncType` is derived from lyrics that are gone and nothing
      // resets it, so the container is the term that says they are still there.
      get container() {
        return engine.lyricsContainer;
      },
      get lines() {
        return getRenderedLines(engine);
      },
      get syncType() {
        return engine.lyricsContainer === null ? "none" : getRenderedSyncType(engine);
      }
    };
  }

  // web/node_modules/fast-xml-parser/src/util.js
  var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
  var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
  var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
  var regexName = new RegExp("^" + nameRegexp + "$");
  function getAllMatches(string, regex) {
    const matches = [];
    let match = regex.exec(string);
    while (match) {
      const allmatches = [];
      allmatches.startIndex = regex.lastIndex - match[0].length;
      const len = match.length;
      for (let index = 0; index < len; index++) {
        allmatches.push(match[index]);
      }
      matches.push(allmatches);
      match = regex.exec(string);
    }
    return matches;
  }
  var isName = function(string) {
    const match = regexName.exec(string);
    return !(match === null || typeof match === "undefined");
  };
  function isExist(v) {
    return typeof v !== "undefined";
  }
  var DANGEROUS_PROPERTY_NAMES = [
    // '__proto__',
    // 'constructor',
    // 'prototype',
    "hasOwnProperty",
    "toString",
    "valueOf",
    "__defineGetter__",
    "__defineSetter__",
    "__lookupGetter__",
    "__lookupSetter__"
  ];
  var criticalProperties = ["__proto__", "constructor", "prototype"];

  // web/node_modules/fast-xml-parser/src/validator.js
  var defaultOptions = {
    allowBooleanAttributes: false,
    //A tag can have attributes without any value
    unpairedTags: []
  };
  function validate(xmlData, options) {
    options = Object.assign({}, defaultOptions, options);
    const tags = [];
    let tagFound = false;
    let reachedRoot = false;
    if (xmlData[0] === "\uFEFF") {
      xmlData = xmlData.substr(1);
    }
    for (let i = 0; i < xmlData.length; i++) {
      if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
        i += 2;
        i = readPI(xmlData, i);
        if (i.err) return i;
      } else if (xmlData[i] === "<") {
        let tagStartPos = i;
        i++;
        if (xmlData[i] === "!") {
          i = readCommentAndCDATA(xmlData, i);
          continue;
        } else {
          let closingTag = false;
          if (xmlData[i] === "/") {
            closingTag = true;
            i++;
          }
          let tagName = "";
          for (; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++) {
            tagName += xmlData[i];
          }
          tagName = tagName.trim();
          if (tagName[tagName.length - 1] === "/") {
            tagName = tagName.substring(0, tagName.length - 1);
            i--;
          }
          if (!validateTagName(tagName)) {
            let msg;
            if (tagName.trim().length === 0) {
              msg = "Invalid space after '<'.";
            } else {
              msg = "Tag '" + tagName + "' is an invalid name.";
            }
            return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
          }
          const result = readAttributeStr(xmlData, i);
          if (result === false) {
            return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
          }
          let attrStr = result.value;
          i = result.index;
          if (attrStr[attrStr.length - 1] === "/") {
            const attrStrStart = i - attrStr.length;
            attrStr = attrStr.substring(0, attrStr.length - 1);
            const isValid = validateAttributeString(attrStr, options);
            if (isValid === true) {
              tagFound = true;
            } else {
              return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
            }
          } else if (closingTag) {
            if (!result.tagClosed) {
              return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
            } else if (attrStr.trim().length > 0) {
              return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
            } else if (tags.length === 0) {
              return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
            } else {
              const otg = tags.pop();
              if (tagName !== otg.tagName) {
                let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
                return getErrorObject(
                  "InvalidTag",
                  "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                  getLineNumberForPosition(xmlData, tagStartPos)
                );
              }
              if (tags.length == 0) {
                reachedRoot = true;
              }
            }
          } else {
            const isValid = validateAttributeString(attrStr, options);
            if (isValid !== true) {
              return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
            }
            if (reachedRoot === true) {
              return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
            } else if (options.unpairedTags.indexOf(tagName) !== -1) {
            } else {
              tags.push({ tagName, tagStartPos });
            }
            tagFound = true;
          }
          for (i++; i < xmlData.length; i++) {
            if (xmlData[i] === "<") {
              if (xmlData[i + 1] === "!") {
                i++;
                i = readCommentAndCDATA(xmlData, i);
                continue;
              } else if (xmlData[i + 1] === "?") {
                i = readPI(xmlData, ++i);
                if (i.err) return i;
              } else {
                break;
              }
            } else if (xmlData[i] === "&") {
              const afterAmp = validateAmpersand(xmlData, i);
              if (afterAmp == -1)
                return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
              i = afterAmp;
            } else {
              if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
                return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i));
              }
            }
          }
          if (xmlData[i] === "<") {
            i--;
          }
        }
      } else {
        if (isWhiteSpace(xmlData[i])) {
          continue;
        }
        return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
      }
    }
    if (!tagFound) {
      return getErrorObject("InvalidXml", "Start tag expected.", 1);
    } else if (tags.length == 1) {
      return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
    } else if (tags.length > 0) {
      return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t2) => t2.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
    }
    return true;
  }
  function isWhiteSpace(char) {
    return char === " " || char === "	" || char === "\n" || char === "\r";
  }
  function readPI(xmlData, i) {
    const start = i;
    for (; i < xmlData.length; i++) {
      if (xmlData[i] == "?" || xmlData[i] == " ") {
        const tagname = xmlData.substr(start, i - start);
        if (i > 5 && tagname === "xml") {
          return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
        } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
          i++;
          break;
        } else {
          continue;
        }
      }
    }
    return i;
  }
  function readCommentAndCDATA(xmlData, i) {
    if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
      for (i += 3; i < xmlData.length; i++) {
        if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
          i += 2;
          break;
        }
      }
    } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
      let angleBracketsCount = 1;
      for (i += 8; i < xmlData.length; i++) {
        if (xmlData[i] === "<") {
          angleBracketsCount++;
        } else if (xmlData[i] === ">") {
          angleBracketsCount--;
          if (angleBracketsCount === 0) {
            break;
          }
        }
      }
    } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
      for (i += 8; i < xmlData.length; i++) {
        if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
          i += 2;
          break;
        }
      }
    }
    return i;
  }
  var doubleQuote = '"';
  var singleQuote = "'";
  function readAttributeStr(xmlData, i) {
    let attrStr = "";
    let startChar = "";
    let tagClosed = false;
    for (; i < xmlData.length; i++) {
      if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
        if (startChar === "") {
          startChar = xmlData[i];
        } else if (startChar !== xmlData[i]) {
        } else {
          startChar = "";
        }
      } else if (xmlData[i] === ">") {
        if (startChar === "") {
          tagClosed = true;
          break;
        }
      }
      attrStr += xmlData[i];
    }
    if (startChar !== "") {
      return false;
    }
    return {
      value: attrStr,
      index: i,
      tagClosed
    };
  }
  function scanAttributeTokens(attrStr) {
    const tokens = [];
    const len = attrStr.length;
    let i = 0;
    while (i < len) {
      const tokenStart = i;
      while (i < len && isWhiteSpace(attrStr[i])) i++;
      if (i >= len) break;
      if (attrStr[i] === "=") {
        i = tokenStart + 1;
        continue;
      }
      const leadingWs = attrStr.slice(tokenStart, i);
      const nameStart = i;
      while (i < len && !isWhiteSpace(attrStr[i]) && attrStr[i] !== "=") i++;
      const name = attrStr.slice(nameStart, i);
      let equalsGroup;
      let j2 = i;
      while (j2 < len && isWhiteSpace(attrStr[j2])) j2++;
      if (j2 < len && attrStr[j2] === "=") {
        equalsGroup = attrStr.slice(i, j2 + 1);
        i = j2 + 1;
      }
      let quoteChar;
      let value;
      let k2 = i;
      while (k2 < len && isWhiteSpace(attrStr[k2])) k2++;
      if (k2 < len && (attrStr[k2] === '"' || attrStr[k2] === "'")) {
        const valueStart = k2 + 1;
        const closeIdx = attrStr.indexOf(attrStr[k2], valueStart);
        if (closeIdx !== -1) {
          quoteChar = attrStr[k2];
          value = attrStr.slice(valueStart, closeIdx);
          i = closeIdx + 1;
        }
      }
      const token = { startIndex: tokenStart };
      token[1] = leadingWs;
      token[2] = name;
      token[3] = equalsGroup;
      token[4] = quoteChar !== void 0 ? true : void 0;
      token[5] = quoteChar;
      token[6] = value;
      tokens.push(token);
    }
    return tokens;
  }
  function validateAttributeString(attrStr, options) {
    const matches = scanAttributeTokens(attrStr);
    const attrNames = {};
    for (let i = 0; i < matches.length; i++) {
      if (matches[i][1].length === 0) {
        return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
      } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
        return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
      } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
        return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
      }
      const attrName = matches[i][2];
      if (!validateAttrName(attrName)) {
        return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
      }
      if (!Object.prototype.hasOwnProperty.call(attrNames, attrName)) {
        attrNames[attrName] = 1;
      } else {
        return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
      }
    }
    return true;
  }
  function validateNumberAmpersand(xmlData, i) {
    let re = /\d/;
    if (xmlData[i] === "x") {
      i++;
      re = /[\da-fA-F]/;
    }
    for (; i < xmlData.length; i++) {
      if (xmlData[i] === ";")
        return i;
      if (!xmlData[i].match(re))
        break;
    }
    return -1;
  }
  function validateAmpersand(xmlData, i) {
    i++;
    if (xmlData[i] === ";")
      return -1;
    if (xmlData[i] === "#") {
      i++;
      return validateNumberAmpersand(xmlData, i);
    }
    let count = 0;
    for (; i < xmlData.length; i++, count++) {
      if (xmlData[i].match(/\w/) && count < 20)
        continue;
      if (xmlData[i] === ";")
        break;
      return -1;
    }
    return i;
  }
  function getErrorObject(code, message, lineNumber) {
    return {
      err: {
        code,
        msg: message,
        line: lineNumber.line || lineNumber,
        col: lineNumber.col
      }
    };
  }
  function validateAttrName(attrName) {
    return isName(attrName);
  }
  function validateTagName(tagname) {
    return isName(tagname);
  }
  function getLineNumberForPosition(xmlData, index) {
    const lines = xmlData.substring(0, index).split(/\r?\n/);
    return {
      line: lines.length,
      // column number is last line's length + 1, because column numbering starts at 1:
      col: lines[lines.length - 1].length + 1
    };
  }
  function getPositionFromMatch(match) {
    return match.startIndex + match[1].length;
  }

  // web/node_modules/@nodable/entities/src/entities.js
  var CURRENCY = {
    cent: "\xA2",
    pound: "\xA3",
    curren: "\xA4",
    yen: "\xA5",
    euro: "\u20AC",
    dollar: "$",
    fnof: "\u0192",
    inr: "\u20B9",
    af: "\u060B",
    birr: "\u1265\u122D",
    peso: "\u20B1",
    rub: "\u20BD",
    won: "\u20A9",
    yuan: "\xA5",
    cedil: "\xB8"
  };
  var XML = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"'
  };
  var COMMON_HTML = {
    nbsp: "\xA0",
    copy: "\xA9",
    reg: "\xAE",
    trade: "\u2122",
    mdash: "\u2014",
    ndash: "\u2013",
    hellip: "\u2026",
    laquo: "\xAB",
    raquo: "\xBB",
    lsquo: "\u2018",
    rsquo: "\u2019",
    ldquo: "\u201C",
    rdquo: "\u201D",
    bull: "\u2022",
    para: "\xB6",
    sect: "\xA7",
    deg: "\xB0",
    frac12: "\xBD",
    frac14: "\xBC",
    frac34: "\xBE"
  };

  // web/node_modules/@nodable/entities/src/EntityDecoder.js
  var ENTITY_ACTION = Object.freeze({
    /** Resolve and expand the entity normally. */
    ALLOW: "allow",
    /** Silently skip this entity — it will not be registered. */
    BLOCK: "block",
    /** Throw an error, aborting entity registration entirely. */
    THROW: "throw"
  });
  var SPECIAL_CHARS = new Set("!?\\\\/[]$%{}^&*()<>|+");
  function validateEntityName(name) {
    if (name[0] === "#") {
      throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${name}"`);
    }
    for (const ch of name) {
      if (SPECIAL_CHARS.has(ch)) {
        throw new Error(`[EntityReplacer] Invalid character '${ch}' in entity name: "${name}"`);
      }
    }
    return name;
  }
  function mergeEntityMaps(...maps) {
    const out = /* @__PURE__ */ Object.create(null);
    for (const map of maps) {
      if (!map) continue;
      for (const key of Object.keys(map)) {
        const raw = map[key];
        if (typeof raw === "string") {
          out[key] = raw;
        } else if (raw && typeof raw === "object" && raw.val !== void 0) {
          const val = raw.val;
          if (typeof val === "string") {
            out[key] = val;
          }
        }
      }
    }
    return out;
  }
  var LIMIT_TIER_EXTERNAL = "external";
  var LIMIT_TIER_BASE = "base";
  var LIMIT_TIER_ALL = "all";
  function parseLimitTiers(raw) {
    if (!raw || raw === LIMIT_TIER_EXTERNAL) return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
    if (raw === LIMIT_TIER_ALL) return /* @__PURE__ */ new Set([LIMIT_TIER_ALL]);
    if (raw === LIMIT_TIER_BASE) return /* @__PURE__ */ new Set([LIMIT_TIER_BASE]);
    if (Array.isArray(raw)) return new Set(raw);
    return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
  }
  var NCR_LEVEL = Object.freeze({ allow: 0, leave: 1, remove: 2, throw: 3 });
  var XML10_ALLOWED_C0 = /* @__PURE__ */ new Set([9, 10, 13]);
  function parseNCRConfig(ncr) {
    if (!ncr) {
      return { xmlVersion: 1, onLevel: NCR_LEVEL.allow, nullLevel: NCR_LEVEL.remove };
    }
    const xmlVersion = ncr.xmlVersion === 1.1 ? 1.1 : 1;
    const onLevel = NCR_LEVEL[ncr.onNCR] ?? NCR_LEVEL.allow;
    const nullLevel = NCR_LEVEL[ncr.nullNCR] ?? NCR_LEVEL.remove;
    const clampedNull = Math.max(nullLevel, NCR_LEVEL.remove);
    return { xmlVersion, onLevel, nullLevel: clampedNull };
  }
  var EntityDecoder = class {
    /**
     * @param {object} [options]
     * @param {object|null}  [options.namedEntities]        — extra named entities merged into base map
     * @param {object}  [options.limit]                 — security limits
     * @param {number}       [options.limit.maxTotalExpansions=0]  — 0 = unlimited
     * @param {number}       [options.limit.maxExpandedLength=0]   — 0 = unlimited
     * @param {'external'|'base'|'all'|string[]} [options.limit.applyLimitsTo='external']
     *   Which entity tiers count against the security limits:
     *   - 'external' (default) — only input/runtime + persistent external entities
     *   - 'base'               — only DEFAULT_XML_ENTITIES + namedEntities
     *   - 'all'                — every entity regardless of tier
     *   - string[]             — explicit combination, e.g. ['external', 'base']
     * @param {((resolved: string, original: string) => string)|null} [options.postCheck=null]
     * @param {string[]} [options.remove=[]] — entity names (e.g. ['nbsp', '#13']) to delete (replace with empty string)
     * @param {string[]} [options.leave=[]]  — entity names to keep as literal (unchanged in output)
     * @param {object}   [options.ncr]       — Numeric Character Reference controls
     * @param {1.0|1.1}  [options.ncr.xmlVersion=1.0]
     *   XML version governing which codepoint ranges are restricted:
     *   - 1.0 — C0 controls U+0001–U+001F (except U+0009/000A/000D) are prohibited
     *   - 1.1 — C0 controls are allowed when written as NCRs; C1 (U+007F–U+009F) decoded as-is
     * @param {'allow'|'leave'|'remove'|'throw'} [options.ncr.onNCR='allow']
     *   Base action for numeric references. Severity order: allow < leave < remove < throw.
     *   For codepoint ranges that carry a minimum level (surrogates → remove, XML 1.0 C0 → remove),
     *   the effective action is max(onNCR, rangeMinimum).
     * @param {'remove'|'throw'} [options.ncr.nullNCR='remove']
     *   Action for U+0000 (null). 'allow' and 'leave' are clamped to 'remove' since null is never safe.
     * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onExternalEntity=null]
     *   Hook called when an external entity is registered via `setExternalEntities()` or
     *   `addExternalEntity()`. Return `ENTITY_ACTION.ALLOW` to accept the entity,
     *   `ENTITY_ACTION.BLOCK` to silently skip it, or `ENTITY_ACTION.THROW` to abort with an error.
     * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onInputEntity=null]
     *   Hook called when an input entity is registered via `addInputEntities()`. Return
     *   `ENTITY_ACTION.ALLOW` to accept, `ENTITY_ACTION.BLOCK` to silently skip, or
     *   `ENTITY_ACTION.THROW` to abort with an error.
     */
    constructor(options = {}) {
      this._limit = options.limit || {};
      this._maxTotalExpansions = this._limit.maxTotalExpansions || 0;
      this._maxExpandedLength = this._limit.maxExpandedLength || 0;
      this._postCheck = typeof options.postCheck === "function" ? options.postCheck : (r) => r;
      this._limitTiers = parseLimitTiers(this._limit.applyLimitsTo ?? LIMIT_TIER_EXTERNAL);
      this._numericAllowed = options.numericAllowed ?? true;
      this._baseMap = mergeEntityMaps(XML, options.namedEntities || null);
      this._externalMap = /* @__PURE__ */ Object.create(null);
      this._inputMap = /* @__PURE__ */ Object.create(null);
      this._totalExpansions = 0;
      this._expandedLength = 0;
      this._removeSet = new Set(options.remove && Array.isArray(options.remove) ? options.remove : []);
      this._leaveSet = new Set(options.leave && Array.isArray(options.leave) ? options.leave : []);
      const ncrCfg = parseNCRConfig(options.ncr);
      this._ncrXmlVersion = ncrCfg.xmlVersion;
      this._ncrOnLevel = ncrCfg.onLevel;
      this._ncrNullLevel = ncrCfg.nullLevel;
      this._onExternalEntity = typeof options.onExternalEntity === "function" ? options.onExternalEntity : null;
      this._onInputEntity = typeof options.onInputEntity === "function" ? options.onInputEntity : null;
    }
    // -------------------------------------------------------------------------
    // Private: registration hook dispatch
    // -------------------------------------------------------------------------
    /**
     * Invoke a registration hook for a single entity name/value pair.
     * Returns true when the entity should be accepted, false when it should be
     * silently skipped (BLOCK), and throws when the hook returns THROW.
     *
     * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} hook
     * @param {string} name
     * @param {string} value
     * @param {string} context  — used in error messages ('external' | 'input')
     * @returns {boolean}  true = accept, false = skip
     */
    _applyRegistrationHook(hook, name, value, context) {
      if (!hook) return true;
      const action = hook(name, value);
      if (action === ENTITY_ACTION.BLOCK) return false;
      if (action === ENTITY_ACTION.THROW) {
        throw new Error(
          `[EntityDecoder] Registration of ${context} entity "&${name};" was rejected by hook`
        );
      }
      return true;
    }
    // -------------------------------------------------------------------------
    // Persistent external entity registration
    // -------------------------------------------------------------------------
    /**
     * Replace the full set of persistent external entities.
     * All keys are validated — throws on invalid characters.
     * If `onExternalEntity` is set, it is called once per entry; entries that
     * return `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW`
     * aborts the whole call.
     * @param {Record<string, string | { regex?: RegExp, val: string }>} map
     */
    setExternalEntities(map) {
      if (map) {
        for (const key of Object.keys(map)) {
          validateEntityName(key);
        }
      }
      if (!this._onExternalEntity) {
        this._externalMap = mergeEntityMaps(map);
        return;
      }
      const flat = mergeEntityMaps(map);
      const filtered = /* @__PURE__ */ Object.create(null);
      for (const [name, value] of Object.entries(flat)) {
        if (this._applyRegistrationHook(this._onExternalEntity, name, value, "external")) {
          filtered[name] = value;
        }
      }
      this._externalMap = filtered;
    }
    /**
     * Add a single persistent external entity.
     * If `onExternalEntity` is set it is called before the entity is stored;
     * `ENTITY_ACTION.BLOCK` silently skips storage, `ENTITY_ACTION.THROW` raises.
     * @param {string} key
     * @param {string} value
     */
    addExternalEntity(key, value) {
      validateEntityName(key);
      if (typeof value === "string" && value.indexOf("&") === -1) {
        if (this._applyRegistrationHook(this._onExternalEntity, key, value, "external")) {
          this._externalMap[key] = value;
        }
      }
    }
    // -------------------------------------------------------------------------
    // Input / runtime entity registration (per document)
    // -------------------------------------------------------------------------
    /**
     * Inject DOCTYPE entities for the current document.
     * Also resets per-document expansion counters.
     * If `onInputEntity` is set it is called once per entry; entries returning
     * `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW` aborts.
     * @param {Record<string, string | { regx?: RegExp, regex?: RegExp, val: string }>} map
     */
    addInputEntities(map) {
      this._totalExpansions = 0;
      this._expandedLength = 0;
      if (!this._onInputEntity) {
        this._inputMap = mergeEntityMaps(map);
        return;
      }
      const flat = mergeEntityMaps(map);
      const filtered = /* @__PURE__ */ Object.create(null);
      for (const [name, value] of Object.entries(flat)) {
        if (this._applyRegistrationHook(this._onInputEntity, name, value, "input")) {
          filtered[name] = value;
        }
      }
      this._inputMap = filtered;
    }
    // -------------------------------------------------------------------------
    // Per-document reset
    // -------------------------------------------------------------------------
    /**
     * Wipe input/runtime entities and reset counters.
     * Call this before processing each new document.
     * @returns {this}
     */
    reset() {
      this._inputMap = /* @__PURE__ */ Object.create(null);
      this._totalExpansions = 0;
      this._expandedLength = 0;
      return this;
    }
    // -------------------------------------------------------------------------
    // XML version (can be set after construction, e.g. once parser reads <?xml?>)
    // -------------------------------------------------------------------------
    /**
     * Update the XML version used for NCR classification.
     * Call this as soon as the document's `<?xml version="...">` declaration is parsed.
     * @param {1.0|1.1|number} version
     */
    setXmlVersion(version) {
      this._ncrXmlVersion = version === 1.1 ? 1.1 : 1;
    }
    // -------------------------------------------------------------------------
    // Primary API
    // -------------------------------------------------------------------------
    /**
     * Replace all entity references in `str` in a single pass.
     *
     * @param {string} str
     * @returns {string}
     */
    decode(str) {
      if (typeof str !== "string" || str.length === 0) return str;
      if (str.indexOf("&") === -1) return str;
      const original = str;
      const chunks = [];
      const len = str.length;
      let last = 0;
      let i = 0;
      const limitExpansions = this._maxTotalExpansions > 0;
      const limitLength = this._maxExpandedLength > 0;
      const checkLimits = limitExpansions || limitLength;
      while (i < len) {
        if (str.charCodeAt(i) !== 38) {
          i++;
          continue;
        }
        let j2 = i + 1;
        while (j2 < len && str.charCodeAt(j2) !== 59 && j2 - i <= 32) j2++;
        if (j2 >= len || str.charCodeAt(j2) !== 59) {
          i++;
          continue;
        }
        const token = str.slice(i + 1, j2);
        if (token.length === 0) {
          i++;
          continue;
        }
        let replacement;
        let tier;
        if (this._removeSet.has(token)) {
          replacement = "";
          if (tier === void 0) {
            tier = LIMIT_TIER_EXTERNAL;
          }
        } else if (this._leaveSet.has(token)) {
          i++;
          continue;
        } else if (token.charCodeAt(0) === 35) {
          const ncrResult = this._resolveNCR(token);
          if (ncrResult === void 0) {
            i++;
            continue;
          }
          replacement = ncrResult;
          tier = LIMIT_TIER_BASE;
        } else {
          const resolved = this._resolveName(token);
          replacement = resolved?.value;
          tier = resolved?.tier;
        }
        if (replacement === void 0) {
          i++;
          continue;
        }
        if (i > last) chunks.push(str.slice(last, i));
        chunks.push(replacement);
        last = j2 + 1;
        i = last;
        if (checkLimits && this._tierCounts(tier)) {
          if (limitExpansions) {
            this._totalExpansions++;
            if (this._totalExpansions > this._maxTotalExpansions) {
              throw new Error(
                `[EntityReplacer] Entity expansion count limit exceeded: ${this._totalExpansions} > ${this._maxTotalExpansions}`
              );
            }
          }
          if (limitLength) {
            const delta = replacement.length - (token.length + 2);
            if (delta > 0) {
              this._expandedLength += delta;
              if (this._expandedLength > this._maxExpandedLength) {
                throw new Error(
                  `[EntityReplacer] Expanded content length limit exceeded: ${this._expandedLength} > ${this._maxExpandedLength}`
                );
              }
            }
          }
        }
      }
      if (last < len) chunks.push(str.slice(last));
      const result = chunks.length === 0 ? str : chunks.join("");
      return this._postCheck(result, original);
    }
    // -------------------------------------------------------------------------
    // Private: limit tier check
    // -------------------------------------------------------------------------
    /**
     * Returns true if a resolved entity of the given tier should count
     * against the expansion/length limits.
     * @param {string} tier  — LIMIT_TIER_EXTERNAL | LIMIT_TIER_BASE
     * @returns {boolean}
     */
    _tierCounts(tier) {
      if (this._limitTiers.has(LIMIT_TIER_ALL)) return true;
      return this._limitTiers.has(tier);
    }
    // -------------------------------------------------------------------------
    // Private: entity resolution
    // -------------------------------------------------------------------------
    /**
     * Resolve a named entity token (without & and ;).
     * Priority: inputMap > externalMap > baseMap
     * Returns the resolved value tagged with its limit tier.
     *
     * @param {string} name
     * @returns {{ value: string, tier: string }|undefined}
     */
    _resolveName(name) {
      if (name in this._inputMap) return { value: this._inputMap[name], tier: LIMIT_TIER_EXTERNAL };
      if (name in this._externalMap) return { value: this._externalMap[name], tier: LIMIT_TIER_EXTERNAL };
      if (name in this._baseMap) return { value: this._baseMap[name], tier: LIMIT_TIER_BASE };
      return void 0;
    }
    /**
     * Classify a codepoint and return the minimum action level that must be applied.
     * Returns -1 when no minimum is imposed (normal allow path).
     *
     * Ranges checked (in priority order):
     *   1. U+0000            — null, governed by nullNCR (always ≥ remove)
     *   2. U+D800–U+DFFF     — surrogates, always prohibited (min: remove)
     *   3. U+0001–U+001F \ {0x09,0x0A,0x0D}  — XML 1.0 restricted C0 (min: remove)
     *      (skipped in XML 1.1 — C0 controls are allowed when written as NCRs)
     *
     * @param {number} cp  — codepoint
     * @returns {number}   — minimum NCR_LEVEL value, or -1 for no restriction
     */
    _classifyNCR(cp) {
      if (cp === 0) return this._ncrNullLevel;
      if (cp >= 55296 && cp <= 57343) return NCR_LEVEL.remove;
      if (this._ncrXmlVersion === 1) {
        if (cp >= 1 && cp <= 31 && !XML10_ALLOWED_C0.has(cp)) return NCR_LEVEL.remove;
      }
      return -1;
    }
    /**
     * Execute a resolved NCR action.
     *
     * @param {number} action   — NCR_LEVEL value
     * @param {string} token    — raw token (e.g. '#38') for error messages
     * @param {number} cp       — codepoint, used only for error messages
     * @returns {string|undefined}
     *   - decoded character string  → 'allow'
     *   - ''                        → 'remove'
     *   - undefined                 → 'leave' (caller must skip past '&' only)
     *   - throws Error              → 'throw'
     */
    _applyNCRAction(action, token, cp) {
      switch (action) {
        case NCR_LEVEL.allow:
          return String.fromCodePoint(cp);
        case NCR_LEVEL.remove:
          return "";
        case NCR_LEVEL.leave:
          return void 0;
        // signal: keep literal
        case NCR_LEVEL.throw:
          throw new Error(
            `[EntityDecoder] Prohibited numeric character reference &${token}; (U+${cp.toString(16).toUpperCase().padStart(4, "0")})`
          );
        default:
          return String.fromCodePoint(cp);
      }
    }
    /**
     * Full NCR resolution pipeline for a numeric token.
     *
     * Steps:
     *   1. Parse the codepoint (decimal or hex).
     *   2. Validate the raw codepoint range (NaN, <0, >0x10FFFF).
     *   3. If numericAllowed is false and no minimum restriction applies → leave as-is.
     *   4. Classify the codepoint to find the minimum required action level.
     *   5. Resolve effective action = max(onNCR, minimum).
     *   6. Apply and return.
     *
     * @param {string} token  — e.g. '#38', '#x26', '#X26'
     * @returns {string|undefined}
     *   - string (incl. '')  — replacement ('' = remove)
     *   - undefined          — leave original &token; as-is
     */
    _resolveNCR(token) {
      const second = token.charCodeAt(1);
      let cp;
      if (second === 120 || second === 88) {
        cp = parseInt(token.slice(2), 16);
      } else {
        cp = parseInt(token.slice(1), 10);
      }
      if (Number.isNaN(cp) || cp < 0 || cp > 1114111) return void 0;
      const minimum = this._classifyNCR(cp);
      if (!this._numericAllowed && minimum < NCR_LEVEL.remove) return void 0;
      const effective = minimum === -1 ? this._ncrOnLevel : Math.max(this._ncrOnLevel, minimum);
      return this._applyNCRAction(effective, token, cp);
    }
  };

  // web/node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
  var defaultOnDangerousProperty = (name) => {
    if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
      return "__" + name;
    }
    return name;
  };
  var defaultOptions2 = {
    preserveOrder: false,
    attributeNamePrefix: "@_",
    attributesGroupName: false,
    textNodeName: "#text",
    ignoreAttributes: true,
    removeNSPrefix: false,
    // remove NS from tag name or attribute name if true
    allowBooleanAttributes: false,
    //a tag can have attributes without any value
    //ignoreRootElement : false,
    parseTagValue: true,
    parseAttributeValue: false,
    trimValues: true,
    //Trim string values of tag and attributes
    cdataPropName: false,
    numberParseOptions: {
      hex: true,
      leadingZeros: true,
      eNotation: true,
      unicode: false
    },
    tagValueProcessor: function(tagName, val) {
      return val;
    },
    attributeValueProcessor: function(attrName, val) {
      return val;
    },
    stopNodes: [],
    //nested tags will not be parsed even for errors
    alwaysCreateTextNode: false,
    isArray: () => false,
    commentPropName: false,
    unpairedTags: [],
    processEntities: true,
    htmlEntities: false,
    entityDecoder: null,
    ignoreDeclaration: false,
    ignorePiTags: false,
    transformTagName: false,
    transformAttributeName: false,
    updateTag: function(tagName, jPath, attrs) {
      return tagName;
    },
    // skipEmptyListItem: false
    captureMetaData: false,
    maxNestedTags: 100,
    strictReservedNames: true,
    jPath: true,
    // if true, pass jPath string to callbacks; if false, pass matcher instance
    onDangerousProperty: defaultOnDangerousProperty
  };
  function validatePropertyName(propertyName, optionName) {
    if (typeof propertyName !== "string") {
      return;
    }
    const normalized = propertyName.toLowerCase();
    if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
      throw new Error(
        `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
      );
    }
    if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
      throw new Error(
        `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
      );
    }
  }
  function normalizeProcessEntities(value, htmlEntities) {
    if (typeof value === "boolean") {
      return {
        enabled: value,
        // true or false
        maxEntitySize: 1e4,
        maxExpansionDepth: 1e4,
        maxTotalExpansions: Infinity,
        maxExpandedLength: 1e5,
        maxEntityCount: 1e3,
        allowedTags: null,
        tagFilter: null,
        appliesTo: "all"
      };
    }
    if (typeof value === "object" && value !== null) {
      return {
        enabled: value.enabled !== false,
        maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
        maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
        maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
        maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
        maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
        allowedTags: value.allowedTags ?? null,
        tagFilter: value.tagFilter ?? null,
        appliesTo: value.appliesTo ?? "all"
      };
    }
    return normalizeProcessEntities(true);
  }
  var buildOptions = function(options) {
    const built = Object.assign({}, defaultOptions2, options);
    const propertyNameOptions = [
      { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
      { value: built.attributesGroupName, name: "attributesGroupName" },
      { value: built.textNodeName, name: "textNodeName" },
      { value: built.cdataPropName, name: "cdataPropName" },
      { value: built.commentPropName, name: "commentPropName" }
    ];
    for (const { value, name } of propertyNameOptions) {
      if (value) {
        validatePropertyName(value, name);
      }
    }
    if (built.onDangerousProperty === null) {
      built.onDangerousProperty = defaultOnDangerousProperty;
    }
    built.processEntities = normalizeProcessEntities(built.processEntities, built.htmlEntities);
    built.unpairedTagsSet = new Set(built.unpairedTags);
    if (built.stopNodes && Array.isArray(built.stopNodes)) {
      built.stopNodes = built.stopNodes.map((node) => {
        if (typeof node === "string" && node.startsWith("*.")) {
          return ".." + node.substring(2);
        }
        return node;
      });
    }
    return built;
  };

  // web/node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
  var METADATA_SYMBOL;
  if (typeof Symbol !== "function") {
    METADATA_SYMBOL = "@@xmlMetadata";
  } else {
    METADATA_SYMBOL = Symbol("XML Node Metadata");
  }
  var XmlNode = class {
    constructor(tagname) {
      this.tagname = tagname;
      this.child = [];
      this[":@"] = /* @__PURE__ */ Object.create(null);
    }
    add(key, val) {
      if (key === "__proto__") key = "#__proto__";
      this.child.push({ [key]: val });
    }
    addChild(node, startIndex) {
      if (node.tagname === "__proto__") node.tagname = "#__proto__";
      if (node[":@"] && Object.keys(node[":@"]).length > 0) {
        this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
      } else {
        this.child.push({ [node.tagname]: node.child });
      }
      this.addStartIndex(startIndex);
    }
    addStartIndex(startIndex) {
      if (startIndex !== void 0) {
        this.child[this.child.length - 1][METADATA_SYMBOL] = { startIndex };
      }
    }
    addEndIndex(endIndex) {
      const lastChild = this.child[this.child.length - 1];
      if (lastChild !== void 0 && lastChild[METADATA_SYMBOL] !== void 0 && lastChild[METADATA_SYMBOL].endIndex === void 0) {
        lastChild[METADATA_SYMBOL].endIndex = endIndex;
      }
    }
    /** symbol used for metadata */
    static getMetaDataSymbol() {
      return METADATA_SYMBOL;
    }
  };

  // web/node_modules/fast-xml-parser/node_modules/xml-naming/src/index.js
  var nameStartChar10 = ":A-Za-z_\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD";
  var nameChar10 = nameStartChar10 + "\\-\\.\\d\xB7\u0300-\u036F\u203F-\u2040";
  var nameStartChar11 = ":A-Za-z_\xC0-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}";
  var nameChar11 = nameStartChar11 + "\\-\\.\\d\xB7\u0300-\u036F\u0487\u203F-\u2040";
  var buildRegexes = (startChar, char, flags = "") => {
    const ncStart = startChar.replace(":", "");
    const ncChar = char.replace(":", "");
    const ncNamePat = `[${ncStart}][${ncChar}]*`;
    return {
      name: new RegExp(`^[${startChar}][${char}]*$`, flags),
      ncName: new RegExp(`^${ncNamePat}$`, flags),
      qName: new RegExp(`^${ncNamePat}(?::${ncNamePat})?$`, flags),
      nmToken: new RegExp(`^[${char}]+$`, flags),
      nmTokens: new RegExp(`^[${char}]+(?:\\s+[${char}]+)*$`, flags)
    };
  };
  var regexes10 = buildRegexes(nameStartChar10, nameChar10);
  var regexes11 = buildRegexes(nameStartChar11, nameChar11, "u");
  var nameStartCharAscii = ":A-Za-z_";
  var nameCharAscii = nameStartCharAscii + "\\-\\.\\d";
  var regexesAscii = buildRegexes(nameStartCharAscii, nameCharAscii);
  var getRegexes = (xmlVersion = "1.0", asciiOnly = false) => {
    if (asciiOnly) return regexesAscii;
    return xmlVersion === "1.1" ? regexes11 : regexes10;
  };
  var qName = (str, { xmlVersion = "1.0", asciiOnly = false } = {}) => getRegexes(xmlVersion, asciiOnly).qName.test(str);

  // web/node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
  var DocTypeReader = class {
    constructor(options, xmlVersion) {
      this.suppressValidationErr = !options;
      this.options = options;
      this.xmlVersion = xmlVersion || 1;
    }
    setXmlVersion(xmlVersion = 1) {
      this.xmlVersion = xmlVersion;
    }
    readDocType(xmlData, i) {
      const entities = /* @__PURE__ */ Object.create(null);
      let entityCount = 0;
      if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
        i = i + 9;
        let angleBracketsCount = 1;
        let hasBody = false, comment = false;
        let quoteChar = null;
        let exp = "";
        for (; i < xmlData.length; i++) {
          if (quoteChar !== null) {
            if (xmlData[i] === quoteChar) quoteChar = null;
            exp += xmlData[i];
            continue;
          }
          if (!hasBody && !comment && (xmlData[i] === '"' || xmlData[i] === "'")) {
            quoteChar = xmlData[i];
            exp += xmlData[i];
            continue;
          }
          if (xmlData[i] === "<" && !comment) {
            if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
              i += 7;
              let entityName, val;
              [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
              if (val.indexOf("&") === -1) {
                if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                  throw new Error(
                    `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                  );
                }
                entities[entityName] = val;
                entityCount++;
              }
            } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
              i += 8;
              const { index } = this.readElementExp(xmlData, i + 1);
              i = index;
            } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
              i += 8;
            } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
              i += 9;
              const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
              i = index;
            } else if (hasSeq(xmlData, "!--", i)) comment = true;
            else throw new Error(`Invalid DOCTYPE`);
            angleBracketsCount++;
            exp = "";
          } else if (xmlData[i] === ">") {
            if (comment) {
              if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
                comment = false;
                angleBracketsCount--;
              }
            } else {
              angleBracketsCount--;
            }
            if (angleBracketsCount === 0) {
              break;
            }
          } else if (xmlData[i] === "[") {
            hasBody = true;
          } else {
            exp += xmlData[i];
          }
        }
        if (quoteChar !== null || angleBracketsCount !== 0) {
          throw new Error(`Unclosed DOCTYPE`);
        }
      } else {
        throw new Error(`Invalid Tag instead of DOCTYPE`);
      }
      return { entities, i };
    }
    readEntityExp(xmlData, i) {
      i = skipWhitespace(xmlData, i);
      const startIndex = i;
      while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
        i++;
      }
      let entityName = xmlData.substring(startIndex, i);
      validateEntityName2(entityName, { xmlVersion: this.xmlVersion });
      i = skipWhitespace(xmlData, i);
      if (!this.suppressValidationErr) {
        if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
          throw new Error("External entities are not supported");
        } else if (xmlData[i] === "%") {
          throw new Error("Parameter entities are not supported");
        }
      }
      let entityValue = "";
      [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");
      if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
        throw new Error(
          `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
        );
      }
      i--;
      return [entityName, entityValue, i];
    }
    readNotationExp(xmlData, i) {
      i = skipWhitespace(xmlData, i);
      const startIndex = i;
      while (i < xmlData.length && !/\s/.test(xmlData[i])) {
        i++;
      }
      let notationName = xmlData.substring(startIndex, i);
      !this.suppressValidationErr && validateEntityName2(notationName, { xmlVersion: this.xmlVersion });
      i = skipWhitespace(xmlData, i);
      const identifierType = xmlData.substring(i, i + 6).toUpperCase();
      if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
        throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
      }
      i += identifierType.length;
      i = skipWhitespace(xmlData, i);
      let publicIdentifier = null;
      let systemIdentifier = null;
      if (identifierType === "PUBLIC") {
        [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");
        i = skipWhitespace(xmlData, i);
        if (xmlData[i] === '"' || xmlData[i] === "'") {
          [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
        }
      } else if (identifierType === "SYSTEM") {
        [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
        if (!this.suppressValidationErr && !systemIdentifier) {
          throw new Error("Missing mandatory system identifier for SYSTEM notation");
        }
      }
      return { notationName, publicIdentifier, systemIdentifier, index: --i };
    }
    readIdentifierVal(xmlData, i, type) {
      let identifierVal = "";
      const startChar = xmlData[i];
      if (startChar !== '"' && startChar !== "'") {
        throw new Error(`Expected quoted string, found "${startChar}"`);
      }
      i++;
      const startIndex = i;
      while (i < xmlData.length && xmlData[i] !== startChar) {
        i++;
      }
      identifierVal = xmlData.substring(startIndex, i);
      if (xmlData[i] !== startChar) {
        throw new Error(`Unterminated ${type} value`);
      }
      i++;
      return [i, identifierVal];
    }
    readElementExp(xmlData, i) {
      i = skipWhitespace(xmlData, i);
      const startIndex = i;
      while (i < xmlData.length && !/\s/.test(xmlData[i])) {
        i++;
      }
      let elementName = xmlData.substring(startIndex, i);
      if (!this.suppressValidationErr && !qName(elementName, { xmlVersion: this.xmlVersion })) {
        throw new Error(`Invalid element name: "${elementName}"`);
      }
      i = skipWhitespace(xmlData, i);
      let contentModel = "";
      if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) i += 4;
      else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) i += 2;
      else if (xmlData[i] === "(") {
        i++;
        const startIndex2 = i;
        while (i < xmlData.length && xmlData[i] !== ")") {
          i++;
        }
        contentModel = xmlData.substring(startIndex2, i);
        if (xmlData[i] !== ")") {
          throw new Error("Unterminated content model");
        }
      } else if (!this.suppressValidationErr) {
        throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
      }
      return {
        elementName,
        contentModel: contentModel.trim(),
        index: i
      };
    }
    readAttlistExp(xmlData, i) {
      i = skipWhitespace(xmlData, i);
      let startIndex = i;
      while (i < xmlData.length && !/\s/.test(xmlData[i])) {
        i++;
      }
      let elementName = xmlData.substring(startIndex, i);
      validateEntityName2(elementName, { xmlVersion: this.xmlVersion });
      i = skipWhitespace(xmlData, i);
      startIndex = i;
      while (i < xmlData.length && !/\s/.test(xmlData[i])) {
        i++;
      }
      let attributeName = xmlData.substring(startIndex, i);
      if (!validateEntityName2(attributeName, { xmlVersion: this.xmlVersion })) {
        throw new Error(`Invalid attribute name: "${attributeName}"`);
      }
      i = skipWhitespace(xmlData, i);
      let attributeType = "";
      if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
        attributeType = "NOTATION";
        i += 8;
        i = skipWhitespace(xmlData, i);
        if (xmlData[i] !== "(") {
          throw new Error(`Expected '(', found "${xmlData[i]}"`);
        }
        i++;
        let allowedNotations = [];
        while (i < xmlData.length && xmlData[i] !== ")") {
          const startIndex2 = i;
          while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
            i++;
          }
          let notation = xmlData.substring(startIndex2, i);
          notation = notation.trim();
          if (!validateEntityName2(notation, { xmlVersion: this.xmlVersion })) {
            throw new Error(`Invalid notation name: "${notation}"`);
          }
          allowedNotations.push(notation);
          if (xmlData[i] === "|") {
            i++;
            i = skipWhitespace(xmlData, i);
          }
        }
        if (xmlData[i] !== ")") {
          throw new Error("Unterminated list of notations");
        }
        i++;
        attributeType += " (" + allowedNotations.join("|") + ")";
      } else {
        const startIndex2 = i;
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          i++;
        }
        attributeType += xmlData.substring(startIndex2, i);
        const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
        if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
          throw new Error(`Invalid attribute type: "${attributeType}"`);
        }
      }
      i = skipWhitespace(xmlData, i);
      let defaultValue = "";
      if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
        defaultValue = "#REQUIRED";
        i += 8;
      } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
        defaultValue = "#IMPLIED";
        i += 7;
      } else {
        [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
      }
      return {
        elementName,
        attributeName,
        attributeType,
        defaultValue,
        index: i
      };
    }
  };
  var skipWhitespace = (data, index) => {
    while (index < data.length && /\s/.test(data[index])) {
      index++;
    }
    return index;
  };
  function hasSeq(data, seq, i) {
    for (let j2 = 0; j2 < seq.length; j2++) {
      if (seq[j2] !== data[i + j2 + 1]) return false;
    }
    return true;
  }
  function validateEntityName2(name, xmlVersion) {
    if (qName(name, { xmlVersion }))
      return name;
    else
      throw new Error(`Invalid entity name ${name}`);
  }

  // web/node_modules/anynum/digitTable.js
  var SCRIPT_ZEROS = [
    // Basic Latin (ASCII) — included for completeness / pass-through
    48,
    // 0-9
    // Arabic scripts
    1632,
    // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
    1776,
    // Extended Arabic-Indic (Urdu/Persian/Sindhi) ۰۱۲۳
    // Indic scripts
    2406,
    // Devanagari ०१२३४५६७८९
    2534,
    // Bengali ০১২৩৪৫৬৭৮৯
    2662,
    // Gurmukhi ੦੧੨੩੪੫੬੭੮੯
    2790,
    // Gujarati ૦૧૨૩૪૫૬૭૮૯
    2918,
    // Odia ୦୧୨୩୪୫୬୭୮୯
    3046,
    // Tamil ௦௧௨௩௪௫௬௭௮௯
    3174,
    // Telugu ౦౧౨౩౪౫౬౭౮౯
    3302,
    // Kannada ೦೧೨೩೪೫೬೭೮೯
    3430,
    // Malayalam ൦൧൨൩൪൫൬൭൮൯
    3558,
    // Sinhala Archaic ෦෧෨෩෪෫෬෭෮෯
    // Southeast Asian scripts
    3664,
    // Thai ๐๑๒๓๔๕๖๗๘๙
    3792,
    // Lao ໐໑໒໓໔໕໖໗໘໙
    3872,
    // Tibetan ༠༡༢༣༤༥༦༧༨༩
    4160,
    // Myanmar ၀၁၂၃၄၅၆၇၈၉
    4240,
    // Myanmar Shan ႐႑႒႓႔႕႖႗႘႙
    6112,
    // Khmer ០១២៣៤៥៦៧៨៩
    6160,
    // Mongolian ᠐᠑᠒᠓᠔᠕᠖᠗᠘᠙
    6470,
    // Limbu ᥆᥇᥈᥉᥊᥋᥌᥍᥎᥏
    6608,
    // New Tai Lue ᧐᧑᧒᧓᧔᧕᧖᧗᧘᧙
    6784,
    // Tai Tham Hora ᪀᪁᪂᪃᪄᪅᪆᪇᪈᪉
    6800,
    // Tai Tham Tham ᪐᪑᪒᪓᪔᪕᪖᪗᪘᪙
    6992,
    // Balinese ᭐᭑᭒᭓᭔᭕᭖᭗᭘᭙
    7088,
    // Sundanese ᮰᮱᮲᮳᮴᮵᮶᮷᮸᮹
    7232,
    // Lepcha ᱀᱁᱂᱃᱄᱅᱆᱇᱈᱉
    7248,
    // Ol Chiki ᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙
    // Fullwidth (CJK context)
    65296,
    // Fullwidth ０１２３４５６７８９
    // Mathematical digit variants (Unicode math block)
    120782,
    // Mathematical Bold
    120792,
    // Mathematical Double-Struck
    120802,
    // Mathematical Sans-Serif
    120812,
    // Mathematical Sans-Serif Bold
    120822,
    // Mathematical Monospace
    // Other scripts
    66720,
    // Osmanya 𐒠𐒡𐒢𐒣𐒤𐒥𐒦𐒧𐒨𐒩
    68912,
    // Hanifi Rohingya 𐴰𐴱𐴲𐴳𐴴𐴵𐴶𐴷𐴸𐴹
    69734,
    // Brahmi 𑁦𑁧𑁨𑁩𑁪𑁫𑁬𑁭𑁮𑁯
    69872,
    // Sora Sompeng 𑃰𑃱𑃲𑃳𑃴𑃵𑃶𑃷𑃸𑃹
    69942,
    // Chakma 𑄶𑄷𑄸𑄹𑄺𑄻𑄼𑄽𑄾𑄿
    70096,
    // Sharada 𑇐𑇑𑇒𑇓𑇔𑇕𑇖𑇗𑇘𑇙
    70384,
    // Khudawadi 𑋰𑋱𑋲𑋳𑋴𑋵𑋶𑋷𑋸𑋹
    70736,
    // Newa 𑑐𑑑𑑒𑑓𑑔𑑕𑑖𑑗𑑘𑑙
    70864,
    // Tirhuta 𑓐𑓑𑓒𑓓𑓔𑓕𑓖𑓗𑓘𑓙
    71248,
    // Modi 𑙐𑙑𑙒𑙓𑙔𑙕𑙖𑙗𑙘𑙙
    71360,
    // Takri 𑛀𑛁𑛂𑛃𑛄𑛅𑛆𑛇𑛈𑛉
    71472,
    // Ahom 𑜰𑜱𑜲𑜳𑜴𑜵𑜶𑜷𑜸𑜹
    71904,
    // Warang Citi 𑣠𑣡𑣢𑣣𑣤𑣥𑣦𑣧𑣨𑣩
    72016,
    // Dives Akuru 𑥐𑥑𑥒𑥓𑥔𑥕𑥖𑥗𑥘𑥙
    72688,
    // Khitan Small Script 𑯰𑯱𑯲𑯳𑯴𑯵𑯶𑯷𑯸𑯹
    72784,
    // Bhaiksuki 𑱐𑱑𑱒𑱓𑱔𑱕𑱖𑱗𑱘𑱙
    73040,
    // Masaram Gondi 𑵐𑵑𑵒𑵓𑵔𑵕𑵖𑵗𑵘𑵙
    73120,
    // Gunjala Gondi 𑶠𑶡𑶢𑶣𑶤𑶥𑶦𑶧𑶨𑶩
    73552,
    // Kawi 𑽐𑽑𑽒𑽓𑽔𑽕𑽖𑽗𑽘𑽙
    92768,
    // Mro 𖩠𖩡𖩢𖩣𖩤𖩥𖩦𖩧𖩨𖩩
    92864,
    // Tangsa 𖫀𖫁𖫂𖫃𖫄𖫅𖫆𖫇𖫈𖫉
    93008,
    // Pahawh Hmong 𖭐𖭑𖭒𖭓𖭔𖭕𖭖𖭗𖭘𖭙
    123200,
    // Nyiakeng Puachue Hmong 𞅀𞅁𞅂𞅃𞅄𞅅𞅆𞅇𞅈𞅉
    123632,
    // Wancho 𞋰𞋱𞋲𞋳𞋴𞋵𞋶𞋷𞋸𞋹
    124144,
    // Nag Mundari 𞓰𞓱𞓲𞓳𞓴𞓵𞓶𞓷𞓸𞓹
    125264,
    // Adlam 𞥐𞥑𞥒𞥓𞥔𞥕𞥖𞥗𞥘𞥙
    130032
    // Segmented digit symbols 🯰🯱🯲🯳🯴🯵🯶🯷🯸🯹
  ];
  var NOT_DIGIT = 255;
  var HIGH_MAP = /* @__PURE__ */ new Map();
  var LOW_MAX = 65535;
  var LOW_MIN = 1632;
  var TABLE_OFFSET = LOW_MIN;
  var TABLE_SIZE = LOW_MAX - LOW_MIN + 1;
  var TABLE = new Uint8Array(TABLE_SIZE).fill(NOT_DIGIT);
  for (const zero of SCRIPT_ZEROS) {
    for (let d2 = 0; d2 < 10; d2++) {
      const cp = zero + d2;
      if (cp <= LOW_MAX) {
        TABLE[cp - TABLE_OFFSET] = d2;
      } else {
        HIGH_MAP.set(cp, d2);
      }
    }
  }

  // web/node_modules/anynum/anynum.js
  var CHAR_0 = 48;
  var CHAR_9 = 57;
  var CHAR_MINUS = 45;
  var MINUS_SET = /* @__PURE__ */ new Set([8722, 65293, 65123]);
  function anynum(str) {
    if (typeof str !== "string") return str;
    const len = str.length;
    if (len === 0) return str;
    let firstHit = -1;
    for (let i = 0; i < len; i++) {
      const cc = str.charCodeAt(i);
      if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) continue;
      if (cc < TABLE_OFFSET) {
        if (MINUS_SET.has(cc)) {
          firstHit = i;
          break;
        }
        continue;
      }
      if (cc >= 55296 && cc <= 56319) {
        if (i + 1 < len) {
          const low = str.charCodeAt(i + 1);
          if (low >= 56320 && low <= 57343) {
            const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
            if (HIGH_MAP.has(cp)) {
              firstHit = i;
              break;
            }
          }
        }
        continue;
      }
      if (TABLE[cc - TABLE_OFFSET] !== NOT_DIGIT || MINUS_SET.has(cc)) {
        firstHit = i;
        break;
      }
    }
    if (firstHit === -1) return str;
    const chars = [];
    if (firstHit > 0) chars.push(str.slice(0, firstHit));
    for (let i = firstHit; i < len; i++) {
      const cc = str.charCodeAt(i);
      if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) {
        chars.push(str[i]);
        continue;
      }
      if (cc < TABLE_OFFSET) {
        chars.push(MINUS_SET.has(cc) ? "-" : str[i]);
        continue;
      }
      if (cc >= 55296 && cc <= 56319) {
        if (i + 1 < len) {
          const low = str.charCodeAt(i + 1);
          if (low >= 56320 && low <= 57343) {
            const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
            const d3 = HIGH_MAP.get(cp);
            if (d3 !== void 0) {
              chars.push(String.fromCharCode(d3 + 48));
              i++;
              continue;
            }
          }
        }
        chars.push(str[i]);
        continue;
      }
      if (MINUS_SET.has(cc)) {
        chars.push("-");
        continue;
      }
      const d2 = TABLE[cc - TABLE_OFFSET];
      chars.push(d2 !== NOT_DIGIT ? String.fromCharCode(d2 + 48) : str[i]);
    }
    return chars.join("");
  }
  var anynum_default = anynum;

  // web/node_modules/strnum/strnum.js
  var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
  var binRegex = /^0b[01]+$/;
  var octRegex = /^0o[0-7]+$/;
  var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
  var consider = {
    hex: true,
    binary: false,
    octal: false,
    leadingZeros: true,
    decimalPoint: ".",
    eNotation: true,
    //skipLike: /regex/,
    infinity: "original",
    // "null", "infinity" (Infinity type), "string" ("Infinity" (the string literal))
    unicode: false
  };
  function toNumber(str, options = {}) {
    options = Object.assign({}, consider, options);
    if (!str || typeof str !== "string") return str;
    let trimmedStr = str.trim();
    if (trimmedStr.length === 0) return str;
    else if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
    else if (trimmedStr === "0") return 0;
    if (options.unicode) {
      trimmedStr = anynum_default(trimmedStr);
      if (trimmedStr === "0") return 0;
    }
    if (options.hex && hexRegex.test(trimmedStr)) {
      return parse_int(trimmedStr, 16);
    } else if (options.binary && binRegex.test(trimmedStr)) {
      return parse_int(trimmedStr, 2);
    } else if (options.octal && octRegex.test(trimmedStr)) {
      return parse_int(trimmedStr, 8);
    } else if (!isFinite(trimmedStr)) {
      return handleInfinity(str, Number(trimmedStr), options);
    } else if (trimmedStr.includes("e") || trimmedStr.includes("E")) {
      return resolveEnotation(str, trimmedStr, options);
    } else {
      const match = numRegex.exec(trimmedStr);
      if (match) {
        const sign = match[1] || "";
        const leadingZeros = match[2];
        let numTrimmedByZeros = trimZeros(match[3]);
        const decimalAdjacentToLeadingZeros = sign ? (
          // 0., -00., 000.
          str[leadingZeros.length + 1] === "."
        ) : str[leadingZeros.length] === ".";
        if (!options.leadingZeros && (leadingZeros.length > 1 || leadingZeros.length === 1 && !decimalAdjacentToLeadingZeros)) {
          return str;
        } else {
          const num = Number(trimmedStr);
          const parsedStr = String(num);
          if (num === 0) return num;
          if (parsedStr.search(/[eE]/) !== -1) {
            if (options.eNotation) return num;
            else return str;
          } else if (trimmedStr.indexOf(".") !== -1) {
            if (parsedStr === "0") return num;
            else if (parsedStr === numTrimmedByZeros) return num;
            else if (parsedStr === `${sign}${numTrimmedByZeros}`) return num;
            else return str;
          }
          let n2 = leadingZeros ? numTrimmedByZeros : trimmedStr;
          if (leadingZeros) {
            return n2 === parsedStr || sign + n2 === parsedStr ? num : str;
          } else {
            return n2 === parsedStr || n2 === sign + parsedStr ? num : str;
          }
        }
      } else {
        return str;
      }
    }
  }
  var eNotationRegx = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
  function resolveEnotation(str, trimmedStr, options) {
    if (!options.eNotation) return str;
    const notation = trimmedStr.match(eNotationRegx);
    if (notation) {
      let sign = notation[1] || "";
      const eChar = notation[3].indexOf("e") === -1 ? "E" : "e";
      const leadingZeros = notation[2];
      const eAdjacentToLeadingZeros = sign ? (
        // 0E.
        str[leadingZeros.length + 1] === eChar
      ) : str[leadingZeros.length] === eChar;
      if (leadingZeros.length > 1 && eAdjacentToLeadingZeros) return str;
      else if (leadingZeros.length === 1 && (notation[3].startsWith(`.${eChar}`) || notation[3][0] === eChar)) {
        return Number(trimmedStr);
      } else if (leadingZeros.length > 0) {
        if (options.leadingZeros && !eAdjacentToLeadingZeros) {
          trimmedStr = (notation[1] || "") + notation[3];
          return Number(trimmedStr);
        } else return str;
      } else {
        return Number(trimmedStr);
      }
    } else {
      return str;
    }
  }
  function trimZeros(numStr) {
    if (numStr && numStr.indexOf(".") !== -1) {
      let end = numStr.length;
      while (end > 0 && numStr.charCodeAt(end - 1) === 48) end--;
      numStr = numStr.slice(0, end);
      if (numStr === ".") numStr = "0";
      else if (numStr[0] === ".") numStr = "0" + numStr;
      else if (numStr[numStr.length - 1] === ".") numStr = numStr.substring(0, numStr.length - 1);
      return numStr;
    }
    return numStr;
  }
  function parse_int(numStr, base) {
    const str = numStr.trim();
    if (base === 2 || base === 8) numStr = str.substring(2);
    if (parseInt) return parseInt(numStr, base);
    else if (Number.parseInt) return Number.parseInt(numStr, base);
    else if (window && window.parseInt) return window.parseInt(numStr, base);
    else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
  }
  function handleInfinity(str, num, options) {
    const isPositive = num === Infinity;
    switch (options.infinity.toLowerCase()) {
      case "null":
        return null;
      case "infinity":
        return num;
      // Return Infinity or -Infinity
      case "string":
        return isPositive ? "Infinity" : "-Infinity";
      case "original":
      default:
        return str;
    }
  }

  // web/node_modules/fast-xml-parser/src/ignoreAttributes.js
  function getIgnoreAttributesFn(ignoreAttributes) {
    if (typeof ignoreAttributes === "function") {
      return ignoreAttributes;
    }
    if (Array.isArray(ignoreAttributes)) {
      return (attrName) => {
        for (const pattern of ignoreAttributes) {
          if (typeof pattern === "string" && attrName === pattern) {
            return true;
          }
          if (pattern instanceof RegExp && pattern.test(attrName)) {
            return true;
          }
        }
      };
    }
    return () => false;
  }

  // web/node_modules/path-expression-matcher/src/Expression.js
  var Expression = class {
    /**
     * Create a new Expression
     * @param {string} pattern - Pattern string (e.g., "root.users.user", "..user[id]")
     * @param {Object} options - Configuration options
     * @param {string} options.separator - Path separator (default: '.')
     */
    constructor(pattern, options = {}, data) {
      this.pattern = pattern;
      this.separator = options.separator || ".";
      this.segments = this._parse(pattern);
      this.data = data;
      this._hasDeepWildcard = this.segments.some((seg) => seg.type === "deep-wildcard");
      this._hasAttributeCondition = this.segments.some((seg) => seg.attrName !== void 0);
      this._hasPositionSelector = this.segments.some((seg) => seg.position !== void 0);
    }
    /**
     * Parse pattern string into segments
     * @private
     * @param {string} pattern - Pattern to parse
     * @returns {Array} Array of segment objects
     */
    _parse(pattern) {
      const segments = [];
      let i = 0;
      let currentPart = "";
      while (i < pattern.length) {
        if (pattern[i] === this.separator) {
          if (i + 1 < pattern.length && pattern[i + 1] === this.separator) {
            if (currentPart.trim()) {
              segments.push(this._parseSegment(currentPart.trim()));
              currentPart = "";
            }
            segments.push({ type: "deep-wildcard" });
            i += 2;
          } else {
            if (currentPart.trim()) {
              segments.push(this._parseSegment(currentPart.trim()));
            }
            currentPart = "";
            i++;
          }
        } else {
          currentPart += pattern[i];
          i++;
        }
      }
      if (currentPart.trim()) {
        segments.push(this._parseSegment(currentPart.trim()));
      }
      return segments;
    }
    /**
     * Parse a single segment
     * @private
     * @param {string} part - Segment string (e.g., "user", "ns::user", "user[id]", "ns::user:first")
     * @returns {Object} Segment object
     */
    _parseSegment(part) {
      const segment = { type: "tag" };
      let bracketContent = null;
      let withoutBrackets = part;
      const bracketMatch = part.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
      if (bracketMatch) {
        withoutBrackets = bracketMatch[1] + bracketMatch[3];
        if (bracketMatch[2]) {
          const content = bracketMatch[2].slice(1, -1);
          if (content) {
            bracketContent = content;
          }
        }
      }
      let namespace = void 0;
      let tagAndPosition = withoutBrackets;
      if (withoutBrackets.includes("::")) {
        const nsIndex = withoutBrackets.indexOf("::");
        namespace = withoutBrackets.substring(0, nsIndex).trim();
        tagAndPosition = withoutBrackets.substring(nsIndex + 2).trim();
        if (!namespace) {
          throw new Error(`Invalid namespace in pattern: ${part}`);
        }
      }
      let tag = void 0;
      let positionMatch = null;
      if (tagAndPosition.includes(":")) {
        const colonIndex = tagAndPosition.lastIndexOf(":");
        const tagPart = tagAndPosition.substring(0, colonIndex).trim();
        const posPart = tagAndPosition.substring(colonIndex + 1).trim();
        const isPositionKeyword = ["first", "last", "odd", "even"].includes(posPart) || /^nth\(\d+\)$/.test(posPart);
        if (isPositionKeyword) {
          tag = tagPart;
          positionMatch = posPart;
        } else {
          tag = tagAndPosition;
        }
      } else {
        tag = tagAndPosition;
      }
      if (!tag) {
        throw new Error(`Invalid segment pattern: ${part}`);
      }
      segment.tag = tag;
      if (namespace) {
        segment.namespace = namespace;
      }
      if (bracketContent) {
        if (bracketContent.includes("=")) {
          const eqIndex = bracketContent.indexOf("=");
          segment.attrName = bracketContent.substring(0, eqIndex).trim();
          segment.attrValue = bracketContent.substring(eqIndex + 1).trim();
        } else {
          segment.attrName = bracketContent.trim();
        }
      }
      if (positionMatch) {
        const nthMatch = positionMatch.match(/^nth\((\d+)\)$/);
        if (nthMatch) {
          segment.position = "nth";
          segment.positionValue = parseInt(nthMatch[1], 10);
        } else {
          segment.position = positionMatch;
        }
      }
      return segment;
    }
    /**
     * Get the number of segments
     * @returns {number}
     */
    get length() {
      return this.segments.length;
    }
    /**
     * Check if expression contains deep wildcard
     * @returns {boolean}
     */
    hasDeepWildcard() {
      return this._hasDeepWildcard;
    }
    /**
     * Check if expression has attribute conditions
     * @returns {boolean}
     */
    hasAttributeCondition() {
      return this._hasAttributeCondition;
    }
    /**
     * Check if expression has position selectors
     * @returns {boolean}
     */
    hasPositionSelector() {
      return this._hasPositionSelector;
    }
    /**
     * Get string representation
     * @returns {string}
     */
    toString() {
      return this.pattern;
    }
  };

  // web/node_modules/path-expression-matcher/src/ExpressionSet.js
  var ExpressionSet = class {
    constructor() {
      this._byDepthAndTag = /* @__PURE__ */ new Map();
      this._wildcardByDepth = /* @__PURE__ */ new Map();
      this._deepWildcards = [];
      this._deepByTerminalTag = /* @__PURE__ */ new Map();
      this._patterns = /* @__PURE__ */ new Set();
      this._sealed = false;
    }
    /**
     * Add an Expression to the set.
     * Duplicate patterns (same pattern string) are silently ignored.
     *
     * @param {import('./Expression.js').default} expression - A pre-constructed Expression instance
     * @returns {this} for chaining
     * @throws {TypeError} if called after seal()
     *
     * @example
     * set.add(new Expression('root.users.user'));
     * set.add(new Expression('..script'));
     */
    add(expression) {
      if (this._sealed) {
        throw new TypeError(
          "ExpressionSet is sealed. Create a new ExpressionSet to add more expressions."
        );
      }
      if (this._patterns.has(expression.pattern)) return this;
      this._patterns.add(expression.pattern);
      if (expression.hasDeepWildcard()) {
        const lastSeg2 = expression.segments[expression.segments.length - 1];
        if (lastSeg2 && lastSeg2.type !== "deep-wildcard" && lastSeg2.tag !== "*") {
          const tag2 = lastSeg2.tag;
          if (!this._deepByTerminalTag.has(tag2)) this._deepByTerminalTag.set(tag2, []);
          this._deepByTerminalTag.get(tag2).push(expression);
        } else {
          this._deepWildcards.push(expression);
        }
        return this;
      }
      const depth = expression.length;
      const lastSeg = expression.segments[expression.segments.length - 1];
      const tag = lastSeg?.tag;
      if (!tag || tag === "*") {
        if (!this._wildcardByDepth.has(depth)) this._wildcardByDepth.set(depth, []);
        this._wildcardByDepth.get(depth).push(expression);
      } else {
        const key = `${depth}:${tag}`;
        if (!this._byDepthAndTag.has(key)) this._byDepthAndTag.set(key, []);
        this._byDepthAndTag.get(key).push(expression);
      }
      return this;
    }
    /**
     * Add multiple expressions at once.
     *
     * @param {import('./Expression.js').default[]} expressions - Array of Expression instances
     * @returns {this} for chaining
     *
     * @example
     * set.addAll([
     *   new Expression('root.users.user'),
     *   new Expression('root.config.setting'),
     * ]);
     */
    addAll(expressions) {
      for (const expr of expressions) this.add(expr);
      return this;
    }
    /**
     * Check whether a pattern string is already present in the set.
     *
     * @param {import('./Expression.js').default} expression
     * @returns {boolean}
     */
    has(expression) {
      return this._patterns.has(expression.pattern);
    }
    /**
     * Number of expressions in the set.
     * @type {number}
     */
    get size() {
      return this._patterns.size;
    }
    /**
     * Seal the set against further modifications.
     * Useful to prevent accidental mutations after config is built.
     * Calling add() or addAll() on a sealed set throws a TypeError.
     *
     * @returns {this}
     */
    seal() {
      this._sealed = true;
      return this;
    }
    /**
     * Whether the set has been sealed.
     * @type {boolean}
     */
    get isSealed() {
      return this._sealed;
    }
    /**
     * Test whether the matcher's current path matches any expression in the set.
     *
     * Evaluation order (cheapest → most expensive):
     *  1. Exact depth + tag bucket  — O(1) lookup, typically 0–2 expressions
     *  2. Depth-only wildcard bucket — O(1) lookup, rare
     *  3. Deep-wildcard list         — always checked, but usually small
     *
     * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
     * @returns {boolean} true if any expression matches the current path
     *
     * @example
     * if (stopNodes.matchesAny(matcher)) {
     *   // handle stop node
     * }
     */
    matchesAny(matcher) {
      return this.findMatch(matcher) !== null;
    }
    /**
    * Find and return the first Expression that matches the matcher's current path.
    *
    * Uses the same evaluation order as matchesAny (cheapest → most expensive):
    *  1. Exact depth + tag bucket
    *  2. Depth-only wildcard bucket
    *  3. Deep-wildcard list
    *
    * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
    * @returns {import('./Expression.js').default | null} the first matching Expression, or null
    *
    * @example
    * const expr = stopNodes.findMatch(matcher);
    * if (expr) {
    *   // access expr.config, expr.pattern, etc.
    * }
    */
    findMatch(matcher) {
      const depth = matcher.getDepth();
      const tag = matcher.getCurrentTag();
      const exactKey = `${depth}:${tag}`;
      const exactBucket = this._byDepthAndTag.get(exactKey);
      if (exactBucket) {
        for (let i = 0; i < exactBucket.length; i++) {
          if (matcher.matches(exactBucket[i])) return exactBucket[i];
        }
      }
      const wildcardBucket = this._wildcardByDepth.get(depth);
      if (wildcardBucket) {
        for (let i = 0; i < wildcardBucket.length; i++) {
          if (matcher.matches(wildcardBucket[i])) return wildcardBucket[i];
        }
      }
      const deepBucket = this._deepByTerminalTag.get(tag);
      if (deepBucket) {
        for (let i = 0; i < deepBucket.length; i++) {
          if (matcher.matches(deepBucket[i])) return deepBucket[i];
        }
      }
      for (let i = 0; i < this._deepWildcards.length; i++) {
        if (matcher.matches(this._deepWildcards[i])) return this._deepWildcards[i];
      }
      return null;
    }
  };

  // web/node_modules/path-expression-matcher/src/Matcher.js
  var MatcherView = class {
    /**
     * @param {Matcher} matcher - The parent Matcher instance to read from.
     */
    constructor(matcher) {
      this._matcher = matcher;
    }
    /**
     * Get the path separator used by the parent matcher.
     * @returns {string}
     */
    get separator() {
      return this._matcher.separator;
    }
    /**
     * Get current tag name.
     * @returns {string|undefined}
     */
    getCurrentTag() {
      const path = this._matcher.path;
      return path.length > 0 ? path[path.length - 1].tag : void 0;
    }
    /**
     * Get current namespace.
     * @returns {string|undefined}
     */
    getCurrentNamespace() {
      const path = this._matcher.path;
      return path.length > 0 ? path[path.length - 1].namespace : void 0;
    }
    /**
     * Get current node's attribute value.
     * @param {string} attrName
     * @returns {*}
     */
    getAttrValue(attrName) {
      const path = this._matcher.path;
      if (path.length === 0) return void 0;
      return path[path.length - 1].values?.[attrName];
    }
    /**
     * Check if current node has an attribute.
     * @param {string} attrName
     * @returns {boolean}
     */
    hasAttr(attrName) {
      const path = this._matcher.path;
      if (path.length === 0) return false;
      const current = path[path.length - 1];
      return current.values !== void 0 && attrName in current.values;
    }
    /**
     * Get the value of a "kept" attribute from the nearest ancestor (or
     * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
     * @param {string} attrName
     * @returns {*}
     */
    getAnyParentAttr(attrName) {
      return this._matcher.getAnyParentAttr(attrName);
    }
    /**
     * Check whether any ancestor (or the current node) kept the given
     * attribute via `push(tag, attrs, ns, { keep: [...] })`.
     * @param {string} attrName
     * @returns {boolean}
     */
    hasAnyParentAttr(attrName) {
      return this._matcher.hasAnyParentAttr(attrName);
    }
    /**
     * Get current node's sibling position (child index in parent).
     * @returns {number}
     */
    getPosition() {
      const path = this._matcher.path;
      if (path.length === 0) return -1;
      return path[path.length - 1].position ?? 0;
    }
    /**
     * Get current node's repeat counter (occurrence count of this tag name).
     * @returns {number}
     */
    getCounter() {
      const path = this._matcher.path;
      if (path.length === 0) return -1;
      return path[path.length - 1].counter ?? 0;
    }
    /**
     * Get current node's sibling index (alias for getPosition).
     * @returns {number}
     * @deprecated Use getPosition() or getCounter() instead
     */
    getIndex() {
      return this.getPosition();
    }
    /**
     * Get current path depth.
     * @returns {number}
     */
    getDepth() {
      return this._matcher.path.length;
    }
    /**
     * Get path as string.
     * @param {string} [separator] - Optional separator (uses default if not provided)
     * @param {boolean} [includeNamespace=true]
     * @returns {string}
     */
    toString(separator, includeNamespace = true) {
      return this._matcher.toString(separator, includeNamespace);
    }
    /**
     * Get path as array of tag names.
     * @returns {string[]}
     */
    toArray() {
      return this._matcher.path.map((n2) => n2.tag);
    }
    /**
     * Match current path against an Expression.
     * @param {Expression} expression
     * @returns {boolean}
     */
    matches(expression) {
      return this._matcher.matches(expression);
    }
    /**
     * Match any expression in the given set against the current path.
     * @param {ExpressionSet} exprSet
     * @returns {boolean}
     */
    matchesAny(exprSet) {
      return exprSet.matchesAny(this._matcher);
    }
  };
  var Matcher = class {
    /**
     * Create a new Matcher.
     * @param {Object} [options={}]
     * @param {string} [options.separator='.'] - Default path separator
     */
    constructor(options = {}) {
      this.separator = options.separator || ".";
      this.path = [];
      this.siblingStacks = [];
      this._pathStringCache = null;
      this._view = new MatcherView(this);
      this._keptAttrs = [];
    }
    /**
     * Push a new tag onto the path.
     * @param {string} tagName
     * @param {Object|null} [attrValues=null]
     * @param {string|null} [namespace=null]
     * @param {Object|null} [options=null]
     * @param {string[]} [options.keep] - Names of attributes (from attrValues)
     */
    push(tagName, attrValues = null, namespace = null, options = null) {
      this._pathStringCache = null;
      if (this.path.length > 0) {
        this.path[this.path.length - 1].values = void 0;
      }
      const currentLevel = this.path.length;
      let level = this.siblingStacks[currentLevel];
      if (!level) {
        level = { counts: /* @__PURE__ */ new Map(), total: 0 };
        this.siblingStacks[currentLevel] = level;
      }
      const siblingKey = namespace ? `${namespace}:${tagName}` : tagName;
      const counter = level.counts.get(siblingKey) || 0;
      const position = level.total;
      level.counts.set(siblingKey, counter + 1);
      level.total++;
      const node = {
        tag: tagName,
        position,
        counter
      };
      if (namespace !== null && namespace !== void 0) {
        node.namespace = namespace;
      }
      if (attrValues !== null && attrValues !== void 0) {
        node.values = attrValues;
      }
      this.path.push(node);
      const depth = this.path.length;
      const keep = options !== null ? options.keep : null;
      if (keep !== null && keep !== void 0 && keep.length > 0 && attrValues) {
        for (let i = 0; i < keep.length; i++) {
          const name = keep[i];
          if (attrValues[name] !== void 0) {
            this._keptAttrs.push({ depth, name, value: attrValues[name] });
          }
        }
      }
    }
    /**
     * Pop the last tag from the path.
     * @returns {Object|undefined} The popped node
     */
    pop() {
      if (this.path.length === 0) return void 0;
      this._pathStringCache = null;
      const node = this.path.pop();
      if (this.siblingStacks.length > this.path.length + 1) {
        this.siblingStacks.length = this.path.length + 1;
      }
      const poppedDepth = this.path.length + 1;
      while (this._keptAttrs.length > 0 && this._keptAttrs[this._keptAttrs.length - 1].depth >= poppedDepth) {
        this._keptAttrs.pop();
      }
      return node;
    }
    /**
     * Update current node's attribute values.
     * Useful when attributes are parsed after push.
     * @param {Object} attrValues
     */
    updateCurrent(attrValues) {
      if (this.path.length > 0) {
        const current = this.path[this.path.length - 1];
        if (attrValues !== null && attrValues !== void 0) {
          current.values = attrValues;
        }
      }
    }
    /**
     * Get current tag name.
     * @returns {string|undefined}
     */
    getCurrentTag() {
      return this.path.length > 0 ? this.path[this.path.length - 1].tag : void 0;
    }
    /**
     * Get current namespace.
     * @returns {string|undefined}
     */
    getCurrentNamespace() {
      return this.path.length > 0 ? this.path[this.path.length - 1].namespace : void 0;
    }
    /**
     * Get current node's attribute value.
     * @param {string} attrName
     * @returns {*}
     */
    getAttrValue(attrName) {
      if (this.path.length === 0) return void 0;
      return this.path[this.path.length - 1].values?.[attrName];
    }
    /**
     * Check if current node has an attribute.
     * @param {string} attrName
     * @returns {boolean}
     */
    hasAttr(attrName) {
      if (this.path.length === 0) return false;
      const current = this.path[this.path.length - 1];
      return current.values !== void 0 && attrName in current.values;
    }
    /**
     * Get the value of a "kept" attribute from the nearest ancestor (or
     * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
     * Unlike getAttrValue(), this works regardless of how deep the path has
     * gone since the attribute was pushed — but only for attribute names that
     * were explicitly marked with `keep` at push time. Cost is proportional to
     * the number of currently-kept attributes (typically 0-3), not path depth.
     * @param {string} attrName
     * @returns {*} the value, or undefined if no ancestor kept this attribute
     */
    getAnyParentAttr(attrName) {
      const kept = this._keptAttrs;
      for (let i = kept.length - 1; i >= 0; i--) {
        if (kept[i].name === attrName) return kept[i].value;
      }
      return void 0;
    }
    /**
     * Check whether any ancestor (or the current node) kept the given
     * attribute via `push(tag, attrs, ns, { keep: [...] })`.
     * @param {string} attrName
     * @returns {boolean}
     */
    hasAnyParentAttr(attrName) {
      const kept = this._keptAttrs;
      for (let i = kept.length - 1; i >= 0; i--) {
        if (kept[i].name === attrName) return true;
      }
      return false;
    }
    /**
     * Get current node's sibling position (child index in parent).
     * @returns {number}
     */
    getPosition() {
      if (this.path.length === 0) return -1;
      return this.path[this.path.length - 1].position ?? 0;
    }
    /**
     * Get current node's repeat counter (occurrence count of this tag name).
     * @returns {number}
     */
    getCounter() {
      if (this.path.length === 0) return -1;
      return this.path[this.path.length - 1].counter ?? 0;
    }
    /**
     * Get current node's sibling index (alias for getPosition).
     * @returns {number}
     * @deprecated Use getPosition() or getCounter() instead
     */
    getIndex() {
      return this.getPosition();
    }
    /**
     * Get current path depth.
     * @returns {number}
     */
    getDepth() {
      return this.path.length;
    }
    /**
     * Get path as string.
     * @param {string} [separator] - Optional separator (uses default if not provided)
     * @param {boolean} [includeNamespace=true]
     * @returns {string}
     */
    toString(separator, includeNamespace = true) {
      const sep2 = separator || this.separator;
      const isDefault = sep2 === this.separator && includeNamespace === true;
      if (isDefault) {
        if (this._pathStringCache !== null) {
          return this._pathStringCache;
        }
        const result = this.path.map(
          (n2) => n2.namespace ? `${n2.namespace}:${n2.tag}` : n2.tag
        ).join(sep2);
        this._pathStringCache = result;
        return result;
      }
      return this.path.map(
        (n2) => includeNamespace && n2.namespace ? `${n2.namespace}:${n2.tag}` : n2.tag
      ).join(sep2);
    }
    /**
     * Get path as array of tag names.
     * @returns {string[]}
     */
    toArray() {
      return this.path.map((n2) => n2.tag);
    }
    /**
     * Reset the path to empty.
     */
    reset() {
      this._pathStringCache = null;
      this.path = [];
      this.siblingStacks = [];
      this._keptAttrs = [];
    }
    /**
     * Match current path against an Expression.
     * @param {Expression} expression
     * @returns {boolean}
     */
    matches(expression) {
      const segments = expression.segments;
      if (segments.length === 0) {
        return false;
      }
      if (expression.hasDeepWildcard()) {
        return this._matchWithDeepWildcard(segments);
      }
      return this._matchSimple(segments);
    }
    /**
     * @private
     */
    _matchSimple(segments) {
      if (this.path.length !== segments.length) {
        return false;
      }
      for (let i = 0; i < segments.length; i++) {
        if (!this._matchSegment(segments[i], this.path[i], i === this.path.length - 1)) {
          return false;
        }
      }
      return true;
    }
    /**
     * @private
     */
    _matchWithDeepWildcard(segments) {
      let pathIdx = this.path.length - 1;
      let segIdx = segments.length - 1;
      while (segIdx >= 0 && pathIdx >= 0) {
        const segment = segments[segIdx];
        if (segment.type === "deep-wildcard") {
          segIdx--;
          if (segIdx < 0) {
            return true;
          }
          const nextSeg = segments[segIdx];
          let found = false;
          for (let i = pathIdx; i >= 0; i--) {
            if (this._matchSegment(nextSeg, this.path[i], i === this.path.length - 1)) {
              pathIdx = i - 1;
              segIdx--;
              found = true;
              break;
            }
          }
          if (!found) {
            return false;
          }
        } else {
          if (!this._matchSegment(segment, this.path[pathIdx], pathIdx === this.path.length - 1)) {
            return false;
          }
          pathIdx--;
          segIdx--;
        }
      }
      return segIdx < 0;
    }
    /**
     * @private
     */
    _matchSegment(segment, node, isCurrentNode) {
      if (segment.tag !== "*" && segment.tag !== node.tag) {
        return false;
      }
      if (segment.namespace !== void 0) {
        if (segment.namespace !== "*" && segment.namespace !== node.namespace) {
          return false;
        }
      }
      if (segment.attrName !== void 0) {
        if (!isCurrentNode) {
          return false;
        }
        if (!node.values || !(segment.attrName in node.values)) {
          return false;
        }
        if (segment.attrValue !== void 0) {
          if (String(node.values[segment.attrName]) !== String(segment.attrValue)) {
            return false;
          }
        }
      }
      if (segment.position !== void 0) {
        if (!isCurrentNode) {
          return false;
        }
        const counter = node.counter ?? 0;
        if (segment.position === "first" && counter !== 0) {
          return false;
        } else if (segment.position === "odd" && counter % 2 !== 1) {
          return false;
        } else if (segment.position === "even" && counter % 2 !== 0) {
          return false;
        } else if (segment.position === "nth" && counter !== segment.positionValue) {
          return false;
        }
      }
      return true;
    }
    /**
     * Match any expression in the given set against the current path.
     * @param {ExpressionSet} exprSet
     * @returns {boolean}
     */
    matchesAny(exprSet) {
      return exprSet.matchesAny(this);
    }
    /**
     * Create a snapshot of current state.
     * @returns {Object}
     */
    snapshot() {
      return {
        path: this.path.map((node) => ({ ...node })),
        siblingStacks: this.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level),
        keptAttrs: this._keptAttrs.map((entry) => ({ ...entry }))
      };
    }
    /**
     * Restore state from snapshot.
     * @param {Object} snapshot
     */
    restore(snapshot) {
      this._pathStringCache = null;
      this.path = snapshot.path.map((node) => ({ ...node }));
      this.siblingStacks = snapshot.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level);
      this._keptAttrs = (snapshot.keptAttrs || []).map((entry) => ({ ...entry }));
    }
    /**
     * Return the read-only {@link MatcherView} for this matcher.
     *
     * The same instance is returned on every call — no allocation occurs.
     * It always reflects the current parser state and is safe to pass to
     * user callbacks without risk of accidental mutation.
     *
     * @returns {MatcherView}
     *
     * @example
     * const view = matcher.readOnly();
     * // pass view to callbacks — it stays in sync automatically
     * view.matches(expr);       // ✓
     * view.getCurrentTag();     // ✓
     * // view.push(...)         // ✗ method does not exist — caught by TypeScript
     */
    readOnly() {
      return this._view;
    }
  };

  // web/node_modules/is-unsafe/src/contexts/html.js
  var HTML_PATTERNS = [
    {
      id: "html-script-open",
      description: "<script opening tag",
      pattern: /<script[\s>/]/i
    },
    {
      id: "html-script-close",
      description: "<\/script closing tag",
      pattern: /<\/script[\s>]/i
    },
    {
      id: "html-javascript-protocol",
      description: "javascript: URI scheme (with optional whitespace/encoding)",
      // Handles j&#x61;vascript:, j\u0061vascript:, and whitespace variants
      pattern: /j[\t\n\r ]*a[\t\n\r ]*v[\t\n\r ]*a[\t\n\r ]*s[\t\n\r ]*c[\t\n\r ]*r[\t\n\r ]*i[\t\n\r ]*p[\t\n\r ]*t[\t\n\r ]*:/i
    },
    {
      id: "html-vbscript-protocol",
      description: "vbscript: URI scheme",
      pattern: /vbscript[\t\n\r ]*:/i
    },
    {
      id: "html-data-html",
      description: "data:text/html URI \u2014 can execute scripts in browsers",
      pattern: /data[\t\n\r ]*:[\t\n\r ]*text\/html/i
    },
    {
      id: "html-data-xhtml",
      description: "data:application/xhtml+xml URI",
      pattern: /data[\t\n\r ]*:[\t\n\r ]*application\/xhtml/i
    },
    {
      id: "html-data-svg",
      description: "data:image/svg+xml URI \u2014 can execute scripts",
      pattern: /data[\t\n\r ]*:[\t\n\r ]*image\/svg\+xml/i
    },
    {
      id: "html-inline-event-handler",
      description: "Inline event handler attributes: onclick=, onerror=, onload=, etc.",
      // \bon ensures we match a word boundary so "phonetic=" is not caught
      pattern: /\bon\w{1,30}\s*=/i
    },
    {
      id: "html-entity-obfuscated-script",
      description: "HTML-entity-encoded <script (e.g. &#x3C;script or &lt;script)",
      // Entities include optional trailing semicolon: &#x3C; or &#x3C (both valid in HTML5)
      pattern: /(?:&#x0*3[Cc];?|&#0*60;?|&lt;)\s*script/i
    },
    {
      id: "html-entity-obfuscated-javascript",
      description: 'HTML-entity-encoded javascript: (partial \u2014 catches common &#106; or &#x6a; for "j")',
      pattern: /(?:&#x0*6[Aa];?|&#0*106;?)\s*(?:&#x0*61;?|a)[\s\S]{0,80}script\s*:/i
    },
    {
      id: "html-style-expression",
      description: "CSS expression() \u2014 IE-era code execution in style attributes",
      pattern: /style[\s\S]{0,20}expression\s*\(/i
    },
    {
      id: "html-object-embed",
      description: "<object or <embed tags that can load active content",
      pattern: /<(?:object|embed)[\s>/]/i
    },
    {
      id: "html-base-tag",
      description: "<base href= \u2014 can hijack all relative URLs on a page",
      pattern: /<base[\s>]/i
    },
    {
      id: "html-meta-refresh",
      description: '<meta http-equiv="refresh" \u2014 can redirect users',
      pattern: /<meta[\s\S]{0,40}http-equiv[\s\S]{0,20}refresh/i
    },
    {
      id: "html-srcdoc",
      description: "srcdoc= attribute on iframes \u2014 embeds HTML that can run scripts",
      pattern: /srcdoc\s*=/i
    },
    {
      id: "html-iframe",
      description: "<iframe tag",
      pattern: /<iframe[\s>/]/i
    },
    {
      id: "html-form",
      description: "<form tag \u2014 can be used for phishing / credential harvesting injection",
      pattern: /<form[\s>/]/i
    }
  ];
  var html_default = HTML_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/xml.js
  var XML_PATTERNS = [
    {
      id: "xml-cdata-injection",
      description: "CDATA section injection: <![CDATA[ breaks out of text node context",
      pattern: /<!\[CDATA\[/i
    },
    {
      id: "xml-cdata-close",
      description: "CDATA close sequence: ]]> can terminate an enclosing CDATA section",
      pattern: /\]\]>/
    },
    {
      id: "xml-processing-instruction",
      description: "XML processing instruction: <?xml-stylesheet or <?php etc.",
      pattern: /<\?(?:xml[\- ]|php|asp)/i
    },
    {
      id: "xml-doctype-injection",
      description: "DOCTYPE declaration embedded in content \u2014 can define entities",
      // Match <!DOCTYPE followed by end-of-string, whitespace, or [ (internal subset)
      pattern: /<!DOCTYPE(?:[\s[]|$)/i
    },
    {
      id: "xml-entity-system",
      description: "SYSTEM keyword \u2014 used in external entity declarations (XXE)",
      pattern: /\bSYSTEM\s+["']/i
    },
    {
      id: "xml-entity-public",
      description: "PUBLIC keyword \u2014 used in external entity declarations (XXE)",
      pattern: /\bPUBLIC\s+["']/i
    },
    {
      id: "xml-entity-declaration",
      description: "<!ENTITY declaration \u2014 defines entities, potential XXE or entity expansion",
      pattern: /<!ENTITY[\s%]/i
    },
    {
      id: "xml-billion-laughs",
      description: "Entity reference chaining / billion laughs: repeated &eX; style references",
      // Heuristic: 3+ consecutive entity refs suggests expansion attack
      pattern: /(?:&\w{1,20};){3,}/
    },
    {
      id: "xml-namespace-confusion",
      description: "xmlns: attribute injection \u2014 can redefine namespaces to confuse parsers",
      pattern: /\bxmlns\s*(?::\w{1,40})?\s*=/i
    },
    {
      id: "xml-comment-injection",
      description: "<!-- comment injection \u2014 can hide content from some parsers",
      pattern: /<!--/
    },
    {
      id: "xml-comment-close",
      description: "--> closes an enclosing XML comment",
      pattern: /-->/
    },
    {
      id: "xml-pi-close",
      description: "?> closes an enclosing processing instruction",
      pattern: /\?>/
    }
  ];
  var xml_default = XML_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/svg.js
  var SVG_PATTERNS = [
    {
      id: "svg-script-element",
      description: "<script element inside SVG executes JavaScript",
      pattern: /<script[\s>/]/i
    },
    {
      id: "svg-xlink-href-javascript",
      description: "xlink:href with javascript: \u2014 classic SVG XSS via <a> or <use>",
      pattern: /xlink\s*:\s*href\s*=\s*["']?\s*javascript\s*:/i
    },
    {
      id: "svg-href-javascript",
      description: "href= with javascript: in SVG context (<a>, <animate>, etc.)",
      pattern: /href\s*=\s*["']?\s*javascript\s*:/i
    },
    {
      id: "svg-foreignobject",
      description: "<foreignObject embeds HTML inside SVG \u2014 can execute scripts",
      pattern: /<foreignObject[\s>/]/i
    },
    {
      id: "svg-use-external",
      description: "<use xlink:href or href pointing to external resource (non-fragment URL)",
      // Match <use with href= where the value starts with a non-# character (external URL)
      // [\"'][^#] catches quoted values not starting with #; [^\"'#\s>] catches unquoted
      pattern: /<use[\s\S]{0,60}(?:xlink\s*:\s*)?href\s*=\s*(?:["'][^#]|[^"'#\s>])/i
    },
    {
      id: "svg-animate-href",
      description: '<animate attributeName="href" \u2014 can dynamically change href to javascript:',
      pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*href["']/i
    },
    {
      id: "svg-animate-xlinkhref",
      description: '<animate attributeName="xlink:href"',
      pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*xlink\s*:\s*href["']/i
    },
    {
      id: "svg-set-javascript",
      description: '<set to="javascript:..." \u2014 sets an attribute to a javascript: URI',
      pattern: /<set[\s\S]{0,80}to\s*=\s*["']?\s*javascript\s*:/i
    },
    {
      id: "svg-event-handler",
      description: "SVG-specific event handler attributes: onload=, onerror=, onactivate=, etc.",
      pattern: /\bon(?:load|error|activate|begin|end|repeat|focus|blur|click|mouse\w{1,20}|key\w{1,20})\s*=/i
    },
    {
      id: "svg-handler-generic",
      description: "Generic on* handler catch-all for SVG attributes",
      pattern: /\bon\w{1,30}\s*=/i
    },
    {
      id: "svg-filter-feimage",
      description: "<feImage href= \u2014 filter primitive that can load external resources",
      pattern: /<feImage[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=/i
    },
    {
      id: "svg-image-external",
      description: "<image xlink:href with http/https or javascript protocol",
      pattern: /<image[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=\s*["']?\s*(?:https?|javascript)\s*:/i
    },
    {
      id: "svg-style-javascript",
      description: "style= attribute containing javascript: (e.g. background:url(javascript:...))",
      pattern: /style\s*=[\s\S]{0,60}javascript\s*:/i
    }
  ];
  var svg_default = SVG_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/sql.js
  var SQL_PATTERNS = [
    {
      id: "sql-block-comment-open",
      description: "SQL block comment open: /* ... */ \u2014 unusual in legitimate user text",
      pattern: /\/\*/
    },
    {
      id: "sql-union-select",
      description: "UNION SELECT \u2014 most common SQL injection aggregation attack",
      pattern: /\bUNION\s{1,20}(?:ALL\s{1,20})?SELECT\b/i
    },
    {
      id: "sql-drop-table",
      description: "DROP TABLE \u2014 destructive DDL injection",
      pattern: /\bDROP\s{1,20}TABLE\b/i
    },
    {
      id: "sql-drop-database",
      description: "DROP DATABASE \u2014 destructive DDL injection",
      pattern: /\bDROP\s{1,20}DATABASE\b/i
    },
    {
      id: "sql-insert-into",
      description: "INSERT INTO \u2014 data injection",
      pattern: /\bINSERT\s{1,20}INTO\b/i
    },
    {
      id: "sql-delete-from",
      description: "DELETE FROM \u2014 data deletion injection",
      pattern: /\bDELETE\s{1,20}FROM\b/i
    },
    {
      id: "sql-update-set",
      description: "UPDATE ... SET \u2014 data modification injection",
      // Allows arbitrary content between UPDATE and SET (table name, alias, etc.)
      pattern: /\bUPDATE\b[\s\S]{1,60}\bSET\b/i
    },
    {
      id: "sql-exec-xp",
      description: "EXEC xp_ \u2014 MSSQL extended stored procedure execution",
      pattern: /\bEXEC(?:UTE)?\s{1,20}xp_/i
    },
    {
      id: "sql-tautology-string",
      description: `Classic string tautology: ' OR '1'='1 or " OR "1"="1"`,
      // Last quote is optional — injection may truncate it: ' OR '1'='1--
      pattern: /'\s{0,10}OR\s{0,10}'[^']{0,20}'\s*=\s*'[^']{0,20}/i
    },
    {
      id: "sql-tautology-numeric",
      description: "Numeric tautology: OR 1=1",
      pattern: /\bOR\s{1,10}1\s*=\s*1\b/i
    },
    {
      id: "sql-always-true-zero",
      description: "Numeric tautology: OR 0=0",
      pattern: /\bOR\s{1,10}0\s*=\s*0\b/i
    },
    {
      id: "sql-sleep-benchmark",
      description: "Time-based blind injection: SLEEP() or BENCHMARK()",
      pattern: /\b(?:SLEEP|BENCHMARK)\s*\(/i
    },
    {
      id: "sql-waitfor-delay",
      description: "MSSQL time-based blind injection: WAITFOR DELAY",
      pattern: /\bWAITFOR\s{1,20}DELAY\b/i
    },
    {
      id: "sql-char-function",
      description: "CHAR() function \u2014 used to obfuscate injected strings",
      pattern: /\bCHAR\s*\(\s*\d{1,3}/i
    },
    {
      id: "sql-information-schema",
      description: "INFORMATION_SCHEMA \u2014 reconnaissance query for table/column enumeration",
      pattern: /\bINFORMATION_SCHEMA\b/i
    }
  ];
  var sql_default = SQL_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/shell.js
  var SHELL_PATTERNS = [
    {
      id: "shell-path-traversal-unix",
      description: "Unix path traversal: ../  \u2014 climbing the directory tree",
      pattern: /\.\.\//
    },
    {
      id: "shell-path-traversal-windows",
      description: "Windows path traversal: ..\\ \u2014 climbing the directory tree",
      pattern: /\.\.\\/
    },
    {
      id: "shell-path-traversal-encoded",
      description: "URL-encoded path traversal: %2e%2e or %2f variants",
      pattern: /%2e%2e|%2f\.\.|\.\.%2f/i
    },
    {
      id: "shell-null-byte",
      description: "Null byte injection: \\x00 or %00 \u2014 truncates strings in C-backed functions",
      pattern: /\x00|%00/
    },
    {
      id: "shell-semicolon",
      description: "Semicolon command separator: cmd1; cmd2",
      pattern: /;/
    },
    {
      id: "shell-pipe",
      description: "Pipe operator: cmd1 | cmd2",
      pattern: /\|/
    },
    {
      id: "shell-and-operator",
      description: "AND operator: cmd1 && cmd2",
      pattern: /&&/
    },
    {
      id: "shell-or-operator",
      description: "OR operator: cmd1 || cmd2",
      pattern: /\|\|/
    },
    {
      id: "shell-backtick",
      description: "Backtick command substitution: `cmd`",
      pattern: /`/
    },
    {
      id: "shell-dollar-paren",
      description: "Dollar-paren command substitution: $(cmd)",
      pattern: /\$\(/
    },
    {
      id: "shell-dollar-brace",
      description: "Dollar-brace variable expansion: ${var} \u2014 can be abused for injection",
      pattern: /\$\{/
    },
    {
      id: "shell-redirect-out",
      description: "Output redirection: cmd > file or cmd >> file",
      pattern: />{1,2}/
    },
    {
      id: "shell-redirect-in",
      description: "Input redirection: cmd < file",
      pattern: /</
    },
    {
      id: "shell-newline-injection",
      description: "Newline injection: \\n or \\r \u2014 can inject new shell commands",
      pattern: /[\n\r]/
    },
    {
      id: "shell-glob-star",
      description: "Glob expansion: * or ? \u2014 can expand to unintended files",
      // Only flag when combined with path separators to reduce false positives
      pattern: /[/\\][*?]/
    },
    {
      id: "shell-absolute-root",
      description: "Absolute root path injection: string starting with / or \\ (Windows UNC)",
      pattern: /^(?:\/|\\\\)/
    },
    {
      id: "shell-windows-drive",
      description: "Windows drive letter path injection: C:\\ or D:/",
      pattern: /^[a-zA-Z]:[/\\]/
    },
    {
      id: "shell-curl-wget",
      description: "curl/wget with URL or flags \u2014 can exfiltrate data or download payloads",
      // Require a URL scheme (http/https/ftp) or a flag (-) to reduce false positives
      // "curl is a tool" won't match; "curl http://..." or "curl -s ..." will
      pattern: /\b(?:curl|wget)\s+(?:https?:\/\/|ftp:\/\/|-)/i
    }
  ];
  var shell_default = SHELL_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/redos.js
  var REDOS_PATTERNS = [
    {
      id: "redos-nested-quantifier-plus",
      description: "Nested + quantifier inside a group with outer quantifier: (a+)+, (.+b)*, etc.",
      // Matches any group containing a + quantifier, with an outer * or + — catches (a+)+, (.+b)*, etc.
      pattern: /\([^)]*\+[^)]*\)[+*]/
    },
    {
      id: "redos-nested-quantifier-star",
      description: "Nested * quantifier: (a*)* or (a*)+ \u2014 catastrophic backtracking",
      pattern: /\([^)]*\*[^)]*\)[*+]/
    },
    {
      id: "redos-nested-groups",
      description: "Doubly nested quantified groups: ((a+)+) \u2014 guaranteed catastrophic",
      pattern: /\(\([^)]{0,40}\)[+*]\)[+*]/
    },
    {
      id: "redos-alternation-overlap",
      description: "Overlapping alternation under quantifier: (a|a)+ \u2014 ambiguous NFA paths",
      // Detect repeated identical alternatives under a quantifier
      pattern: /\(([^|()]{1,20})\|(?:\1)(?:\|[^|()]{1,20}){0,5}\)[+*?]{1,2}/
    },
    {
      id: "redos-star-plus-concat",
      description: "(x*x)+ pattern \u2014 triggers super-linear backtracking",
      pattern: /\([^)]{0,10}\*[^)]{0,10}\)[+*]/
    },
    {
      id: "redos-dot-star-greedy",
      description: "(.*){n,} or (.+){n,} \u2014 repeated greedy dot quantifiers",
      pattern: /\(\.[*+]\)\{?\d/
    },
    {
      id: "redos-large-repetition",
      description: "Very large fixed or range repetition count {1000,} or {1000,n} \u2014 denial of service via backtracking",
      // Matches { followed by 4+ digits (≥1000), then optional ,digits }
      pattern: /\{\d{4,}(?:,\d*)?\}/
    },
    {
      id: "redos-catastrophic-alternation",
      description: "Long alternation with many similar branches \u2014 polynomial backtracking risk",
      // Heuristic: 10+ pipe-separated alternatives in a single group
      pattern: /\([^)]{0,200}(?:\|[^|)]{0,50}){9,}\)/
    }
  ];
  var redos_default = REDOS_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/nosql.js
  var sep = `["'\\s]*:`;
  var NOSQL_PATTERNS = [
    // ─── MongoDB $ operator injection ────────────────────────────────────────
    {
      id: "nosql-where-operator",
      description: "$where \u2014 executes arbitrary JavaScript server-side in MongoDB",
      pattern: new RegExp(`\\$where${sep}`, "i")
    },
    {
      id: "nosql-ne-operator",
      description: '$ne \u2014 "not equal" operator used to bypass equality checks',
      pattern: new RegExp(`\\$ne${sep}`, "i")
    },
    {
      id: "nosql-gt-operator",
      description: '$gt \u2014 "greater than" used to bypass password/value checks',
      pattern: new RegExp(`\\$gte?${sep}`, "i")
    },
    {
      id: "nosql-lt-operator",
      description: '$lt / $lte \u2014 "less than" bypass variants',
      pattern: new RegExp(`\\$lte?${sep}`, "i")
    },
    {
      id: "nosql-regex-operator",
      description: "$regex \u2014 can be used to extract data character by character (blind injection)",
      pattern: new RegExp(`\\$regex${sep}`, "i")
    },
    {
      id: "nosql-or-operator",
      description: "$or \u2014 logical OR; used to create always-true conditions",
      pattern: new RegExp(`\\$or${sep}\\s*\\[`, "i")
    },
    {
      id: "nosql-and-operator",
      description: "$and \u2014 logical AND operator injection",
      pattern: new RegExp(`\\$and${sep}\\s*\\[`, "i")
    },
    {
      id: "nosql-nor-operator",
      description: "$nor \u2014 logical NOR operator injection",
      pattern: new RegExp(`\\$nor${sep}\\s*\\[`, "i")
    },
    {
      id: "nosql-exists-operator",
      description: "$exists \u2014 can enumerate fields to determine schema",
      pattern: new RegExp(`\\$exists${sep}`, "i")
    },
    {
      id: "nosql-in-operator",
      description: "$in \u2014 matches any value in a list; can enumerate values",
      pattern: new RegExp(`\\$in${sep}\\s*\\[`, "i")
    },
    {
      id: "nosql-expr-operator",
      description: "$expr \u2014 allows aggregation expressions in queries (MongoDB 3.6+)",
      pattern: new RegExp(`\\$expr${sep}`, "i")
    },
    {
      id: "nosql-function-operator",
      description: "$function \u2014 executes arbitrary JavaScript in MongoDB 4.4+",
      pattern: new RegExp(`\\$function${sep}`, "i")
    },
    {
      id: "nosql-accumulator-operator",
      description: "$accumulator \u2014 custom aggregation with arbitrary JS execution",
      pattern: new RegExp(`\\$accumulator${sep}`, "i")
    },
    // ─── Prototype pollution ─────────────────────────────────────────────────
    {
      id: "nosql-proto-pollution",
      description: "__proto__ \u2014 prototype pollution via object key injection",
      pattern: /__proto__/
    },
    {
      id: "nosql-constructor-prototype",
      description: "constructor.prototype \u2014 alternative prototype pollution vector (dot notation or JSON key)",
      // Matches dot-notation (obj.constructor.prototype) and JSON key adjacency
      // ("constructor": {"prototype": ...})
      pattern: /constructor[\s"':.,{\[]*prototype/i
    },
    {
      id: "nosql-proto-bracket",
      description: '["__proto__"] \u2014 bracket-notation prototype pollution',
      pattern: /\[["']__proto__["']\]/
    }
  ];
  var nosql_default = NOSQL_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/log.js
  var LOG_PATTERNS = [
    // ─── CRLF / newline injection ─────────────────────────────────────────────
    {
      id: "log-crlf-injection",
      description: "CRLF injection: literal \\r or \\n embeds fake log lines",
      pattern: /[\r\n]/
    },
    {
      id: "log-url-encoded-crlf",
      description: "URL-encoded CRLF: %0d, %0a, %0D, %0A \u2014 decoded by some log parsers",
      pattern: /%0[dDaA]/
    },
    {
      id: "log-unicode-newline",
      description: "Unicode newline variants: U+2028 (line separator), U+2029 (paragraph separator)",
      pattern: /[\u2028\u2029]/
    },
    // ─── Log4Shell / JNDI injection (CVE-2021-44228) ─────────────────────────
    {
      id: "log-log4shell-jndi",
      description: "Log4Shell: ${jndi:...} triggers remote code execution in Apache Log4j",
      pattern: /\$\{jndi\s*:/i
    },
    {
      id: "log-log4shell-obfuscated",
      description: "Obfuscated Log4Shell: ${::-j}... lookup-bypass prefix used to evade WAF detection",
      // ${::- is the Log4j lookup-bypass escape sequence; presence alone is suspicious
      pattern: /\$\{::-/
    },
    {
      id: "log-log4j-lookup",
      description: "Log4j lookup syntax: ${env:...}, ${sys:...}, ${ctx:...} \u2014 data exfiltration",
      pattern: /\$\{(?:env|sys|ctx|main|map|sd|web|docker|k8s|spring)\s*:/i
    },
    // ─── Server-Side Template Injection (SSTI) in log messages ───────────────
    {
      id: "log-ssti-double-brace",
      description: "SSTI double-brace: {{expression}} \u2014 Jinja2, Twig, Handlebars, etc.",
      pattern: /\{\{[\s\S]{0,80}\}\}/
    },
    {
      id: "log-ssti-hash-brace",
      description: "SSTI hash-brace: #{expression} \u2014 Thymeleaf, Velocity, Ruby ERB",
      pattern: /#\{[\s\S]{0,80}\}/
    },
    {
      id: "log-ssti-dollar-brace",
      description: "SSTI/EL injection: ${expression with operators or method calls} \u2014 JSP EL, Freemarker, SpEL",
      // Require that the ${...} content looks like an expression, not a plain variable name.
      // Flags if the content contains: . ( * + operators, or known SSTI keywords.
      // This avoids flagging ${PATH}, ${HOME} etc. (plain shell variables).
      pattern: /\$\{[^}]*(?:\.|\(|\*|\+|\bclass\b|\bruntime\b|\bprocess\b|\bexec\b)[^}]{0,80}\}/i
    },
    {
      id: "log-ssti-percent-tag",
      description: "SSTI ERB/ASP tag: <%= expression %> \u2014 Ruby ERB, ASP",
      pattern: /<%=[\s\S]{0,80}%>/
    },
    // ─── Null byte ────────────────────────────────────────────────────────────
    {
      id: "log-null-byte",
      description: "Null byte: \\x00 or %00 \u2014 can truncate log entries in C-backed loggers",
      pattern: /\x00|%00/
    },
    // ─── ANSI escape injection ────────────────────────────────────────────────
    {
      id: "log-ansi-escape",
      description: "ANSI escape sequence: ESC[ \u2014 can manipulate terminal output when logs are tailed",
      pattern: /\x1b\[/
    }
  ];
  var log_default = LOG_PATTERNS;

  // web/node_modules/is-unsafe/src/contexts/sql-strict.js
  var SQL_STRICT_EXTRA = [
    {
      id: "sql-line-comment",
      description: "SQL line comment: -- followed by whitespace or end of string",
      pattern: /--(?:\s|$)/
    },
    {
      id: "sql-stacked-query",
      description: "Stacked queries: semicolon immediately followed by a SQL keyword",
      pattern: /;\s{0,10}(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b/i
    },
    {
      id: "sql-hex-encoding",
      description: "Hex-encoded string injection: 0x41414141 style (MySQL)",
      pattern: /\b0x[0-9a-f]{4,}/i
    }
  ];
  var SQL_STRICT_PATTERNS = [...sql_default, ...SQL_STRICT_EXTRA];
  var sql_strict_default = SQL_STRICT_PATTERNS;

  // web/node_modules/is-unsafe/src/index.js
  html_default.label = "HTML";
  xml_default.label = "XML";
  svg_default.label = "SVG";
  sql_default.label = "SQL";
  sql_strict_default.label = "SQL-STRICT";
  shell_default.label = "SHELL";
  redos_default.label = "REDOS";
  nosql_default.label = "NOSQL";
  log_default.label = "LOG";
  var VALID_CONTEXTS = Object.freeze({
    HTML: html_default,
    XML: xml_default,
    SVG: svg_default,
    SQL: sql_default,
    "SQL-STRICT": sql_strict_default,
    SHELL: shell_default,
    REDOS: redos_default,
    NOSQL: nosql_default,
    LOG: log_default
  });
  function assertString(value) {
    if (typeof value !== "string") {
      throw new TypeError(
        `is-unsafe: first argument must be a string, got ${typeof value}`
      );
    }
  }
  function assertContext(context) {
    if (context instanceof RegExp) return;
    if (Array.isArray(context)) {
      if (context.length === 0) {
        throw new TypeError("is-unsafe: context must not be an empty array");
      }
      if (Array.isArray(context[0])) {
        for (const list of context) {
          if (!Array.isArray(list) || list.length === 0) {
            throw new TypeError(
              "is-unsafe: each context in the array must be a non-empty pattern array (PatternList)"
            );
          }
        }
      }
      return;
    }
    throw new TypeError(
      `is-unsafe: second argument must be a PatternList (e.g. HTML), an array of PatternLists (e.g. [HTML, XML]), or a RegExp. Got: ${typeof context}`
    );
  }
  function normalise(context) {
    if (context instanceof RegExp) return { lists: null, regex: context };
    if (Array.isArray(context[0])) return { lists: context, regex: null };
    return { lists: [context], regex: null };
  }
  function matchList(value, list) {
    const label = list.label ?? "CUSTOM";
    for (const rule of list) {
      if (rule.pattern.test(value)) {
        return { context: label, id: rule.id, description: rule.description, pattern: rule.pattern };
      }
    }
    return null;
  }
  function isUnsafe(value, context) {
    assertString(value);
    assertContext(context);
    const { lists, regex } = normalise(context);
    if (regex) return regex.test(value);
    for (const list of lists) {
      if (matchList(value, list) !== null) return true;
    }
    return false;
  }

  // web/node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
  function extractRawAttributes(prefixedAttrs, options) {
    if (!prefixedAttrs) return {};
    const attrs = options.attributesGroupName ? prefixedAttrs[options.attributesGroupName] : prefixedAttrs;
    if (!attrs) return {};
    const rawAttrs = {};
    for (const key in attrs) {
      if (key.startsWith(options.attributeNamePrefix)) {
        const rawName = key.substring(options.attributeNamePrefix.length);
        rawAttrs[rawName] = attrs[key];
      } else {
        rawAttrs[key] = attrs[key];
      }
    }
    return rawAttrs;
  }
  function extractNamespace(rawTagName) {
    if (!rawTagName || typeof rawTagName !== "string") return void 0;
    const colonIndex = rawTagName.indexOf(":");
    if (colonIndex !== -1 && colonIndex > 0) {
      const ns = rawTagName.substring(0, colonIndex);
      if (ns !== "xmlns") {
        return ns;
      }
    }
    return void 0;
  }
  var OrderedObjParser = class {
    constructor(options, externalEntities) {
      this.options = options;
      this.currentNode = null;
      this.tagsNodeStack = [];
      this.parseXml = parseXml;
      this.parseTextData = parseTextData;
      this.resolveNameSpace = resolveNameSpace;
      this.buildAttributesMap = buildAttributesMap;
      this.isItStopNode = isItStopNode;
      this.replaceEntitiesValue = replaceEntitiesValue;
      this.readStopNodeData = readStopNodeData;
      this.saveTextToParentTag = saveTextToParentTag;
      this.addChild = addChild;
      this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
      this.entityExpansionCount = 0;
      this.currentExpandedLength = 0;
      this.doctypefound = false;
      let namedEntities = { ...XML };
      if (this.options.entityDecoder) {
        this.entityDecoder = this.options.entityDecoder;
      } else {
        if (typeof this.options.htmlEntities === "object") namedEntities = this.options.htmlEntities;
        else if (this.options.htmlEntities === true) namedEntities = { ...COMMON_HTML, ...CURRENCY };
        this.entityDecoder = new EntityDecoder({
          namedEntities: { ...namedEntities, ...externalEntities },
          numericAllowed: this.options.htmlEntities,
          limit: {
            maxTotalExpansions: this.options.processEntities.maxTotalExpansions,
            maxExpandedLength: this.options.processEntities.maxExpandedLength,
            applyLimitsTo: this.options.processEntities.appliesTo
          },
          // onExternalEntity: (name, value) => isUnsafe(value) ? 'block' : 'allow',
          onInputEntity: (name, value) => (
            //TODO: VALID_CONTEXTS.HTML should be set only if this.options.htmlEntities
            isUnsafe(value, [html_default, xml_default]) ? ENTITY_ACTION.BLOCK : ENTITY_ACTION.ALLOW
          )
          //postCheck: resolved => resolved
        });
      }
      this.matcher = new Matcher();
      this.readonlyMatcher = this.matcher.readOnly();
      this.isCurrentNodeStopNode = false;
      this.stopNodeExpressionsSet = new ExpressionSet();
      const stopNodesOpts = this.options.stopNodes;
      if (stopNodesOpts && stopNodesOpts.length > 0) {
        for (let i = 0; i < stopNodesOpts.length; i++) {
          const stopNodeExp = stopNodesOpts[i];
          if (typeof stopNodeExp === "string") {
            this.stopNodeExpressionsSet.add(new Expression(stopNodeExp));
          } else if (stopNodeExp instanceof Expression) {
            this.stopNodeExpressionsSet.add(stopNodeExp);
          }
        }
        this.stopNodeExpressionsSet.seal();
      }
    }
  };
  function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
    const options = this.options;
    if (val !== void 0) {
      if (options.trimValues && !dontTrim) {
        val = val.trim();
      }
      if (val.length > 0) {
        if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
        const jPathOrMatcher = options.jPath ? jPath.toString() : jPath;
        const newval = options.tagValueProcessor(tagName, val, jPathOrMatcher, hasAttributes, isLeafNode);
        if (newval === null || newval === void 0) {
          return val;
        } else if (typeof newval !== typeof val || newval !== val) {
          return newval;
        } else if (options.trimValues) {
          return parseValue(val, options.parseTagValue, options.numberParseOptions);
        } else {
          const trimmedVal = val.trim();
          if (trimmedVal === val) {
            return parseValue(val, options.parseTagValue, options.numberParseOptions);
          } else {
            return val;
          }
        }
      }
    }
  }
  function resolveNameSpace(tagname) {
    if (this.options.removeNSPrefix) {
      const tags = tagname.split(":");
      const prefix = tagname.charAt(0) === "/" ? "/" : "";
      if (tags[0] === "xmlns") {
        return "";
      }
      if (tags.length === 2) {
        tagname = prefix + tags[1];
      }
    }
    return tagname;
  }
  var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
  function buildAttributesMap(attrStr, jPath, tagName, force = false) {
    const options = this.options;
    if (force === true || options.ignoreAttributes !== true && typeof attrStr === "string") {
      const matches = getAllMatches(attrStr, attrsRegx);
      const len = matches.length;
      const attrs = {};
      const processedVals = new Array(len);
      let hasRawAttrs = false;
      const rawAttrsForMatcher = {};
      for (let i = 0; i < len; i++) {
        const attrName = this.resolveNameSpace(matches[i][1]);
        const oldVal = matches[i][4];
        if (attrName.length && oldVal !== void 0) {
          let val = oldVal;
          if (options.trimValues) val = val.trim();
          val = this.replaceEntitiesValue(val, tagName, this.readonlyMatcher);
          processedVals[i] = val;
          rawAttrsForMatcher[attrName] = val;
          hasRawAttrs = true;
        }
      }
      if (hasRawAttrs && typeof jPath === "object" && jPath.updateCurrent) {
        jPath.updateCurrent(rawAttrsForMatcher);
      }
      const jPathStr = options.jPath ? jPath.toString() : this.readonlyMatcher;
      let hasAttrs = false;
      for (let i = 0; i < len; i++) {
        const attrName = this.resolveNameSpace(matches[i][1]);
        if (this.ignoreAttributesFn(attrName, jPathStr)) continue;
        let aName = options.attributeNamePrefix + attrName;
        if (attrName.length) {
          if (options.transformAttributeName) {
            aName = options.transformAttributeName(aName);
          }
          aName = sanitizeName(aName, options);
          if (matches[i][4] !== void 0) {
            const oldVal = processedVals[i];
            const newVal = options.attributeValueProcessor(attrName, oldVal, jPathStr);
            if (newVal === null || newVal === void 0) {
              attrs[aName] = oldVal;
            } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
              attrs[aName] = newVal;
            } else {
              attrs[aName] = parseValue(oldVal, options.parseAttributeValue, options.numberParseOptions);
            }
            hasAttrs = true;
          } else if (options.allowBooleanAttributes) {
            attrs[aName] = true;
            hasAttrs = true;
          }
        }
      }
      if (!hasAttrs) return;
      if (options.attributesGroupName && !options.preserveOrder) {
        const attrCollection = {};
        attrCollection[options.attributesGroupName] = attrs;
        return attrCollection;
      }
      return attrs;
    }
  }
  var parseXml = function(xmlData) {
    xmlData = xmlData.replace(/\r\n?/g, "\n");
    const xmlObj = new XmlNode("!xml");
    let currentNode = xmlObj;
    let textData = "";
    this.matcher.reset();
    this.entityDecoder.reset();
    this.entityExpansionCount = 0;
    this.currentExpandedLength = 0;
    this.doctypefound = false;
    const options = this.options;
    const docTypeReader = new DocTypeReader(options.processEntities);
    const xmlLen = xmlData.length;
    for (let i = 0; i < xmlLen; i++) {
      const ch = xmlData[i];
      if (ch === "<") {
        const c1 = xmlData.charCodeAt(i + 1);
        if (c1 === 47) {
          const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
          let tagName = xmlData.substring(i + 2, closeIndex).trim();
          if (options.removeNSPrefix) {
            const colonIndex = tagName.indexOf(":");
            if (colonIndex !== -1) {
              tagName = tagName.substr(colonIndex + 1);
            }
          }
          tagName = transformTagName(options.transformTagName, tagName, "", options).tagName;
          if (currentNode) {
            textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
          }
          const lastTagName = this.matcher.getCurrentTag();
          if (tagName && options.unpairedTagsSet.has(tagName)) {
            throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
          }
          if (lastTagName && options.unpairedTagsSet.has(lastTagName)) {
            this.matcher.pop();
            this.tagsNodeStack.pop();
          }
          this.matcher.pop();
          this.isCurrentNodeStopNode = false;
          currentNode = this.tagsNodeStack.pop() || xmlObj;
          if (options.captureMetaData && currentNode) {
            currentNode.addEndIndex(closeIndex + 1);
          }
          textData = "";
          i = closeIndex;
        } else if (c1 === 63) {
          let tagData = readTagExp(xmlData, i, false, "?>");
          if (!tagData) throw new Error("Pi Tag is not closed.");
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
          const attsMap = this.buildAttributesMap(tagData.tagExp, this.matcher, tagData.tagName, true);
          if (attsMap) {
            const ver = attsMap[this.options.attributeNamePrefix + "version"];
            this.entityDecoder.setXmlVersion(Number(ver) || 1);
            docTypeReader.setXmlVersion(Number(ver) || 1);
          }
          if (options.ignoreDeclaration && tagData.tagName === "?xml" || options.ignorePiTags) {
          } else {
            const childNode = new XmlNode(tagData.tagName);
            childNode.add(options.textNodeName, "");
            if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent && options.ignoreAttributes !== true) {
              childNode[":@"] = attsMap;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, i);
            if (options.captureMetaData) {
              currentNode.addEndIndex(tagData.closeIndex + 2);
            }
          }
          i = tagData.closeIndex + 1;
        } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 45 && xmlData.charCodeAt(i + 3) === 45) {
          const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.");
          if (options.commentPropName) {
            const comment = xmlData.substring(i + 4, endIndex - 2);
            textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
            currentNode.add(options.commentPropName, [{ [options.textNodeName]: comment }]);
          }
          i = endIndex;
        } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 68) {
          if (this.doctypefound) throw new Error("Multiple DOCTYPE declarations found.");
          this.doctypefound = true;
          const result = docTypeReader.readDocType(xmlData, i);
          this.entityDecoder.addInputEntities(result.entities);
          i = result.i;
        } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 91) {
          const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
          const tagExp = xmlData.substring(i + 9, closeIndex);
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
          let val = this.parseTextData(tagExp, currentNode.tagname, this.readonlyMatcher, true, false, true, true);
          if (val == void 0) val = "";
          if (options.cdataPropName) {
            currentNode.add(options.cdataPropName, [{ [options.textNodeName]: tagExp }]);
          } else {
            currentNode.add(options.textNodeName, val);
          }
          i = closeIndex + 2;
        } else {
          let result = readTagExp(xmlData, i, options.removeNSPrefix);
          if (!result) {
            const context = xmlData.substring(Math.max(0, i - 50), Math.min(xmlLen, i + 50));
            throw new Error(`readTagExp returned undefined at position ${i}. Context: "${context}"`);
          }
          let tagName = result.tagName;
          const rawTagName = result.rawTagName;
          let tagExp = result.tagExp;
          let attrExpPresent = result.attrExpPresent;
          let closeIndex = result.closeIndex;
          ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
          if (options.strictReservedNames && (tagName === options.commentPropName || tagName === options.cdataPropName || tagName === options.textNodeName || tagName === options.attributesGroupName)) {
            throw new Error(`Invalid tag name: ${tagName}`);
          }
          if (currentNode && textData) {
            if (currentNode.tagname !== "!xml") {
              textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher, false);
            }
          }
          const lastTag = currentNode;
          if (lastTag && options.unpairedTagsSet.has(lastTag.tagname)) {
            currentNode = this.tagsNodeStack.pop();
            this.matcher.pop();
          }
          let isSelfClosing = false;
          if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
            isSelfClosing = true;
            if (tagName[tagName.length - 1] === "/") {
              tagName = tagName.substr(0, tagName.length - 1);
              tagExp = tagName;
            } else {
              tagExp = tagExp.substr(0, tagExp.length - 1);
            }
            attrExpPresent = tagName !== tagExp;
          }
          let prefixedAttrs = null;
          let rawAttrs = {};
          let namespace = void 0;
          namespace = extractNamespace(rawTagName);
          if (tagName !== xmlObj.tagname) {
            this.matcher.push(tagName, {}, namespace);
          }
          if (tagName !== tagExp && attrExpPresent) {
            prefixedAttrs = this.buildAttributesMap(tagExp, this.matcher, tagName);
            if (prefixedAttrs) {
              rawAttrs = extractRawAttributes(prefixedAttrs, options);
            }
          }
          if (tagName !== xmlObj.tagname) {
            this.isCurrentNodeStopNode = this.isItStopNode();
          }
          const startIndex = i;
          if (this.isCurrentNodeStopNode) {
            let tagContent = "";
            if (isSelfClosing) {
              i = result.closeIndex;
            } else if (options.unpairedTagsSet.has(tagName)) {
              i = result.closeIndex;
            } else {
              const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
              if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
              i = result2.i;
              tagContent = result2.tagContent;
            }
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            childNode.add(options.textNodeName, tagContent);
            this.matcher.pop();
            this.isCurrentNodeStopNode = false;
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            if (options.captureMetaData) {
              currentNode.addEndIndex(i + 1);
            }
          } else {
            if (isSelfClosing) {
              ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
              const childNode = new XmlNode(tagName);
              if (prefixedAttrs) {
                childNode[":@"] = prefixedAttrs;
              }
              this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
              if (options.captureMetaData) {
                currentNode.addEndIndex(closeIndex + 1);
              }
              this.matcher.pop();
              this.isCurrentNodeStopNode = false;
            } else if (options.unpairedTagsSet.has(tagName)) {
              const childNode = new XmlNode(tagName);
              if (prefixedAttrs) {
                childNode[":@"] = prefixedAttrs;
              }
              this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
              if (options.captureMetaData) {
                currentNode.addEndIndex(result.closeIndex + 1);
              }
              this.matcher.pop();
              this.isCurrentNodeStopNode = false;
              i = result.closeIndex;
              continue;
            } else {
              const childNode = new XmlNode(tagName);
              if (this.tagsNodeStack.length > options.maxNestedTags) {
                throw new Error("Maximum nested tags exceeded");
              }
              this.tagsNodeStack.push(currentNode);
              if (prefixedAttrs) {
                childNode[":@"] = prefixedAttrs;
              }
              this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
              currentNode = childNode;
            }
            textData = "";
            i = closeIndex;
          }
        }
      } else {
        textData += xmlData[i];
      }
    }
    return xmlObj.child;
  };
  function addChild(currentNode, childNode, matcher, startIndex) {
    if (!this.options.captureMetaData) startIndex = void 0;
    const jPathOrMatcher = this.options.jPath ? matcher.toString() : matcher;
    const result = this.options.updateTag(childNode.tagname, jPathOrMatcher, childNode[":@"]);
    if (result === false) {
    } else if (typeof result === "string") {
      childNode.tagname = result;
      currentNode.addChild(childNode, startIndex);
    } else {
      currentNode.addChild(childNode, startIndex);
    }
  }
  function replaceEntitiesValue(val, tagName, jPath) {
    const entityConfig = this.options.processEntities;
    if (!entityConfig || !entityConfig.enabled) {
      return val;
    }
    if (entityConfig.allowedTags) {
      const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
      const allowed = Array.isArray(entityConfig.allowedTags) ? entityConfig.allowedTags.includes(tagName) : entityConfig.allowedTags(tagName, jPathOrMatcher);
      if (!allowed) {
        return val;
      }
    }
    if (entityConfig.tagFilter) {
      const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
      if (!entityConfig.tagFilter(tagName, jPathOrMatcher)) {
        return val;
      }
    }
    return this.entityDecoder.decode(val);
  }
  function saveTextToParentTag(textData, parentNode, matcher, isLeafNode) {
    if (textData) {
      if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
      textData = this.parseTextData(
        textData,
        parentNode.tagname,
        matcher,
        false,
        parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
        isLeafNode
      );
      if (textData !== void 0 && textData !== "")
        parentNode.add(this.options.textNodeName, textData);
      textData = "";
    }
    return textData;
  }
  function isItStopNode() {
    if (this.stopNodeExpressionsSet.size === 0) return false;
    return this.matcher.matchesAny(this.stopNodeExpressionsSet);
  }
  function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
    let attrBoundary = 0;
    const len = xmlData.length;
    const closeCode0 = closingChar.charCodeAt(0);
    const closeCode1 = closingChar.length > 1 ? closingChar.charCodeAt(1) : -1;
    let result = "";
    let segmentStart = i;
    for (let index = i; index < len; index++) {
      const code = xmlData.charCodeAt(index);
      if (attrBoundary) {
        if (code === attrBoundary) attrBoundary = 0;
      } else if (code === 34 || code === 39) {
        attrBoundary = code;
      } else if (code === closeCode0) {
        if (closeCode1 !== -1) {
          if (xmlData.charCodeAt(index + 1) === closeCode1) {
            result += xmlData.substring(segmentStart, index);
            return { data: result, index };
          }
        } else {
          result += xmlData.substring(segmentStart, index);
          return { data: result, index };
        }
      } else if (code === 9 && !attrBoundary) {
        result += xmlData.substring(segmentStart, index) + " ";
        segmentStart = index + 1;
      }
    }
  }
  function findClosingIndex(xmlData, str, i, errMsg) {
    const closingIndex = xmlData.indexOf(str, i);
    if (closingIndex === -1) {
      throw new Error(errMsg);
    } else {
      return closingIndex + str.length - 1;
    }
  }
  function findClosingChar(xmlData, char, i, errMsg) {
    const closingIndex = xmlData.indexOf(char, i);
    if (closingIndex === -1) throw new Error(errMsg);
    return closingIndex;
  }
  function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
    const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
    if (!result) return;
    let tagExp = result.data;
    const closeIndex = result.index;
    const separatorIndex = tagExp.search(/\s/);
    let tagName = tagExp;
    let attrExpPresent = true;
    if (separatorIndex !== -1) {
      tagName = tagExp.substring(0, separatorIndex);
      tagExp = tagExp.substring(separatorIndex + 1).trimStart();
    }
    const rawTagName = tagName;
    if (removeNSPrefix) {
      const colonIndex = tagName.indexOf(":");
      if (colonIndex !== -1) {
        tagName = tagName.substr(colonIndex + 1);
        attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
      }
    }
    return {
      tagName,
      tagExp,
      closeIndex,
      attrExpPresent,
      rawTagName
    };
  }
  function readStopNodeData(xmlData, tagName, i) {
    const startIndex = i;
    let openTagCount = 1;
    const xmllen = xmlData.length;
    for (; i < xmllen; i++) {
      if (xmlData[i] === "<") {
        const c1 = xmlData.charCodeAt(i + 1);
        if (c1 === 47) {
          const closeIndex = findClosingChar(xmlData, ">", i, `${tagName} is not closed`);
          let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
          if (closeTagName === tagName) {
            openTagCount--;
            if (openTagCount === 0) {
              return {
                tagContent: xmlData.substring(startIndex, i),
                i: closeIndex
              };
            }
          }
          i = closeIndex;
        } else if (c1 === 63) {
          const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.");
          i = closeIndex;
        } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 45 && xmlData.charCodeAt(i + 3) === 45) {
          const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.");
          i = closeIndex;
        } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 91) {
          const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
          i = closeIndex;
        } else {
          const tagData = readTagExp(xmlData, i, false);
          if (tagData) {
            const openTagName = tagData && tagData.tagName;
            if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
              openTagCount++;
            }
            i = tagData.closeIndex;
          }
        }
      }
    }
  }
  function parseValue(val, shouldParse, options) {
    if (shouldParse && typeof val === "string") {
      const newval = val.trim();
      if (newval === "true") return true;
      else if (newval === "false") return false;
      else return toNumber(val, options);
    } else {
      if (isExist(val)) {
        return val;
      } else {
        return "";
      }
    }
  }
  function transformTagName(fn, tagName, tagExp, options) {
    if (fn) {
      const newTagName = fn(tagName);
      if (tagExp === tagName) {
        tagExp = newTagName;
      }
      tagName = newTagName;
    }
    tagName = sanitizeName(tagName, options);
    return { tagName, tagExp };
  }
  function sanitizeName(name, options) {
    if (criticalProperties.includes(name)) {
      throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
    } else if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
      return options.onDangerousProperty(name);
    }
    return name;
  }

  // web/node_modules/fast-xml-parser/src/xmlparser/node2json.js
  var METADATA_SYMBOL2 = XmlNode.getMetaDataSymbol();
  function stripAttributePrefix(attrs, prefix) {
    if (!attrs || typeof attrs !== "object") return {};
    if (!prefix) return attrs;
    const rawAttrs = {};
    for (const key in attrs) {
      if (key.startsWith(prefix)) {
        const rawName = key.substring(prefix.length);
        rawAttrs[rawName] = attrs[key];
      } else {
        rawAttrs[key] = attrs[key];
      }
    }
    return rawAttrs;
  }
  function prettify(node, options, matcher, readonlyMatcher) {
    return compress(node, options, matcher, readonlyMatcher);
  }
  function compress(arr, options, matcher, readonlyMatcher) {
    let text;
    const compressedObj = {};
    for (let i = 0; i < arr.length; i++) {
      const tagObj = arr[i];
      const property = propName(tagObj);
      if (property !== void 0 && property !== options.textNodeName) {
        const rawAttrs = stripAttributePrefix(
          tagObj[":@"] || {},
          options.attributeNamePrefix
        );
        matcher.push(property, rawAttrs);
      }
      if (property === options.textNodeName) {
        if (text === void 0) text = tagObj[property];
        else text += "" + tagObj[property];
      } else if (property === void 0) {
        continue;
      } else if (tagObj[property]) {
        let val = compress(tagObj[property], options, matcher, readonlyMatcher);
        const isLeaf = isLeafTag(val, options);
        if (Object.keys(val).length === 0 && options.alwaysCreateTextNode) {
          val[options.textNodeName] = "";
        }
        if (tagObj[":@"]) {
          assignAttributes(val, tagObj[":@"], readonlyMatcher, options);
        } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
          val = val[options.textNodeName];
        } else if (Object.keys(val).length === 0) {
          if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
          else val = "";
        }
        if (tagObj[METADATA_SYMBOL2] !== void 0 && typeof val === "object" && val !== null) {
          val[METADATA_SYMBOL2] = tagObj[METADATA_SYMBOL2];
        }
        if (compressedObj[property] !== void 0 && Object.prototype.hasOwnProperty.call(compressedObj, property)) {
          if (!Array.isArray(compressedObj[property])) {
            compressedObj[property] = [compressedObj[property]];
          }
          compressedObj[property].push(val);
        } else {
          const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() : readonlyMatcher;
          if (options.isArray(property, jPathOrMatcher, isLeaf)) {
            compressedObj[property] = [val];
          } else {
            compressedObj[property] = val;
          }
        }
        if (property !== void 0 && property !== options.textNodeName) {
          matcher.pop();
        }
      }
    }
    if (typeof text === "string") {
      if (text.length > 0) compressedObj[options.textNodeName] = text;
    } else if (text !== void 0) compressedObj[options.textNodeName] = text;
    return compressedObj;
  }
  function propName(obj) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key !== ":@") return key;
    }
  }
  function assignAttributes(obj, attrMap, readonlyMatcher, options) {
    if (attrMap) {
      const keys = Object.keys(attrMap);
      const len = keys.length;
      for (let i = 0; i < len; i++) {
        const atrrName = keys[i];
        const rawAttrName = atrrName.startsWith(options.attributeNamePrefix) ? atrrName.substring(options.attributeNamePrefix.length) : atrrName;
        const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() + "." + rawAttrName : readonlyMatcher;
        if (options.isArray(atrrName, jPathOrMatcher, true, true)) {
          obj[atrrName] = [attrMap[atrrName]];
        } else {
          obj[atrrName] = attrMap[atrrName];
        }
      }
    }
  }
  function isLeafTag(obj, options) {
    const { textNodeName } = options;
    const propCount = Object.keys(obj).length;
    if (propCount === 0) {
      return true;
    }
    if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
      return true;
    }
    return false;
  }

  // web/node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
  var XMLParser = class {
    constructor(options) {
      this.externalEntities = {};
      this.options = buildOptions(options);
    }
    /**
     * Parse XML dats to JS object 
     * @param {string|Uint8Array} xmlData 
     * @param {boolean|Object} validationOption 
     */
    parse(xmlData, validationOption) {
      if (typeof xmlData !== "string" && xmlData.toString) {
        if (xmlData instanceof Uint8Array && !(typeof Buffer !== "undefined" && Buffer.isBuffer(xmlData))) {
          xmlData = new TextDecoder("utf-8", { ignoreBOM: true }).decode(xmlData);
        } else {
          xmlData = xmlData.toString();
        }
      } else if (typeof xmlData !== "string") {
        throw new Error("XML data is accepted in String or Bytes[] form.");
      }
      if (validationOption) {
        if (validationOption === true) validationOption = {};
        const result = validate(xmlData, validationOption);
        if (result !== true) {
          throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
        }
      }
      const orderedObjParser = new OrderedObjParser(this.options, this.externalEntities);
      const orderedResult = orderedObjParser.parseXml(xmlData);
      if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
      else return prettify(orderedResult, this.options, orderedObjParser.matcher, orderedObjParser.readonlyMatcher);
    }
    /**
     * Add Entity which is not by default supported by this library
     * @param {string} key 
     * @param {string} value 
     */
    addEntity(key, value) {
      if (value.indexOf("&") !== -1) {
        throw new Error("Entity value can't have '&'");
      } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
        throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
      } else if (value === "&") {
        throw new Error("An entity with value '&' is not permitted");
      } else {
        this.externalEntities[key] = value;
      }
    }
    /**
     * Returns a Symbol that can be used to access the metadata
     * property on a node.
     * 
     * If Symbol is not available in the environment, an ordinary property is used
     * and the name of the property is here returned.
     * 
     * The XMLMetaData property is only present when `captureMetaData`
     * is true in the options.
     */
    static getMetaDataSymbol() {
      return XmlNode.getMetaDataSymbol();
    }
  };

  // web/node_modules/@braccato/parsers/dist/format-CZ36zD-v.js
  function t(r) {
    return r.includes("<tt") && r.includes("</tt>");
  }
  function d(r) {
    return /\[\d+:\d+\.\d+\]/.test(r);
  }
  function n(r) {
    return r.includes("<QrcInfos>") || r.includes("LyricContent=") ? true : /\[\d+,\d+\]/.test(r) && /\(\d+,\d+\)/.test(r);
  }

  // web/node_modules/@braccato/parsers/dist/index.js
  var Et = /[/、，,]/;
  var nt = /^([^:：]+)[:：]\s*(.+)$/;
  var k = [
    "\u8BCD",
    "\u8A5E",
    "\u4F5C\u8BCD",
    "\u4F5C\u8A5E",
    "\u66F2",
    "\u4F5C\u66F2",
    "\u8BCD\u66F2",
    "\u8A5E\u66F2",
    "\u4F5C\u8BCD\u4F5C\u66F2",
    "\u4F5C\u8A5E\u4F5C\u66F2",
    "writtenby",
    "lyricsby",
    "composedby",
    "lyricist",
    "composer"
  ];
  var et = [
    ...k,
    "\u7F16\u66F2",
    "\u7DE8\u66F2",
    "\u548C\u58F0",
    "\u548C\u8072",
    "\u6DF7\u97F3",
    "\u5409\u4ED6",
    "\u5236\u4F5C\u4EBA",
    "\u88FD\u4F5C\u4EBA",
    "\u6F14\u5531",
    "\u539F\u5531",
    "\u7FFB\u5531",
    "\u540E\u671F",
    "\u5F8C\u671F",
    "\u548C\u97F3",
    "\u5F55\u97F3",
    "\u9304\u97F3",
    "\u7B56\u5212",
    "\u7B56\u5283",
    "\u4F34\u594F",
    "\u7F8E\u5DE5",
    "\u6D77\u62A5",
    "\u6D77\u5831",
    "\u65C1\u767D",
    "producedby",
    "arrangedby",
    "mixing",
    "mastering",
    "vocal",
    "vocals",
    "guitar",
    "bass",
    "drums",
    "producer",
    "arranger"
  ];
  var yt = ["\u8BCD", "\u8A5E", "\u66F2", "\u58F0", "\u8072", "\u97F3"];
  var xt = 4;
  var Nt = /[/&、,，・·]/;
  function st(t2) {
    return t2.toLowerCase().replace(/\s+/g, "");
  }
  function Rt(t2) {
    return et.includes(t2) ? true : t2.length <= xt && yt.some((n2) => t2.endsWith(n2));
  }
  function rt(t2) {
    return t2.replace(/[a-z]+/g, "").split(Nt).filter(Boolean);
  }
  function j(t2) {
    const n2 = st(t2);
    if (et.includes(n2)) return true;
    const r = rt(n2);
    return r.length > 0 && r.every(Rt);
  }
  function wt(t2) {
    const n2 = st(t2);
    return k.includes(n2) ? true : j(t2) && rt(n2).some((r) => k.includes(r));
  }
  function It(t2) {
    const n2 = t2.trim().match(nt);
    return n2 !== null && j(n2[1]);
  }
  function ot(t2) {
    const n2 = t2.trim().match(nt);
    return !n2 || !wt(n2[1]) ? [] : it(n2[2]);
  }
  function it(t2) {
    return t2.split(Et).map((n2) => n2.trim()).filter(Boolean);
  }
  function V(t2) {
    const n2 = /* @__PURE__ */ new Set();
    for (const r of t2) {
      const s2 = r.trim();
      s2 && n2.add(s2);
    }
    return [...n2];
  }
  var St = 5e3;
  function Z(t2, n2, r = St) {
    if (t2.length === 0) return t2;
    const s2 = [], e2 = (i, f) => ({
      startTimeMs: i,
      durationMs: f,
      words: "",
      parts: [],
      isInstrumental: true
    });
    t2[0].startTimeMs > r && s2.push(e2(0, t2[0].startTimeMs));
    for (let i = 0; i < t2.length; i++)
      if (s2.push(t2[i]), i < t2.length - 1) {
        const f = t2[i].startTimeMs + t2[i].durationMs, l = t2[i + 1].startTimeMs - f;
        l > r && s2.push(e2(f, l));
      }
    const o = t2[t2.length - 1], a = o.startTimeMs + o.durationMs, c = n2 - a;
    return c > r && s2.push(e2(a, c)), s2;
  }
  function W(t2) {
    if (!t2) return 0;
    if (typeof t2 == "number") return t2;
    const n2 = t2.match(/^([\d.]+)(h|m|s|ms)$/);
    if (n2) {
      const e2 = Number.parseFloat(n2[1]), o = n2[2];
      if (o === "h") return Math.round(e2 * 60 * 60 * 1e3);
      if (o === "m") return Math.round(e2 * 60 * 1e3);
      if (o === "s") return Math.round(e2 * 1e3);
      if (o === "ms") return Math.round(e2);
    }
    const r = t2.split(":").map((e2) => e2.replace(/[^0-9.]/g, ""));
    let s2 = 0;
    try {
      return r.length === 1 ? s2 = Number.parseFloat(r[0]) * 1e3 : r.length === 2 ? s2 = Number.parseInt(r[0], 10) * 60 * 1e3 + Number.parseFloat(r[1]) * 1e3 : r.length === 3 && (s2 = Number.parseInt(r[0], 10) * 3600 * 1e3 + Number.parseInt(r[1], 10) * 60 * 1e3 + Number.parseFloat(r[2]) * 1e3), Math.round(s2);
    } catch {
      return 0;
    }
  }
  function At(t2) {
    var e2, o;
    const n2 = /* @__PURE__ */ new Map();
    if (!t2 || t2.length === 0) return n2;
    const r = t2.filter((a) => "agent" in a && a[":@"]);
    let s2 = 0;
    for (const a of r) {
      const c = (e2 = a[":@"]) == null ? void 0 : e2["@_id"], i = (o = a[":@"]) == null ? void 0 : o["@_type"];
      c && (i === "person" || i === "character" ? (s2++, n2.set(c, `v${s2}`)) : n2.set(c, "v1000"));
    }
    return n2;
  }
  function z(t2) {
    if (!t2) return "";
    let n2 = "";
    for (const r of t2)
      typeof r["#text"] == "string" ? n2 += r["#text"] : r.span && (n2 += z(r.span));
    return n2;
  }
  function Q(t2, n2) {
    var i, f, u, l, h, d2, T;
    let r = "", s2 = [], e2 = false, o = 0;
    const a = (m) => {
      var g;
      return !!((g = m[":@"]) != null && g["@_begin"]) && z(m.span) !== "";
    }, c = t2.some(
      (m) => {
        var g;
        return ((g = m[":@"]) == null ? void 0 : g["@_role"]) === "x-bg" ? (m.span ?? []).some(a) : a(m);
      }
    );
    for (const m of t2) {
      let g = false, p = [m];
      if (((i = m[":@"]) == null ? void 0 : i["@_role"]) === "x-bg") {
        g = true, p = m.span ?? [];
        const _ = p.some((P) => {
          var G;
          return (G = P[":@"]) == null ? void 0 : G["@_begin"];
        }), x = ((f = m[":@"]) == null ? void 0 : f["@_begin"]) && ((u = m[":@"]) == null ? void 0 : u["@_end"]);
        c && x && !_ && (p = [m]);
      }
      const R = g ? { backgroundGroup: o } : {}, v = s2.length;
      for (const _ of p)
        if (_["#text"]) {
          r += _["#text"];
          const x = s2[s2.length - 1];
          s2.push({
            startTimeMs: x ? x.startTimeMs + x.durationMs : n2,
            durationMs: 0,
            words: _["#text"],
            isBackground: g,
            ...R
          });
        } else if (_.span) {
          const x = z(_.span);
          if (!x) continue;
          const P = W((l = _[":@"]) == null ? void 0 : l["@_begin"]), G = W((h = _[":@"]) == null ? void 0 : h["@_end"]), C = ((d2 = _[":@"]) == null ? void 0 : d2["@_explicit"]) === "true" || ((T = _[":@"]) == null ? void 0 : T["@_obscene"]) === "true";
          s2.push({
            startTimeMs: P,
            durationMs: G - P,
            isBackground: g,
            ...R,
            words: x,
            explicit: C
          }), r += x, e2 = true;
        }
      g && s2.length > v && o++;
    }
    return e2 || (s2 = []), { parts: s2, text: r, isWordSynced: e2 };
  }
  var Pt = /<\/?([A-Za-z][\w.-]*):/g;
  var Gt = /\s([A-Za-z][\w.-]*):[\w.-]+\s*=/g;
  var Ot = /xmlns:([A-Za-z][\w.-]*)\s*=/g;
  var vt = /<tt\b[^>]*>/;
  function Ct(t2) {
    const n2 = t2.match(vt);
    if (!n2) return t2;
    const r = n2[0], s2 = /* @__PURE__ */ new Set(["xml", "xmlns"]);
    for (const i of r.matchAll(Ot))
      s2.add(i[1]);
    const e2 = /* @__PURE__ */ new Set();
    for (const i of t2.matchAll(Pt))
      e2.add(i[1]);
    for (const i of t2.matchAll(Gt))
      e2.add(i[1]);
    const o = [...e2].filter((i) => !s2.has(i));
    if (o.length === 0) return t2;
    const a = o.map((i) => ` xmlns:${i}="urn:braccato:unbound:${i}"`).join(""), c = r.replace(/>$/, `${a}>`);
    return t2.replace(r, c);
  }
  var $t = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    attributesGroupName: false,
    textNodeName: "#text",
    trimValues: false,
    removeNSPrefix: true,
    preserveOrder: true,
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    parseTagValue: false,
    htmlEntities: true
  };
  function B(t2, n2) {
    const r = t2.find((s2) => n2 in s2);
    if (r != null && r[n2]) return r;
    for (const s2 of t2)
      for (const e2 of Object.values(s2))
        if (Array.isArray(e2)) {
          const o = e2.find((a) => typeof a == "object" && a !== null && n2 in a);
          if (o != null && o[n2]) return o;
        }
    return null;
  }
  function at(t2) {
    const n2 = new XMLParser($t), r = t2.replace(/\\"/g, '"');
    let s2;
    try {
      s2 = n2.parse(Ct(r));
    } catch {
      return null;
    }
    return (Array.isArray(s2) ? s2.find((e2) => "tt" in e2) : void 0) ?? null;
  }
  function K(t2) {
    var n2, r, s2, e2;
    return ((e2 = (s2 = (r = (n2 = t2 == null ? void 0 : t2.tt) == null ? void 0 : n2.find((o) => o.head)) == null ? void 0 : r.head) == null ? void 0 : s2.find((o) => "metadata" in o)) == null ? void 0 : e2.metadata) ?? [];
  }
  function lt(t2) {
    const n2 = [], r = B(t2, "songwriters");
    for (const s2 of (r == null ? void 0 : r.songwriters) ?? [])
      n2.push(z(s2.songwriter));
    for (const s2 of t2) {
      if (!("meta" in s2)) continue;
      const e2 = s2[":@"], o = e2 == null ? void 0 : e2["@_key"];
      (o === "songwriter" || o === "songwriters") && (e2 != null && e2["@_value"]) && n2.push(e2["@_value"]);
    }
    return V(n2);
  }
  var D = null;
  function Ft(t2) {
    return (D == null ? void 0 : D.xml) === t2 ? [...D.songwriters] : lt(K(at(t2)));
  }
  function Xt(t2, n2 = {}) {
    var _, x, P, G, C, $2;
    const r = at(t2);
    if (D = { xml: t2, songwriters: lt(K(r)) }, !r) return { lyrics: [], isWordSynced: false };
    const s2 = r.tt;
    if (!s2) return { lyrics: [], isWordSynced: false };
    const e2 = s2.find((E) => E.body), o = e2 == null ? void 0 : e2.body, a = e2 == null ? void 0 : e2[":@"], c = ((_ = r[":@"]) == null ? void 0 : _["@_lang"]) || (a == null ? void 0 : a["@_lang"]);
    if (!o) return { lyrics: [], isWordSynced: false, language: c };
    const i = /* @__PURE__ */ new Map(), f = {}, u = K(r), l = At(u), h = o.flatMap((E) => E.div ?? []).filter((E) => E != null && "p" in E);
    if (!(h.length > 0 && h[0][":@"] !== void 0))
      return { lyrics: [], isWordSynced: false, language: c };
    let T = false;
    for (const E of h) {
      const N = E[":@"];
      if (!(N != null && N["@_begin"])) continue;
      const y = W(N["@_begin"]), w = W(N["@_end"]), I = Q(E.p, y);
      I.isWordSynced && (T = true);
      const S = N["@_agent"], A = S ? l.get(S) ?? S : void 0, M = N["@_key"];
      let b;
      if (M) {
        const F = f[M];
        F ? F.push(`${M}_${F.length + 1}`) : f[M] = [`${M}_1`];
        const X = f[M];
        b = X[X.length - 1];
      } else
        b = String(i.size);
      i.set(b, {
        agent: A,
        durationMs: w - y,
        parts: I.parts,
        startTimeMs: y,
        words: I.text,
        key: M ?? b
      });
    }
    const m = (E, N) => {
      const y = f[E];
      if (y)
        for (const w of y) {
          const I = i.get(w);
          I && N(I);
        }
    }, g = B(u, "translations");
    if (g) {
      const E = (x = g[":@"]) == null ? void 0 : x["@_lang"], N = g.translations ?? [];
      for (const y of N) {
        const w = ((P = y[":@"]) == null ? void 0 : P["@_lang"]) ?? E, I = (G = y[":@"]) == null ? void 0 : G["@_for"];
        for (const S of y.translation ?? []) {
          const A = ((C = S[":@"]) == null ? void 0 : C["@_for"]) ?? I, M = z(S.text);
          !w || !M || !A || m(A, (b) => {
            b.translations || (b.translations = {}), b.translations[w] = M, b.translation || (b.translation = { text: M, lang: w });
          });
        }
      }
    }
    const p = B(u, "transliterations");
    if (p) {
      const E = p.transliterations ?? [];
      for (const N of E)
        for (const y of N.transliteration ?? []) {
          const w = ($2 = y[":@"]) == null ? void 0 : $2["@_for"], I = y.text;
          !w || !I || m(w, (S) => {
            const A = Q(I, S.startTimeMs);
            S.romanization = A.text, A.parts.length > 0 && (S.timedRomanization = A.parts);
          });
        }
    }
    const R = a != null && a["@_dur"] ? W(a["@_dur"]) : n2.songDurationMs ?? 0;
    return { lyrics: Z(Array.from(i.values()), R, n2.instrumentalGapMs), isWordSynced: T, language: c };
  }
  var Dt = {
    detect(t2) {
      return t(t2);
    },
    // The duration is deliberately unused. `@braccato/provider-blyrics` calls this with one argument,
    // and a version that honoured the parameter would hand that call site a 0 song duration.
    parse(t2, n2 = 0) {
      return Xt(t2).lyrics;
    },
    metadata(t2) {
      return { songwriters: Ft(t2) };
    }
  };
  var Wt = ["ti", "ar", "al", "au", "lr", "length", "by", "offset", "re", "tool", "ve", "#"];
  var zt = ["au", "lr"];
  var U = /\[(\d+:\d+\.\d+)\]/g;
  var L = /<(\d+:\d+\.\d+)>/g;
  var ct = /^\[(\w+):(.*)\]$/;
  var ut = /\[bg:(.*)\]\s*$/;
  var Lt = /^[\s♪♫♬♩🎵🎶]*$/u;
  function Y(t2) {
    if (!t2) return 0;
    if (typeof t2 == "number") return t2;
    const n2 = t2.split(":");
    let r = 0;
    try {
      if (n2.length === 1)
        r = Number.parseFloat(n2[0]) * 1e3;
      else if (n2.length === 2) {
        const s2 = Number.parseInt(n2[0], 10), e2 = Number.parseFloat(n2[1]);
        r = s2 * 60 * 1e3 + e2 * 1e3;
      } else if (n2.length === 3) {
        const s2 = Number.parseInt(n2[0], 10), e2 = Number.parseInt(n2[1], 10), o = Number.parseFloat(n2[2]);
        r = s2 * 3600 * 1e3 + e2 * 60 * 1e3 + o * 1e3;
      }
      return Math.round(r);
    } catch {
      return 0;
    }
  }
  function jt(t2, n2, r = {}) {
    var i, f;
    const s2 = t2.split(`
`), e2 = [], o = {};
    for (const u of s2) {
      const l = u.trim(), h = l.match(ct);
      if (h && Wt.includes(h[1])) {
        o[h[1]] = h[2];
        continue;
      }
      let d2 = Number.POSITIVE_INFINITY, T = Number.NEGATIVE_INFINITY, m = 0;
      for (const M of l.matchAll(U)) {
        const b = Y(M[1]);
        b < d2 && (d2 = b), b > T && (T = b), m++;
      }
      if (m === 0) continue;
      const g = l.replace(U, "").trim(), p = [];
      let R = null, v = "";
      const _ = g.match(ut), x = _ ? g.slice(0, _.index) : g, P = _ ? _[1] : null, G = x.split(L), C = G.some(
        (M, b) => b % 2 === 0 && b > 0 && b < G.length - 1 && M.length > 0 && M.trim() === ""
      ), $2 = (M, b) => {
        const F = p.length;
        return M.split(L).forEach((X, gt) => {
          if (gt % 2 === 0) {
            let O = X;
            if (C) {
              const H = O.trim();
              O = H === "" && O.length > 0 ? " " : H;
            }
            v += O, p.length > 0 && (p[p.length - 1].words += O);
          } else {
            const O = Y(X);
            R !== null && p.length > 0 && (p[p.length - 1].durationMs = O - R), p.push({ startTimeMs: O, words: "", durationMs: 0, isBackground: b }), R = O;
          }
        }), p.length > F ? p[p.length - 1] : void 0;
      }, E = $2(x, false), N = P === null ? void 0 : $2(P, true);
      if (It(x.replace(L, ""))) continue;
      const y = [E, N].filter((M) => (M == null ? void 0 : M.words.trim()) === ""), w = N ?? E, I = w && y.includes(w) ? Math.max(...y.map((M) => M.startTimeMs)) : null, S = p.filter((M) => !y.includes(M)), A = v.trim();
      e2.push({
        lyric: {
          startTimeMs: d2,
          words: Lt.test(A) ? "" : A,
          durationMs: T - d2,
          parts: S.length > 0 ? S : void 0
        },
        statedEnd: I ?? (m > 1 ? T : null)
      });
    }
    e2.sort((u, l) => u.lyric.startTimeMs - l.lyric.startTimeMs);
    const a = e2.map((u) => u.lyric);
    for (let u = 0; u < a.length; u++) {
      const l = a[u], { statedEnd: h } = e2[u];
      if (h !== null) {
        l.durationMs = Math.max(h - l.startTimeMs, 0);
        const d2 = (i = l.parts) == null ? void 0 : i[l.parts.length - 1];
        d2 && d2.durationMs === 0 && (d2.durationMs = Math.max(h - d2.startTimeMs, 0));
      } else if (u + 1 < a.length) {
        const d2 = a[u + 1];
        if (l.durationMs === 0 && (l.durationMs = Math.max(d2.startTimeMs - l.startTimeMs, 0)), l.parts && l.parts.length > 0) {
          let T = d2.startTimeMs;
          for (const g of l.parts)
            T = Math.max(T, g.startTimeMs);
          const m = l.parts[l.parts.length - 1];
          m.durationMs = Math.max(d2.startTimeMs - m.startTimeMs, 0), l.durationMs = Math.max(T - l.startTimeMs, 0);
        }
      } else {
        const d2 = n2 - l.startTimeMs;
        if (l.durationMs === 0 && d2 > 0 && (l.durationMs = d2), l.parts && l.parts.length > 0) {
          const T = l.parts[l.parts.length - 1], m = n2 - T.startTimeMs;
          m > 0 && (T.durationMs = m);
        }
      }
    }
    const c = a.filter((u) => u.words !== "");
    if (o.offset) {
      let u = Number(o.offset);
      Number.isNaN(u) && (u = 0), u = u * 1e3;
      for (const l of c)
        l.startTimeMs -= u, (f = l.parts) == null || f.forEach((h) => {
          h.startTimeMs -= u;
        });
    }
    return Z(c, n2, r.instrumentalGapMs);
  }
  function kt(t2) {
    for (const s2 of t2)
      if (s2.parts)
        for (let e2 = 1; e2 < s2.parts.length; e2++) {
          const o = s2.parts[e2], a = s2.parts[e2 - 1];
          if (o.words === " " && a.words !== " ") {
            const c = o.durationMs - a.durationMs;
            if (Math.abs(c) <= 15 || o.durationMs <= 100) {
              const i = o.durationMs;
              a.durationMs += i, o.durationMs -= i, o.startTimeMs += i;
            }
          }
        }
    let n2 = 0, r = 0;
    for (const s2 of t2)
      if (!(!s2.parts || s2.parts.length === 0))
        for (let e2 = 0; e2 < s2.parts.length - 2; e2++) {
          const o = s2.parts[e2];
          o.words !== " " && (o.durationMs <= 100 && n2++, r++);
        }
    if (r > 0 && n2 / r > 0.5)
      for (let s2 = 0; s2 < t2.length; s2++) {
        const e2 = t2[s2];
        if (!(!e2.parts || e2.parts.length === 0))
          for (let o = 0; o < e2.parts.length; o++) {
            const a = e2.parts[o];
            if (a.words !== " " && a.durationMs <= 400) {
              let c = null;
              o + 1 < e2.parts.length ? c = e2.parts[o + 1] : s2 + 1 < t2.length && t2[s2 + 1].parts && t2[s2 + 1].parts.length > 0 && (c = t2[s2 + 1].parts[0]), c === null ? a.durationMs = Math.max(a.durationMs, 300) : c.words === " " ? (a.durationMs += c.durationMs, c.startTimeMs += c.durationMs, c.durationMs = 0) : a.durationMs = c.startTimeMs - a.startTimeMs;
              const i = e2.startTimeMs + e2.durationMs;
              o === e2.parts.length - 1 && e2.durationMs > 0 && i > a.startTimeMs && (a.durationMs = Math.min(a.durationMs, i - a.startTimeMs));
            }
          }
      }
  }
  var Bt = {
    detect(t2) {
      return d(t2);
    },
    parse(t2, n2 = 0) {
      const r = jt(t2, n2);
      return kt(r), r;
    },
    metadata(t2) {
      const n2 = [];
      for (const r of t2.split(`
`)) {
        const s2 = r.trim(), e2 = s2.match(ct);
        if (e2 && zt.includes(e2[1])) n2.push(...it(e2[2]));
        else {
          const o = s2.replace(U, "");
          o !== s2 && n2.push(...ot(o.replace(ut, "").replace(L, "")));
        }
      }
      return { songwriters: V(n2) };
    }
  };
  var Ut = {
    detect(t2) {
      return true;
    },
    parse(t2, n2 = 0) {
      return t2.split(`
`).map((r) => ({
        startTimeMs: 0,
        words: r,
        durationMs: 0
      }));
    },
    metadata(t2) {
      return { songwriters: [] };
    }
  };
  var Vt = (t2, n2, r = 2, s2 = false) => {
    const e2 = s2 ? t2 : t2.toLowerCase(), o = s2 ? n2 : n2.toLowerCase();
    if (e2.length < r || o.length < r) return 0;
    const a = /* @__PURE__ */ new Map();
    for (let i = 0; i < e2.length - (r - 1); i++) {
      const f = e2.substring(i, i + r);
      a.set(f, a.has(f) ? a.get(f) + 1 : 1);
    }
    let c = 0;
    for (let i = 0; i < o.length - (r - 1); i++) {
      const f = o.substring(i, i + r), u = a.has(f) ? a.get(f) : 0;
      u > 0 && (a.set(f, u - 1), c++);
    }
    return c * 2 / (e2.length + o.length - (r - 1) * 2);
  };
  function ft(t2) {
    if (t2[0] !== "[") return null;
    const n2 = t2.indexOf("]");
    if (n2 === -1) return null;
    const r = t2.indexOf(",", 1);
    if (r === -1 || r > n2) return null;
    const s2 = Number.parseInt(t2.slice(1, r), 10), e2 = Number.parseInt(t2.slice(r + 1, n2), 10);
    return Number.isNaN(s2) || Number.isNaN(e2) ? null : { startTime: s2, duration: e2, rest: t2.slice(n2 + 1) };
  }
  var Zt = /\((\d+),(\d+)\)/g;
  function mt(t2) {
    const n2 = [];
    let r = 0;
    for (const s2 of t2.matchAll(Zt))
      n2.push({
        text: t2.slice(r, s2.index),
        time: Number.parseInt(s2[1], 10),
        duration: Number.parseInt(s2[2], 10)
      }), r = s2.index + s2[0].length;
    return n2;
  }
  function J(t2, n2, r) {
    if (!r.aliases[t2]) {
      const s2 = t2.toUpperCase(), e2 = s2 === "\u5408" || s2 === "ALL" || s2 === "\u5408\u5531" ? "group" : "person";
      r.aliases[t2] = e2 === "group" ? "v1000" : `v${r.nextVoiceId++}`;
    }
    n2.agent = r.aliases[t2];
  }
  function tt(t2) {
    if (t2.syllables.length > 0) {
      const n2 = t2.syllables[0], r = t2.syllables[t2.syllables.length - 1];
      t2.time = n2.time, t2.duration = r.time + r.duration - n2.time;
    }
  }
  var Ht = /[^a-z0-9　-鿿가-힯]/g;
  function Qt(t2, n2, r, s2) {
    if (!t2.syllables.length)
      return n2.currentSinger && (t2.agent = n2.currentSinger), true;
    if (r) {
      if (s2 && (s2.title || s2.artist)) {
        const m = (_) => _.toLowerCase().replace(Ht, ""), g = m(t2.text), p = m(s2.title ?? ""), R = m(s2.artist ?? "");
        if (p && g.includes(p) && R && g.includes(R) || p && g.includes(p) && !R && g.length < p.length + 15 || R && g === R) return false;
        const v = `${s2.title ?? ""} ${s2.artist ?? ""}`;
        if (Vt(t2.text, v) > 0.5) return false;
      }
      if (t2.syllables.length > 2 && t2.syllables.every((m, g, p) => Math.abs(m.duration - p[0].duration) < 10)) return false;
    }
    n2.currentSinger && (t2.agent = n2.currentSinger);
    let e2 = "", o = 0;
    for (const T of t2.syllables) {
      if (e2 += T.text, o++, e2.includes(":") || e2.includes("\uFF1A")) break;
      if (e2.length > 40) return true;
    }
    const a = e2.match(/^([^:：]+)\s*[:：]\s*$/);
    if (a) {
      const T = a[1].trim();
      return j(T) ? false : (T.length > 30 || (t2.syllables = t2.syllables.slice(o), t2.text = t2.text.substring(e2.length), J(T, t2, n2), n2.currentSinger = n2.aliases[T], tt(t2)), true);
    }
    const c = e2.match(/^([^:：]+)\s*[:：]\s*([\s\S]*)$/);
    if (!c) return true;
    const i = c[1].trim();
    if (j(i)) return false;
    if (i.length > 20) return true;
    const f = c[2] || "", u = o - 1, l = t2.syllables[u], h = l.text.match(/[:：]\s*([\s\S]*)$/), d2 = h ? h[1] : "";
    return d2.length > 0 ? (l.text = d2, t2.syllables = t2.syllables.slice(u)) : t2.syllables = t2.syllables.slice(o), J(i, t2, n2), n2.currentSinger = n2.aliases[i], t2.text = f, tt(t2), true;
  }
  var Yt = /LyricContent="([\s\S]*?)"\s*(?:\/?>|[a-zA-Z]+=)/;
  function dt(t2) {
    const n2 = t2.match(Yt);
    return n2 ? n2[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&") : t2;
  }
  function qt(t2, n2, r) {
    if (!t2) return [];
    const s2 = dt(t2), e2 = [], o = { aliases: {}, nextVoiceId: 1, currentSinger: null };
    for (const c of s2.split(`
`)) {
      const i = c.trim();
      if (!i || /^\[[a-zA-Z]+:/.test(i)) continue;
      const f = ft(i);
      if (!f) continue;
      const u = mt(f.rest), l = u.map((d2) => d2.text).join(""), h = {
        time: f.startTime,
        duration: f.duration,
        text: l,
        syllables: u,
        agent: null
      };
      Qt(h, o, e2.length < 5, r) && e2.push(h);
    }
    if (e2.length === 0) return [];
    const a = e2.map((c, i) => {
      const f = c.syllables.map((l) => ({
        startTimeMs: l.time,
        words: l.text,
        durationMs: l.duration
      }));
      let u = c.duration;
      if (u === 0 && i + 1 < e2.length ? u = Math.max(e2[i + 1].time - c.time, 0) : u === 0 && (u = n2 - c.time), f.length > 0) {
        const l = f[f.length - 1];
        l.durationMs === 0 && (i + 1 < e2.length ? l.durationMs = Math.max(e2[i + 1].time - l.startTimeMs, 0) : l.durationMs = n2 - l.startTimeMs);
      }
      return {
        startTimeMs: c.time,
        words: c.text,
        durationMs: u,
        parts: f.length > 0 ? f : void 0,
        agent: c.agent ?? void 0
      };
    });
    return Z(a, n2);
  }
  function Jt(t2) {
    const n2 = [];
    for (const r of dt(t2).split(`
`)) {
      const s2 = ft(r.trim());
      if (!s2) continue;
      const e2 = mt(s2.rest).map((o) => o.text).join("");
      n2.push(...ot(e2));
    }
    return V(n2);
  }
  var tn = {
    detect(t2) {
      return n(t2);
    },
    parse(t2, n2 = 0) {
      return qt(t2, n2);
    },
    metadata(t2) {
      return { songwriters: t2 ? Jt(t2) : [] };
    }
  };

  // web/src/spicy-source.js
  function spicyContributors(attribution) {
    const credits = [{ label: "Spicy Lyrics", url: "https://spicylyrics.org/" }];
    for (const [key, role] of [["uploader", "Uploaded by"], ["maker", "Made by"]]) {
      const contributor = attribution?.[key];
      if (typeof contributor?.username !== "string" || !contributor.username.trim()) continue;
      let url;
      try {
        const profile = new URL(contributor.url);
        if (profile.protocol === "https:" && profile.hostname === "spicylyrics.org" && !profile.port && !profile.username && !profile.password) url = profile.href;
      } catch {
      }
      credits.push({ label: role + " " + contributor.username.trim().slice(0, 160), url });
    }
    return credits;
  }

  // web/src/upstream-providers.ts
  var HOMEPAGE_DOMAIN = "betterlyrics.org";
  var HOMEPAGE_URL = "https://betterlyrics.org";
  var logCore = (..._args) => {
  };
  var resolveWaiter = (..._args) => {
  };
  function fillTtml(responseString, providerParameters, options = {
    richsyncKey: "bLyrics-richsynced",
    syncedKey: "bLyrics-synced",
    source: HOMEPAGE_DOMAIN,
    sourceHref: HOMEPAGE_URL,
    cacheAllowed: true,
    unisonData: void 0
  }) {
    const { richsyncKey, syncedKey, source, sourceHref, cacheAllowed, unisonData } = options;
    const { lyrics, isWordSynced, language } = Xt(responseString, {
      songDurationMs: providerParameters.duration * 1e3
    });
    if (lyrics.length === 0) {
      logCore(`No timed lines parsed from ${source} TTML (${responseString.length} chars)`);
      providerParameters.sourceMap[richsyncKey].lyricSourceResult = null;
      providerParameters.sourceMap[richsyncKey].filled = true;
      providerParameters.sourceMap[syncedKey].lyricSourceResult = null;
      providerParameters.sourceMap[syncedKey].filled = true;
      return;
    }
    const result = {
      cacheAllowed: cacheAllowed ?? true,
      language,
      lyrics,
      musicVideoSynced: false,
      source,
      sourceHref,
      songwriters: Dt.metadata(responseString).songwriters,
      unisonData,
      ...options.contributors ? { contributors: options.contributors } : {}
    };
    if (isWordSynced) {
      providerParameters.sourceMap[richsyncKey].lyricSourceResult = result;
      providerParameters.sourceMap[syncedKey].lyricSourceResult = null;
    } else {
      providerParameters.sourceMap[richsyncKey].lyricSourceResult = null;
      providerParameters.sourceMap[syncedKey].lyricSourceResult = result;
    }
    providerParameters.sourceMap[syncedKey].filled = true;
    providerParameters.sourceMap[richsyncKey].filled = true;
  }
  async function processStreamData(event, data, params2) {
    const { sourceMap } = params2;
    const durationMs = params2.duration * 1e3;
    if (event === "metadata") {
      if (data.album && !params2.album) params2.album = data.album;
      if (data.song && params2.song !== data.song) params2.song = data.song;
      if (data.artist && params2.artist !== data.artist) params2.artist = data.artist;
      if (data.duration && params2.duration !== Number(data.duration)) params2.duration = Number(data.duration);
      sourceMap["metadata"].lyricSourceResult = {
        lyrics: null,
        source: "Metadata",
        sourceHref: "",
        album: data.album,
        artist: data.artist,
        song: data.song,
        duration: Number(data.duration),
        cacheAllowed: true
      };
      sourceMap["metadata"].filled = true;
      resolveWaiter(params2, "metadata");
      return;
    }
    if (event === "provider") {
      const provider = data.provider;
      const results = data.results;
      if (!results) return;
      if (provider === "spicy" && typeof results.lyrics === "string" && results.lyrics.trim()) {
        fillTtml(results.lyrics, params2, {
          richsyncKey: "spicy-richsynced",
          syncedKey: "spicy-synced",
          source: "Spicy Lyrics",
          sourceHref: "https://spicylyrics.org/",
          cacheAllowed: false,
          contributors: spicyContributors(results.attribution)
        });
        return;
      }
      if (provider === "musixmatch") {
        if (results.wordByWord) {
          const lyrics = jt(results.wordByWord, durationMs);
          kt(lyrics);
          sourceMap["musixmatch-richsync"].lyricSourceResult = {
            lyrics,
            songwriters: Bt.metadata(results.wordByWord).songwriters,
            source: "Musixmatch",
            sourceHref: "https://www.musixmatch.com",
            musicVideoSynced: false,
            album: params2.album || "",
            artist: params2.artist,
            song: params2.song,
            duration: params2.duration,
            cacheAllowed: true
          };
          sourceMap["musixmatch-richsync"].filled = true;
          resolveWaiter(params2, "musixmatch-richsync");
        }
        if (results.synced) {
          const lyrics = jt(results.synced, durationMs);
          sourceMap["musixmatch-synced"].lyricSourceResult = {
            lyrics,
            songwriters: Bt.metadata(results.synced).songwriters,
            source: "Musixmatch",
            sourceHref: "https://www.musixmatch.com",
            musicVideoSynced: false
          };
          sourceMap["musixmatch-synced"].filled = true;
          resolveWaiter(params2, "musixmatch-synced");
        }
      }
      if (provider === "lrclib") {
        if (results.synced) {
          const lyrics = jt(results.synced, durationMs);
          sourceMap["lrclib-synced"].lyricSourceResult = {
            lyrics,
            songwriters: Bt.metadata(results.synced).songwriters,
            source: "LRCLib",
            sourceHref: "https://lrclib.net",
            musicVideoSynced: false
          };
          sourceMap["lrclib-synced"].filled = true;
          resolveWaiter(params2, "lrclib-synced");
        }
        if (results.plain) {
          const lyrics = Ut.parse(results.plain);
          sourceMap["lrclib-plain"].lyricSourceResult = {
            lyrics,
            source: "LRCLib",
            sourceHref: "https://lrclib.net",
            musicVideoSynced: false,
            cacheAllowed: false
          };
          sourceMap["lrclib-plain"].filled = true;
          resolveWaiter(params2, "lrclib-plain");
        }
      }
      if (provider === "kugou") {
        if (results.lyrics) {
          let decodedLyrics = JSON.parse(results.lyrics);
          const lyrics = jt(decodedLyrics.lyrics, durationMs);
          sourceMap["legato-synced"].lyricSourceResult = {
            lyrics,
            songwriters: Bt.metadata(decodedLyrics.lyrics).songwriters,
            source: "Better Lyrics Legato",
            sourceHref: HOMEPAGE_URL,
            musicVideoSynced: false
          };
          sourceMap["legato-synced"].filled = true;
          resolveWaiter(params2, "legato-synced");
        }
      }
      if (provider === "qq") {
        if (results.lyrics) {
          let decodedLyrics = JSON.parse(results.lyrics);
          const lyrics = qt(decodedLyrics.lyrics, durationMs, {
            title: params2.song,
            artist: params2.artist
          });
          if (lyrics.length > 0) {
            sourceMap["portato-richsynced"].lyricSourceResult = {
              lyrics,
              songwriters: tn.metadata(decodedLyrics.lyrics).songwriters,
              source: "Better Lyrics Portato",
              sourceHref: HOMEPAGE_URL,
              musicVideoSynced: false,
              cacheAllowed: true
            };
          }
          sourceMap["portato-richsynced"].filled = true;
          resolveWaiter(params2, "portato-richsynced");
        }
      }
      if (provider === "golyrics") {
        if (results.lyrics) {
          let ttml = results.lyrics;
          try {
            const parsed = JSON.parse(ttml);
            if (parsed.ttml) ttml = parsed.ttml;
          } catch (_e) {
          }
          fillTtml(ttml, params2);
          resolveWaiter(params2, "bLyrics-synced");
          resolveWaiter(params2, "bLyrics-richsynced");
        }
      }
      if (provider === "binimum") {
        if (results.lyrics) {
          fillTtml(results.lyrics, params2, {
            richsyncKey: "binimum-richsynced",
            syncedKey: "binimum-synced",
            source: "BiniLyrics",
            sourceHref: "https://lyrics-api.binimum.org/"
          });
          const timingType = results.timingType ?? null;
          if (timingType === "syllable") {
            if (!sourceMap["binimum-richsynced"].lyricSourceResult) {
              sourceMap["binimum-richsynced"].lyricSourceResult = sourceMap["binimum-synced"].lyricSourceResult;
              sourceMap["binimum-synced"].lyricSourceResult = null;
            }
          } else if (timingType === "line") {
            if (!sourceMap["binimum-synced"].lyricSourceResult) {
              sourceMap["binimum-synced"].lyricSourceResult = sourceMap["binimum-richsynced"].lyricSourceResult;
            }
            sourceMap["binimum-richsynced"].lyricSourceResult = null;
          }
          resolveWaiter(params2, "binimum-richsynced");
          resolveWaiter(params2, "binimum-synced");
        }
      }
    }
  }

  // web/src/lyric-parse-utils.ts
  var stringSimilarity = (str1, str2, substringLength = 2, caseSensitive = false) => {
    if (!caseSensitive) {
      str1 = str1.toLowerCase();
      str2 = str2.toLowerCase();
    }
    if (str1.length < substringLength || str2.length < substringLength) return 0;
    const map = /* @__PURE__ */ new Map();
    for (let i = 0; i < str1.length - (substringLength - 1); i++) {
      const substr1 = str1.substring(i, i + substringLength);
      map.set(substr1, map.has(substr1) ? map.get(substr1) + 1 : 1);
    }
    let match = 0;
    for (let j2 = 0; j2 < str2.length - (substringLength - 1); j2++) {
      let substr2 = str2.substring(j2, j2 + substringLength);
      let count = map.has(substr2) ? map.get(substr2) : 0;
      if (count > 0) {
        map.set(substr2, count - 1);
        match++;
      }
    }
    return match * 2 / (str1.length + str2.length - (substringLength - 1) * 2);
  };

  // web/src/catalog.js
  var catalog = { "providers": [{ "key": "bLyrics-richsynced", "name": "Better Lyrics", "type": "syllable" }, { "key": "unison-richsynced", "name": "Unison", "type": "syllable" }, { "key": "binimum-richsynced", "name": "BiniLyrics", "type": "syllable" }, { "key": "unison-wordsynced", "name": "Unison", "type": "word" }, { "key": "portato-richsynced", "name": "Better Lyrics Portato", "type": "word" }, { "key": "spicy-richsynced", "name": "Spicy Lyrics", "type": "syllable" }, { "key": "musixmatch-richsync", "name": "Musixmatch", "type": "word" }, { "key": "bLyrics-synced", "name": "Better Lyrics", "type": "line" }, { "key": "unison-synced", "name": "Unison", "type": "line" }, { "key": "yt-captions", "name": "YouTube Captions", "type": "line" }, { "key": "binimum-synced", "name": "BiniLyrics", "type": "line" }, { "key": "lrclib-synced", "name": "LRCLib", "type": "line" }, { "key": "legato-synced", "name": "Better Lyrics Legato", "type": "line" }, { "key": "spicy-synced", "name": "Spicy Lyrics", "type": "line" }, { "key": "musixmatch-synced", "name": "Musixmatch", "type": "line" }, { "key": "yt-lyrics", "name": "YouTube", "type": "unsynced" }, { "key": "unison-plain", "name": "Unison", "type": "unsynced" }, { "key": "lrclib-plain", "name": "LRCLib", "type": "unsynced" }], "icons": { "syllable": '<svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="636" y="239" width="389.981" height="233.271" rx="48" fill-opacity="0.5"/><path d="M0 335C0 289.745 0 267.118 14.0589 253.059C28.1177 239 50.7452 239 96 239H213C243.17 239 258.255 239 267.627 248.373C277 257.745 277 272.83 277 303V408C277 438.17 277 453.255 267.627 462.627C258.255 472 243.17 472 213 472H96C50.7452 472 28.1177 472 14.0589 457.941C0 443.882 0 421.255 0 376V335Z"/><path d="M337 304C337 273.83 337 258.745 346.373 249.373C355.745 240 370.83 240 401 240H460C505.255 240 527.882 240 541.941 254.059C556 268.118 556 290.745 556 336V377C556 422.255 556 444.882 541.941 458.941C527.882 473 505.255 473 460 473H401C370.83 473 355.745 473 346.373 463.627C337 454.255 337 439.17 337 409V304Z" fill-opacity="0.5"/><rect y="552.271" width="1024" height="233" rx="48" fill-opacity="0.5"/></svg>', "word": '<svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="636" y="239" width="389.981" height="233.271" rx="48" fill-opacity="0.5"/><path d="M0 335C0 289.745 0 267.118 14.0589 253.059C28.1177 239 50.7452 239 96 239H213C243.17 239 258.255 239 267.627 248.373C277 257.745 277 272.83 277 303V408C277 438.17 277 453.255 267.627 462.627C258.255 472 243.17 472 213 472H96C50.7452 472 28.1177 472 14.0589 457.941C0 443.882 0 421.255 0 376V335Z"/><path d="M337 304C337 273.83 337 258.745 346.373 249.373C355.745 240 370.83 240 401 240H460C505.255 240 527.882 240 541.941 254.059C556 268.118 556 290.745 556 336V377C556 422.255 556 444.882 541.941 458.941C527.882 473 505.255 473 460 473H401C370.83 473 355.745 473 346.373 463.627C337 454.255 337 439.17 337 409V304Z"/><rect y="552.271" width="1024" height="233" rx="48" fill-opacity="0.5"/></svg>', "line": '<svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="636" y="239" width="389.981" height="233.271" rx="48"/><path d="M0 335C0 289.745 0 267.118 14.0589 253.059C28.1177 239 50.7452 239 96 239H213C243.17 239 258.255 239 267.627 248.373C277 257.745 277 272.83 277 303V408C277 438.17 277 453.255 267.627 462.627C258.255 472 243.17 472 213 472H96C50.7452 472 28.1177 472 14.0589 457.941C0 443.882 0 421.255 0 376V335Z"/><path d="M337 304C337 273.83 337 258.745 346.373 249.373C355.745 240 370.83 240 401 240H460C505.255 240 527.882 240 541.941 254.059C556 268.118 556 290.745 556 336V377C556 422.255 556 444.882 541.941 458.941C527.882 473 505.255 473 460 473H401C370.83 473 355.745 473 346.373 463.627C337 454.255 337 439.17 337 409V304Z"/><rect y="552.271" width="1024" height="233" rx="48" fill-opacity="0.5"/></svg>', "unsynced": '<svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="636" y="239" width="389.981" height="233.271" rx="48" fill-opacity="0.5"/><path d="M0 335C0 289.745 0 267.118 14.0589 253.059C28.1177 239 50.7452 239 96 239H213C243.17 239 258.255 239 267.627 248.373C277 257.745 277 272.83 277 303V408C277 438.17 277 453.255 267.627 462.627C258.255 472 243.17 472 213 472H96C50.7452 472 28.1177 472 14.0589 457.941C0 443.882 0 421.255 0 376V335Z" fill-opacity="0.5"/><path d="M337 304C337 273.83 337 258.745 346.373 249.373C355.745 240 370.83 240 401 240H460C505.255 240 527.882 240 541.941 254.059C556 268.118 556 290.745 556 336V377C556 422.255 556 444.882 541.941 458.941C527.882 473 505.255 473 460 473H401C370.83 473 355.745 473 346.373 463.627C337 454.255 337 439.17 337 409V304Z" fill-opacity="0.5"/><rect y="552.271" width="1024" height="233" rx="48" fill-opacity="0.5"/></svg>' }, "colors": { "syllable": "#fde69b", "word": "#aad1ff", "line": "#c9f8da", "unsynced": "#b3b3b3" } };
  var controls = { "translate": '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M9 3a1 1 0 0 1 .993.883L10 4v1h4a1 1 0 0 1 .116 1.993L14 7h-1.055c-.223 2.032-1.116 3.99-2.545 5.688q.785.683 1.735 1.266l.386.228l2.067-4.592a1 1 0 0 1 1.763-.115l.06.115l4.5 10a1 1 0 0 1-1.77.924l-.053-.104L18.003 18h-5.007l-1.084 2.41a1 1 0 0 1-1.866-.711l.042-.11l1.61-3.576a15.2 15.2 0 0 1-2.7-1.894c-1.287 1.136-2.848 2.098-4.627 2.81a1 1 0 1 1-.743-1.857c1.557-.623 2.887-1.441 3.972-2.382a11.5 11.5 0 0 1-1.978-3.34a1 1 0 0 1 1.873-.702A9.4 9.4 0 0 0 9 11.244c.989-1.227 1.625-2.576 1.877-3.931L10.928 7H4a1 1 0 0 1-.117-1.993L4 5h4V4a1 1 0 0 1 1-1m8.103 13L15.5 12.437L13.898 16z"/></svg>', "romanize": '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M17 11a1 1 0 0 1 1 1v1h1.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H18v1a1 1 0 1 1-2 0v-1h-1.5a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5H16v-1a1 1 0 0 1 1-1M5 15a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h3a1 1 0 1 1 0 2H7a3 3 0 0 1-3-3v-1a1 1 0 0 1 1-1m14 0h-1v2h1zm-3 0h-1v2h1zM9.5 3a1 1 0 1 1 0 2H5v2h4a1 1 0 0 1 0 2H5v2h5a1 1 0 1 1 0 2H4.1A1.1 1.1 0 0 1 3 11.9V4.1A1.1 1.1 0 0 1 4.1 3ZM17 4a3 3 0 0 1 3 3v2a1 1 0 1 1-2 0V7a1 1 0 0 0-1-1h-3a1 1 0 1 1 0-2Z"/></svg>', "refresh": '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>', "chevron": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>' };

  // web/src/playback-clock.js
  var PlaybackClock = class {
    constructor() {
      this.reset();
    }
    reset() {
      this.initialized = false;
      this.position = 0;
      this.at = 0;
      this.playing = false;
      this.rate = 1;
      this.revision = void 0;
      this.correction = 0;
      this.duration = 1e3;
    }
    read(now) {
      return this.position + (this.playing ? Math.max(0, now - this.at) * this.rate : 0) + this.correction * Math.min(1, Math.max(0, (now - this.at) / this.duration));
    }
    accept(sample, now, wallNow) {
      if (!Number.isFinite(sample.position)) return;
      const playing = sample.playing === true, rate = Number.isFinite(sample.rate) && sample.rate > 0 ? sample.rate : 1;
      const delay = wallNow - sample.sampledAt;
      const age = Number.isFinite(delay) && delay >= 0 && delay <= 1e3 ? delay : 0;
      const target = sample.position + (playing ? age * rate : 0), predicted = this.read(now), error = target - predicted;
      const discontinuity = Number.isFinite(sample.revision) && this.revision !== void 0 && sample.revision !== this.revision;
      const snap = !this.initialized || !playing || playing !== this.playing || rate !== this.rate || discontinuity || Math.abs(error) > 750;
      this.position = snap ? target : predicted;
      this.at = now;
      this.playing = playing;
      this.rate = rate;
      this.revision = sample.revision;
      this.initialized = true;
      this.correction = snap || Math.abs(error) < 8 ? 0 : Math.max(-120, Math.min(120, error));
      this.duration = Math.max(1e3, Math.abs(this.correction) / (0.08 * rate));
    }
  };

  // web/src/frame-budget.js
  var FrameBudget = class {
    constructor() {
      this.reset(0);
    }
    reset(now) {
      this.last = 0;
      this.nominal = 1e3 / 60;
      this.frames = 0;
      this.late = 0;
      this.worst = 0;
      this.reportAt = now + 3e4;
      this.warmUntil = now + 1500;
    }
    sample(now, playing) {
      if (!playing) {
        this.last = 0;
        return;
      }
      const gap = this.last ? now - this.last : 0;
      this.last = now;
      if (gap <= 0 || now < this.warmUntil) return;
      this.frames++;
      this.worst = Math.max(this.worst, gap);
      if (gap > Math.max(20, this.nominal * 1.8)) this.late++;
      this.nominal += (Math.min(gap, this.nominal * 2) - this.nominal) * 0.05;
      if (now < this.reportAt) return;
      const report = this.late ? `Callback gaps: ${this.late}/${this.frames}; worst ${this.worst.toFixed(1)} ms; estimated interval ${this.nominal.toFixed(1)} ms` : void 0;
      this.frames = 0;
      this.late = 0;
      this.worst = 0;
      this.reportAt = now + 3e4;
      return report;
    }
  };

  // web/src/render-diagnostics.js
  var RenderDiagnostics = class {
    constructor(log) {
      this.log = log;
      this.enabled = false;
      this.last = 0;
      this.index = -1;
      this.schedule = [];
      this.gaps = [];
      this.frames = 0;
      this.gapMax = 0;
      this.cpuMax = 0;
      this.reportAt = 0;
      this.nominal = 1e3 / 60;
    }
    enable(value) {
      if (this.enabled === value) return;
      this.enabled = value;
      this.last = 0;
      this.frames = 0;
      this.gaps = [];
      this.reportAt = 0;
      this.log("Debug", value ? "Renderer diagnostics enabled" : "Renderer diagnostics disabled");
    }
    pause() {
      this.last = 0;
      this.frames = 0;
      this.gaps = [];
      this.reportAt = 0;
      this.gapMax = this.cpuMax = 0;
    }
    lines(lines) {
      this.schedule = lines.map((line, index) => ({ time: line.time, index })).filter((x) => Number.isFinite(x.time)).sort((a, b) => a.time - b.time);
      this.index = -1;
    }
    sample(now, position, cpu, playing) {
      if (!this.enabled || !playing) {
        this.pause();
        return;
      }
      const gap = this.last ? now - this.last : 0;
      this.last = now;
      if (gap > 0) {
        this.gaps.push(gap);
        if (this.gaps.length > 120) this.gaps.shift();
        this.gapMax = Math.max(this.gapMax, gap);
        this.frames++;
      }
      this.cpuMax = Math.max(this.cpuMax, cpu);
      let lo = 0, hi = this.schedule.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (this.schedule[mid].time <= position) lo = mid + 1;
        else hi = mid;
      }
      const index = lo ? this.schedule[lo - 1].index : -1;
      if (index !== this.index) {
        this.log("Line-transition", `line=${index} playbackMs=${Math.round(position * 1e3)} callbackGapMs=${gap.toFixed(1)} tickCpuMs=${cpu.toFixed(2)}`);
        this.index = index;
      }
      if (!this.reportAt) this.reportAt = now + 2e3;
      if (now >= this.reportAt) {
        const sorted = [...this.gaps].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)] || 0;
        this.log("Renderer-cadence", `line=${index} samples=${this.frames} intervalMedianMs=${median.toFixed(1)} callbackGapMaxMs=${this.gapMax.toFixed(1)} tickCpuMaxMs=${this.cpuMax.toFixed(2)} estimatedFps=${median ? (1e3 / median).toFixed(1) : 0}; callback cadence is not a dropped-frame count`);
        this.frames = 0;
        this.gapMax = this.cpuMax = 0;
        this.reportAt = now + 2e3;
      }
    }
  };

  // web/src/lookup-status.js
  function lookupMessage(recording, health, parsing2, slow2, decodingFailed2) {
    if (!recording) return "Play a song to see lyrics.";
    if (parsing2 || health.pending > 0 && !slow2 && health.waiting < health.pending) return "Looking for lyrics\u2026";
    if (health.pending > 0) return "Still checking for lyrics\u2026";
    if (health.connectionNeeded) return "Some lyric sources are still verifying.";
    if (health.metadataMissing) return "Track details unavailable. Lyrics couldn\u2019t be checked.";
    if (decodingFailed2 || health.found) return "No readable lyrics available.";
    if (health.failed) return "Couldn\u2019t check all lyric sources. Try refreshing.";
    return "No lyrics found.";
  }

  // web/src/unison-source.js
  var origin = "https://unison.betterlyrics.org";
  function unisonContributors(data) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(data?.videoId ?? "")) return [];
    const credits = [{ label: "Lyrics from Unison", url: origin + "/song/" + data.videoId }];
    const { displayName, keyId } = data.submitter ?? {};
    if (typeof displayName === "string" && displayName.trim() && /^[A-Za-z0-9_-]{1,128}$/.test(keyId ?? "")) {
      credits.push({ label: "Submitted by " + displayName.trim().slice(0, 160), url: origin + "/curator/" + keyId });
    }
    return credits;
  }

  // web/src/main.js
  var PRIORITY = catalog.providers.map(({ key }) => key);
  var $ = (id) => document.getElementById(id);
  var native = window.BDNative;
  var settings = {
    fontSize: 28,
    letterWave: true,
    wordSync: true,
    background: true,
    bgSize: 0.65,
    bgOpacity: 0.7,
    agents: {},
    translation: false,
    romanization: false,
    language: "en",
    passive: false,
    tapSeek: true,
    reducedMotion: false
  };
  var generation = -1;
  var params;
  var selected = "";
  var pinned = "";
  var currentResult;
  var clock = new PlaybackClock();
  var frameBudget = new FrameBudget();
  var diagnostics = new RenderDiagnostics((source, message) => native?.diagnostic(generation, source, message));
  var sourceHealth = { pending: 1, waiting: 0 };
  var parsing = 0;
  var slow = false;
  var decodingFailed = false;
  var slowTimer;
  var lastHealthLabel = "";
  var resultSignatures = /* @__PURE__ */ new WeakMap();
  var seenPayloads = /* @__PURE__ */ new Set();
  var seenPayloadBytes = 0;
  function signature(result) {
    if (!resultSignatures.has(result)) resultSignatures.set(result, JSON.stringify([result.source, result.language, result.songwriters, result.contributors, result.lyrics]));
    return resultSignatures.get(result);
  }
  function updateHealth() {
    const pending = Math.max(0, sourceHealth.pending || 0) + parsing, found = availableKeys.length > 0;
    const color = pending || sourceHealth.connectionNeeded || found && sourceHealth.failed ? "orange" : found ? "green" : "red";
    const emptyMessage = lookupMessage(params?.videoId, sourceHealth, parsing, slow, decodingFailed);
    if (!selected && !found) {
      const empty = $("empty");
      if (empty.textContent !== emptyMessage) empty.textContent = emptyMessage;
      empty.hidden = false;
    }
    const message = found ? pending ? "Checking more sources" : sourceHealth.failed ? "Some sources unavailable" : "Checks complete" : emptyMessage;
    const label = `${message} ${availableKeys.length} lyric formats available.`;
    if (lastHealthLabel === color + "|" + label) return;
    lastHealthLabel = color + "|" + label;
    $("source-health").dataset.state = color;
    $("source-health").setAttribute("aria-label", label);
    $("connect").hidden = !sourceHealth.connectionNeeded;
    $("source-summary").textContent = `${availableKeys.length} ${availableKeys.length === 1 ? "format" : "formats"} \xB7 ${message}`;
    if (!selected && !found) $("source-name").textContent = pending ? "Checking sources" : "Lyric sources";
  }
  var active = true;
  var raf = 0;
  var enrichmentGeneration = 0;
  var availableKeys = [];
  var autoPreferred = "";
  var collapsed = false;
  var reportedMismatches = /* @__PURE__ */ new Set();
  var icon = (key) => catalog.icons[catalog.providers.find((p) => p.key === key)?.type] || "";
  var config = (key) => catalog.providers.find((p) => p.key === key);
  function svgInto(target, svg) {
    target.replaceChildren();
    if (!svg) return;
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (!doc.querySelector("parsererror")) target.appendChild(document.importNode(doc.documentElement, true));
  }
  for (const [key, svg] of Object.entries(controls)) {
    if ($(key)) svgInto($(key), svg);
  }
  svgInto($("collapse"), controls.chevron);
  svgInto($("copy"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="12" height="15" rx="1.5"/><path d="M4 7v14h12"/></svg>');
  var arrow = (direction) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${direction < 0 ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"}"/></svg>`;
  svgInto($("previous"), arrow(-1));
  svgInto($("next"), arrow(1));
  for (const [id, path] of [["earlier", "M5 12h14"], ["later", "M5 12h14M12 5v14"]]) svgInto($(id), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="${path}"/></svg>`);
  document.body.appendChild($("source-menu"));
  $("dock").prepend($("resume"));
  var menuCloseTimer;
  var menuEpoch = 0;
  function closeSources() {
    const menu = $("source-menu");
    menuEpoch++;
    clearTimeout(menuCloseTimer);
    menu.classList.remove("open");
    menu.inert = true;
    $("source-label").setAttribute("aria-expanded", "false");
    menuCloseTimer = setTimeout(() => {
      menu.hidden = true;
    }, settings.reducedMotion ? 0 : 160);
  }
  function positionSources() {
    const menu = $("source-menu"), rect = $("source-label").getBoundingClientRect();
    menu.style.maxHeight = `${Math.max(48, Math.min(240, rect.top - 16))}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left - 4, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.bottom = `${innerHeight - rect.top + 8}px`;
  }
  function openSources() {
    if (!availableKeys.length) return;
    clearTimeout(menuCloseTimer);
    const epoch = ++menuEpoch, menu = $("source-menu");
    menu.hidden = false;
    menu.inert = false;
    positionSources();
    requestAnimationFrame(() => {
      if (epoch === menuEpoch) menu.classList.add("open");
    });
    $("source-label").setAttribute("aria-expanded", "true");
  }
  function selectSource(key) {
    pinned = key === autoPreferred ? "" : key;
    native?.pin(generation, pinned);
    closeSources();
    choose(true);
  }
  var dockSignature = "";
  function updateDock() {
    updateHealth();
    const key = selected + "|" + availableKeys.join("|");
    if (dockSignature === key) return;
    dockSignature = key;
    const entry = config(selected), i = availableKeys.indexOf(selected);
    $("source-name").textContent = entry?.name || (availableKeys.length ? "Choose a source" : sourceHealth.pending ? "Checking sources" : "Lyric sources");
    $("source-position").textContent = i < 0 ? "" : `${i + 1}/${availableKeys.length}`;
    svgInto($("source-icon"), icon(selected));
    $("source-icon").style.color = catalog.colors[entry?.type] || "inherit";
    $("previous").disabled = $("next").disabled = availableKeys.length < 2;
    const menu = $("source-menu");
    menu.replaceChildren();
    menu.style.setProperty("--dock-accent", catalog.colors[entry?.type] || "#fde69b");
    for (const key2 of availableKeys) {
      const p = config(key2), button = document.createElement("button"), image = document.createElement("span"), label = document.createElement("span");
      svgInto(image, icon(key2));
      image.style.color = catalog.colors[p.type];
      label.textContent = p.name;
      button.append(image, label);
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", String(key2 === selected));
      button.setAttribute("aria-label", `${p.name}, ${p.type}`);
      button.classList.toggle("selected", key2 === selected);
      button.onclick = () => selectSource(key2);
      menu.append(button);
    }
    if (menu.classList.contains("open")) positionSources();
  }
  function setCollapsed(value, persist = false) {
    value = value === true;
    if (collapsed === value && dockSignature) return;
    collapsed = value;
    $("dock").classList.toggle("collapsed", collapsed);
    $("collapse").setAttribute("aria-expanded", String(!collapsed));
    $("collapse").setAttribute("aria-label", collapsed ? "Expand lyrics controls" : "Collapse lyrics controls");
    $("dock-content").inert = collapsed;
    closeSources();
    if (persist) native?.dock(collapsed);
  }
  var dockLayoutTimer;
  var lastDockClearance = -1;
  function settleDockLayout() {
    clearTimeout(dockLayoutTimer);
    const height = Math.round(innerHeight - $("dock").getBoundingClientRect().top + 12);
    if (height === lastDockClearance) return;
    lastDockClearance = height;
    document.documentElement.style.setProperty("--dock-clearance", `${height}px`);
    renderer.relayout(false);
  }
  var dockResize = new ResizeObserver(() => {
    if ($("source-menu").classList.contains("open")) positionSources();
    if (!$("connection").hidden) positionStatus();
    clearTimeout(dockLayoutTimer);
    dockLayoutTimer = setTimeout(settleDockLayout, 64);
  });
  $("dock-content").addEventListener("transitionend", (event) => {
    if (event.propertyName === "grid-template-rows") settleDockLayout();
  });
  var enrichmentRequested = /* @__PURE__ */ new Set();
  function resumeFollow() {
    renderer.resumeAutoscroll();
  }
  var renderer = createLyricsRenderer({ document, window, mount: $("lyrics"), host: {
    getScrollElement: () => $("scroll"),
    isViewVisible: () => active && !document.hidden,
    setResumeAffordanceVisible: (visible) => $("resume").hidden = !visible,
    seek: (seconds) => {
      if (settings.tapSeek) {
        native?.seek(generation, Math.round(seconds * 1e3));
        resumeFollow();
      }
    },
    log: (message) => native?.diagnostic(generation, "Renderer", String(message).slice(0, 240))
  } });
  function theme() {
    const css = `/* blyrics-letter-wave = ${settings.letterWave && !settings.reducedMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches};
    blyrics-disable-richsync = ${!settings.wordSync}; */`;
    const rebuild = renderer.setTheme(css);
    const root = document.documentElement.style;
    root.setProperty("--blyrics-font-size", `${settings.fontSize}px`);
    root.setProperty("--bd-bg-size", String(settings.bgSize));
    root.setProperty("--bd-bg-opacity", String(settings.bgOpacity));
    document.body.classList.toggle("no-background", !settings.background);
    document.body.classList.toggle("reduce-motion", settings.reducedMotion);
    const rules = [];
    if (["left", "center", "right"].includes(settings.bgAlignment)) rules.push(`.blyrics-background-line{text-align:${settings.bgAlignment}}`);
    for (const [agent, alignment] of Object.entries(settings.agents || {})) {
      if (!/^v\d+$/.test(agent) || !["left", "center", "right"].includes(alignment)) continue;
      const origin2 = alignment === "center" ? "center" : alignment;
      rules.push(`.blyrics--line[data-agent="${agent}"]{text-align:${alignment};transform-origin:${origin2} center}`);
      rules.push(`.blyrics--line[data-agent="${agent}"]>.blyrics--romanized{margin-left:${alignment === "left" ? "0" : "auto"};margin-right:${alignment === "right" ? "0" : "auto"}}`);
    }
    $("agents").textContent = rules.join("\n");
    return rebuild;
  }
  function parsePayload(payload) {
    const text = payload.raw;
    if (payload.format === "ttml") return Xt(text, { songDurationMs: params.duration * 1e3 }).lyrics;
    if (payload.format === "lrc") return jt(text, params.duration * 1e3);
    if (payload.format === "qrc") return qt(text, params.duration * 1e3, { title: params.song, artist: params.artist });
    if (payload.lyrics) return payload.lyrics;
    return Ut.parse(text || "");
  }
  function put(key, result) {
    if (!params?.sourceMap[key] || !result?.lyrics?.length) return;
    if (result.lyrics.length > 2e3) throw Error("Too many lyric lines");
    params.sourceMap[key].lyricSourceResult = result;
  }
  function showCredits(result) {
    const footer = $("credits");
    footer.replaceChildren(...(result?.contributors || []).map(({ label, url }) => {
      const credit = document.createElement(url ? "a" : "span");
      credit.textContent = label;
      if (url) {
        credit.href = url;
        credit.onclick = (event) => {
          event.preventDefault();
          native?.openContributor(generation, url);
        };
      }
      return credit;
    }));
    footer.hidden = !footer.childElementCount;
  }
  var chooseFrame = 0;
  function queueChoice() {
    if (chooseFrame) return;
    chooseFrame = requestAnimationFrame(() => {
      chooseFrame = 0;
      choose();
    });
  }
  function choose(force = false) {
    if (!params) return;
    const custom = Array.isArray(settings.priority) ? settings.priority.filter((k2) => PRIORITY.includes(k2)) : [];
    const disabled = new Set(settings.disabled || []);
    const order = [.../* @__PURE__ */ new Set([...custom, ...PRIORITY])].filter((key2) => !disabled.has(key2));
    const baseline = params.sourceMap["yt-lyrics"]?.lyricSourceResult?.lyrics;
    const reference = baseline?.map((line) => line.words).join("\n");
    const available = order.filter((key2) => params.sourceMap[key2]?.lyricSourceResult?.lyrics?.length);
    const automatic = available.filter((key2) => {
      const result2 = params.sourceMap[key2]?.lyricSourceResult;
      if (!result2?.lyrics?.length) return false;
      if (!reference || key2 === "yt-lyrics" || key2.startsWith("unison-")) return true;
      const accepted = stringSimilarity(result2.lyrics.map((line) => line.words + "\n").join(""), reference) >= 0.5;
      if (!accepted && !reportedMismatches.has(key2)) {
        reportedMismatches.add(key2);
        native?.diagnostic(generation, key2, "Automatic match rejected; received lyrics remain available for manual selection");
      }
      return accepted;
    });
    if (available.join("|") !== availableKeys.join("|")) $("sources").replaceChildren(...available.map((key2) => {
      const option = document.createElement("option");
      option.value = key2;
      option.textContent = params.sourceMap[key2].lyricSourceResult.source + " \xB7 " + key2.split("-").slice(1).join("-");
      return option;
    }));
    autoPreferred = automatic[0] || "";
    const key = available.includes(pinned) ? pinned : autoPreferred;
    availableKeys = available;
    if (!key) {
      if (currentResult) {
        renderer.clear();
        showCredits(null);
      }
      selected = "";
      currentResult = null;
      updateDock();
      $("sources").value = "";
      if (available.length) {
        $("empty").textContent = "These lyrics differ from YouTube Music. Choose a source to use them.";
        $("empty").hidden = false;
        native?.displayed(generation, "choose-source");
      }
      return;
    }
    $("sources").value = key;
    const result = params.sourceMap[key].lyricSourceResult;
    if (!force && key === selected && (result === currentResult || currentResult && signature(result) === signature(currentResult))) {
      params.sourceMap[key].lyricSourceResult = currentResult;
      updateDock();
      return;
    }
    const first = !currentResult;
    selected = key;
    currentResult = result;
    updateDock();
    renderer.setLyrics(result.lyrics, { songKey: params.videoId, language: result.language, songwriters: result.songwriters });
    diagnostics.lines(renderer.lines);
    decorate();
    showCredits(result);
    $("status").textContent = result.source;
    $("status").title = key;
    $("empty").hidden = true;
    if (first && !settings.reducedMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      $("lyrics").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    native?.displayed(generation, key);
    enrichMissing();
  }
  function translationFor(line, language) {
    const translations = line.translations || {};
    const key = Object.keys(translations).find((key2) => key2 === language) || Object.keys(translations).find((key2) => key2.split("-")[0] === language.split("-")[0]);
    if (key) return { text: translations[key], language: key };
    if (line.translation?.text && (!line.translation.lang || line.translation.lang.split("-")[0] === language.split("-")[0])) return { text: line.translation.text, language: line.translation.lang || language };
    return null;
  }
  function enrichMissing() {
    if (!native?.enrich || !currentResult || !settings.translation && !settings.romanization) return;
    const requestKey = `${generation}|${selected}|${settings.language}`;
    if (enrichmentRequested.has(requestKey)) return;
    const missing = currentResult.lyrics.some((line) => !line.isInstrumental && (settings.translation && !translationFor(line, settings.language) || settings.romanization && !line.romanization));
    if (!missing) return;
    enrichmentRequested.add(requestKey);
    for (let start = 0; start < currentResult.lyrics.length; start += 200) {
      const lines = currentResult.lyrics.slice(start, start + 200).map((line) => line.isInstrumental ? "" : line.words);
      if (lines.some((line) => line.length > 500)) continue;
      native.enrich(generation, selected, JSON.stringify({ lines, to: settings.language, videoId: params.videoId, start }));
    }
  }
  function decorate() {
    const lines = $("lyrics").querySelectorAll(".blyrics--line");
    currentResult?.lyrics.forEach((lyric, index) => {
      const line = lines[index];
      if (!line) return;
      if (settings.translation) {
        const translated = translationFor(lyric, settings.language);
        if (translated) injectTranslation(document, line, translated.text, translated.language);
      }
      if (settings.romanization && lyric.romanization) {
        injectRomanization(document, line, renderer.lines[index], lyric.romanization, lyric.timedRomanization);
      }
    });
  }
  function renderFrame(now) {
    raf = 0;
    if (!active || document.hidden) return;
    if (!clock.initialized) {
      raf = requestAnimationFrame(renderFrame);
      return;
    }
    if (diagnostics.enabled) {
      const timing = frameBudget.sample(now, clock.playing);
      if (timing) native?.diagnostic(generation, "Frame-timing", timing);
    }
    const position = clock.read(now);
    const before = diagnostics.enabled ? performance.now() : 0;
    renderer.tick(position / 1e3, {
      eventCreationTime: Date.now(),
      isPlaying: clock.playing,
      playbackRate: clock.rate,
      passiveScrollEnabled: settings.passive,
      smoothScroll: !settings.reducedMotion,
      followPausedSeeks: true,
      countEveryUserScroll: true
    });
    diagnostics.sample(now, position / 1e3, diagnostics.enabled ? performance.now() - before : 0, clock.playing);
    raf = requestAnimationFrame(renderFrame);
  }
  function startClock() {
    if (!raf && active && !document.hidden) raf = requestAnimationFrame(renderFrame);
  }
  window.BDC = {
    debug(value) {
      if (diagnostics.enabled !== (value === true)) frameBudget.reset(performance.now());
      diagnostics.enable(value === true);
    },
    track(track) {
      cancelAnimationFrame(chooseFrame);
      chooseFrame = 0;
      for (const animation of $("lyrics").getAnimations()) animation.cancel();
      reportedMismatches.clear();
      autoPreferred = "";
      seenPayloads = /* @__PURE__ */ new Set();
      seenPayloadBytes = 0;
      clock.reset();
      frameBudget.reset(performance.now());
      sourceHealth = { pending: 1, waiting: 0 };
      parsing = 0;
      slow = false;
      decodingFailed = false;
      lastHealthLabel = "";
      clearTimeout(slowTimer);
      $("notice").textContent = "";
      $("connection").hidden = true;
      $("source-health").setAttribute("aria-expanded", "false");
      generation = track.generation;
      selected = "";
      pinned = track.preferredSource || "";
      currentResult = null;
      enrichmentGeneration++;
      enrichmentRequested.clear();
      params = {
        song: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        videoId: track.videoId,
        sourceMap: Object.fromEntries([...PRIORITY, "metadata"].map((key) => [key, { filled: false, lyricSourceResult: null }]))
      };
      renderer.clear();
      resetPlaybackClock();
      renderer.resumeAutoscroll();
      $("resume").hidden = true;
      closeSources();
      showCredits(null);
      availableKeys = [];
      updateDock();
      $("sources").replaceChildren();
      $("status").textContent = "";
      const expected = generation;
      if (track.videoId) slowTimer = setTimeout(() => {
        if (expected === generation) {
          slow = true;
          updateHealth();
        }
      }, 12e3);
      $("track").textContent = track.title + " \xB7 " + track.artist;
    },
    metadata(track) {
      if (!params || track.generation !== generation || track.videoId !== params.videoId) return;
      Object.assign(params, { song: track.title, artist: track.artist, album: track.album, duration: track.duration });
      $("track").textContent = [track.title, track.artist].filter(Boolean).join(" \xB7 ");
    },
    async source(id, payload) {
      if (id !== generation || !params) return;
      const expected = params, cache = seenPayloads;
      const payloadKey = JSON.stringify(payload.event === "provider" ? [payload.event, payload.data?.provider, payload.data?.results, payload.data?.error] : payload);
      if (cache.has(payloadKey)) return;
      const cached = cache.size < 128 && seenPayloadBytes + payloadKey.length * 2 <= 1024 * 1024;
      if (cached) {
        cache.add(payloadKey);
        seenPayloadBytes += payloadKey.length * 2;
      }
      parsing++;
      updateHealth();
      const previous = new Map(PRIORITY.filter((key) => expected.sourceMap[key]?.lyricSourceResult?.lyrics?.length).map((key) => [key, expected.sourceMap[key].lyricSourceResult]));
      try {
        if (payload.event) {
          await processStreamData(payload.event, payload.data, expected);
          if (id !== generation || params !== expected) return;
        } else if (payload.kind === "cachedResult") {
          if (payload.result?.lyrics?.length) put(payload.key, payload.result);
        } else if (payload.kind === "unison") {
          const data = payload.data?.data || payload.data;
          const contributors = unisonContributors(data);
          if (data.format === "ttml") fillTtml(data.lyrics, params, { richsyncKey: "unison-richsynced", syncedKey: "unison-synced", source: "Unison", sourceHref: "https://unison.betterlyrics.org", cacheAllowed: false, contributors });
          else if (data.lyrics) put(
            data.format === "plain" ? "unison-plain" : data.syncType === "richsync" ? "unison-wordsynced" : "unison-synced",
            { lyrics: data.format === "plain" ? Ut.parse(data.lyrics) : jt(data.lyrics, params.duration * 1e3), source: "Unison", contributors }
          );
        } else {
          const lyrics = parsePayload(payload);
          let key = payload.key;
          if (payload.format === "ttml" && key?.endsWith("-richsynced")) {
            const parsed = Xt(payload.raw, { songDurationMs: params.duration * 1e3 });
            if (!parsed.isWordSynced) key = key.replace("-richsynced", "-synced");
          }
          const contributors = key?.startsWith("unison-") ? unisonContributors(payload.sourceMetadata) : payload.contributors;
          put(key, { ...payload, lyrics, contributors });
        }
        for (const [key, result] of previous) if (!expected.sourceMap[key]?.lyricSourceResult?.lyrics?.length) expected.sourceMap[key].lyricSourceResult = result;
        if (payload.kind !== "cachedResult") for (const key of PRIORITY) {
          const result = expected.sourceMap[key]?.lyricSourceResult;
          if (!key.startsWith("spicy-") && result?.lyrics?.length && result !== previous.get(key)) native?.cacheResult?.(generation, key, JSON.stringify(result));
        }
        queueChoice();
      } catch (error) {
        if (cached) {
          cache.delete(payloadKey);
          if (params === expected) seenPayloadBytes -= payloadKey.length * 2;
        }
        if (id !== generation || params !== expected) return;
        for (const [key, result] of previous) if (!expected.sourceMap[key]?.lyricSourceResult?.lyrics?.length) expected.sourceMap[key].lyricSourceResult = result;
        queueChoice();
        native?.diagnostic(generation, payload.key || payload.event || payload.kind || "unknown", String(error?.message || error).slice(0, 240));
        decodingFailed = true;
      } finally {
        if (params === expected) {
          parsing = Math.max(0, parsing - 1);
          updateHealth();
        }
      }
    },
    insets(value) {
      for (const key of ["left", "right", "bottom"]) document.documentElement.style.setProperty(`--safe-${key}`, `${Math.max(0, Number(value[key]) || 0)}px`);
      settleDockLayout();
      if (!$("connection").hidden) positionStatus();
    },
    state(sample) {
      if (sample.generation !== generation) return;
      clock.accept(sample, performance.now(), Date.now());
      if (typeof sample.visible === "boolean") window.BDC.visible(sample.visible);
      startClock();
    },
    visible(visible) {
      const next = visible === true;
      if (active === next) return;
      active = next;
      if (!active) {
        diagnostics.pause();
        cancelAnimationFrame(raf);
        raf = 0;
      }
      renderer.noteVisibilityChange();
      if (active) {
        frameBudget.reset(performance.now());
        renderer.relayout();
        startClock();
      }
    },
    settings(next) {
      const rebuild = ["translation", "romanization", "language"].some((key) => key in next && next[key] !== settings[key]);
      const visual = ["fontSize", "letterWave", "wordSync", "background", "bgSize", "bgOpacity", "bgAlignment", "agents", "reducedMotion"];
      const changed = visual.some((key) => key in next && JSON.stringify(next[key]) !== JSON.stringify(settings[key]));
      if ("offset" in next && next.offset !== settings.offset) clock.initialized = false;
      settings = { ...settings, ...next };
      const themeRebuild = changed ? theme() : false;
      choose(rebuild || themeRebuild);
      if (changed || rebuild) renderer.relayout();
      setCollapsed(settings.dockCollapsed);
      for (const [key, url] of Object.entries(next.buttonIcons || {})) {
        if (!$(key) || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url)) continue;
        if ($(key).firstElementChild?.getAttribute("src") === url) continue;
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        $(key).replaceChildren(img);
      }
      if (next.pillColor) document.documentElement.style.setProperty("--bd-pill", next.pillColor);
      $("translate").ariaPressed = String(settings.translation);
      $("romanize").ariaPressed = String(settings.romanization);
      $("offset").textContent = `${settings.offset || 0} ms`;
      if (next.textColor) {
        const style = document.documentElement.style;
        style.setProperty("--bd-status-bg", /^#(?:f|e|d|c|b|a)/i.test(next.textColor) ? "rgba(28,28,32,.96)" : "rgba(248,248,250,.97)");
        style.setProperty("--blyrics-text-color", next.textColor);
        style.setProperty("--bd-foreground", next.textColor);
        if (/^#[0-9a-f]{6}$/i.test(next.textColor)) {
          const color = parseInt(next.textColor.slice(1), 16), rgb = `${color >> 16},${color >> 8 & 255},${color & 255}`;
          style.setProperty("--blyrics-lyric-active-color", next.textColor);
          style.setProperty("--blyrics-lyric-inactive-color", `rgba(${rgb},.3)`);
          style.setProperty("--blyrics-glow-color", `rgba(${rgb},.5)`);
          style.setProperty("--blyrics-translated-color", `rgba(${rgb},.6)`);
        }
      }
    },
    enrichment(id, key, start, language, response) {
      if (id !== generation || key !== selected || !currentResult || !Array.isArray(response.lines)) return;
      response.lines.forEach((data, index) => {
        const line = currentResult.lyrics[start + index];
        if (!line || line.isInstrumental) return;
        if (data.translation && data.needsTranslation) {
          line.translations ??= {};
          line.translations[language] ??= data.translation;
        }
        if (data.romanization && !line.romanization) line.romanization = data.romanization;
      });
      choose(true);
    },
    health(id, status) {
      if (id !== generation) return;
      sourceHealth = status;
      updateHealth();
    },
    notice(id, message) {
      if (id === generation) $("notice").textContent = message;
    },
    dispose() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(chooseFrame);
      clearTimeout(dockLayoutTimer);
      clearTimeout(slowTimer);
      dockResize.disconnect();
      renderer.destroy();
    }
  };
  var statusCloseTimer;
  function closeStatus() {
    clearTimeout(statusCloseTimer);
    $("connection").hidden = true;
    $("source-health").setAttribute("aria-expanded", "false");
  }
  function positionStatus() {
  }
  $("source-health").onclick = () => {
    const open = $("connection").hidden;
    closeStatus();
    if (!open) return;
    closeSources();
    $("connection").hidden = false;
    if (!settings.reducedMotion) $("connection").animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 160 });
    $("source-health").setAttribute("aria-expanded", "true");
    positionStatus();
    statusCloseTimer = setTimeout(() => {
      if (!$("connection").contains(document.activeElement)) closeStatus();
    }, 6e3);
  };
  $("sources").addEventListener("change", () => {
    pinned = $("sources").value;
    native?.pin(generation, pinned);
    choose(true);
  });
  $("source-label").onclick = () => {
    $("source-label").getAttribute("aria-expanded") === "true" ? closeSources() : openSources();
  };
  document.addEventListener("click", (event) => {
    if (!$("connection").contains(event.target) && !$("source-health").contains(event.target)) {
      $("connection").hidden = true;
      $("source-health").setAttribute("aria-expanded", "false");
    }
    if (!$("source-menu").contains(event.target) && !$("source-label").contains(event.target)) closeSources();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("connection").hidden) {
      $("connection").hidden = true;
      $("source-health").setAttribute("aria-expanded", "false");
      $("source-health").focus();
      return;
    }
    if ($("source-label").getAttribute("aria-expanded") !== "true") return;
    if (event.key === "Escape") {
      closeSources();
      $("source-label").focus();
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...$("source-menu").children], i = items.indexOf(document.activeElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (i + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  });
  window.addEventListener("resize", () => {
    if ($("source-menu").classList.contains("open")) positionSources();
    if (!$("connection").hidden) positionStatus();
  });
  for (const [id, direction] of [["previous", -1], ["next", 1]]) $(id).onclick = () => {
    if (availableKeys.length > 1) selectSource(availableKeys[(Math.max(0, availableKeys.indexOf(selected)) + direction + availableKeys.length) % availableKeys.length]);
  };
  $("collapse").onclick = () => setCollapsed(!collapsed, true);
  $("copy").onclick = () => native?.copy(generation, (currentResult?.lyrics || []).map((line) => line.words).join("\n").slice(0, 1e5));
  $("refresh").addEventListener("click", () => native?.refresh(generation));
  $("connect").addEventListener("click", () => native?.connect());
  $("resume").addEventListener("click", resumeFollow);
  for (const kind of ["translate", "romanize"]) $(kind).addEventListener("click", () => native?.toggle(kind));
  $("earlier").addEventListener("click", () => native?.offset(generation, -100));
  $("later").addEventListener("click", () => native?.offset(generation, 100));
  $("scroll").addEventListener("scroll", () => renderer.noteUserScroll(), { passive: true });
  document.addEventListener("visibilitychange", () => {
    diagnostics.pause();
    frameBudget.reset(performance.now());
    renderer.noteVisibilityChange();
    if (!document.hidden) startClock();
  });
  dockResize.observe($("dock"));
  theme();
  startClock();
  native?.ready();
})();
/*! Bundled license information:

@braccato/parsers/dist/index.js:
  (**
   * @author Stephen Brown
   * Source: https://github.com/stephenjjbrown/string-similarity-js/
   * @license MIT License - https://github.com/stephenjjbrown/string-similarity-js/blob/master/LICENSE.md
   * @param str1 First string to match
   * @param str2 Second string to match
   * @param [substringLength=2] Optional. Length of substring to be used in calculating similarity. Default 2.
   * @param [caseSensitive=false] Optional. Whether you want to consider case in string matching. Default false;
   * @returns Number between 0 and 1, with 0 being a low match score.
   *)
*/
