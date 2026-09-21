/**
 * Hover popovers, with nesting.
 *
 * Add `data-popover="Some extra info"` to any link on the page. The script
 * wraps that link and shows an anchored bubble on hover, on keyboard focus,
 * or when its [?] marker is tapped.
 *
 * The body accepts inline HTML, so <a>, <code> and <em> all work — and a link
 * inside a popover can carry its own data-popover, which opens a second
 * popover on top of the first. Each nesting level takes the next Dracula
 * accent colour, so you can see how deep the rabbit hole goes.
 *
 * Optional attributes:
 *   data-popover-label="Blog"      Header text (defaults to the link's text)
 *   data-popover-accent="#50fa7b"  Force a specific accent colour
 *   data-popover-size="wide"       A roomier bubble, for images
 *   data-popover-ref="#id"         Take the body from a <template> instead of
 *                                  the attribute. Use this when the popover
 *                                  contains links, so you don't have to
 *                                  escape HTML inside an attribute.
 */
(function () {
  "use strict";

  var OPEN_DELAY = 90;
  var CLOSE_DELAY = 220;
  var GAP = 14;
  var EDGE = 12;
  var BASE_Z = 100;
  var TRIGGERS = "[data-popover], [data-popover-ref]";

  var PALETTE = [
    "--dracula-purple",
    "--dracula-pink",
    "--dracula-green",
    "--dracula-cyan",
    "--dracula-orange",
    "--dracula-yellow",
    "--dracula-red",
  ];

  var canHover = window.matchMedia("(hover: hover)").matches;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var stack = []; // innermost popover last
  var palette = [];
  var inlineIndex = 0; // walks the palette for inline triggers
  var openTimer = null;
  var closeTimer = null;
  var uid = 0;

  /* ---------------------------------------------------------------- utils */

  function resolvePalette() {
    var root = getComputedStyle(document.documentElement);
    palette = PALETTE.map(function (name) {
      return root.getPropertyValue(name).trim();
    });
  }

  function isKeyboardFocus(el) {
    // Avoids opening twice when a marker is clicked with a mouse or tapped.
    try {
      return el.matches(":focus-visible");
    } catch (err) {
      return true;
    }
  }

  function isHovered(el) {
    try {
      return el.matches(":hover");
    } catch (err) {
      return false;
    }
  }

  function labelFor(link) {
    var explicit = link.getAttribute("data-popover-label");
    if (explicit) return explicit;
    return (link.textContent || link.getAttribute("aria-label") || "info").trim();
  }

  function contentFor(link) {
    var ref = link.getAttribute("data-popover-ref");
    if (ref) {
      var source = document.querySelector(ref);
      if (source) return source.innerHTML;
      return "Missing popover content: " + ref;
    }
    return link.getAttribute("data-popover") || "";
  }

  function indexOfPopover(el) {
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].el === el) return i;
    }
    return -1;
  }

  function indexOfTrigger(trigger) {
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].trigger === trigger) return i;
    }
    return -1;
  }

  /* ------------------------------------------------------------- colours */

  function accentFor(trigger, depth) {
    var forced = trigger.getAttribute("data-popover-accent");
    if (forced) {
      return { value: forced, index: palette.indexOf(forced) };
    }

    if (depth === 0) {
      // Nav buttons carry their own --accent; inherit it so the popover
      // matches the button you're hovering.
      var own = getComputedStyle(trigger).getPropertyValue("--accent").trim();
      var known = palette.indexOf(own);
      if (own) return { value: own, index: known === -1 ? 0 : known };
      return { value: palette[0], index: 0 };
    }

    // Nested: step to the next colour in the palette.
    var parentIndex = stack[depth - 1] ? stack[depth - 1].accentIndex : 0;
    var next = (parentIndex + 1) % palette.length;
    return { value: palette[next], index: next };
  }

  /* -------------------------------------------------------------- build */

  function build(trigger, depth) {
    var pop = document.createElement("div");
    pop.className = "popover";
    if (trigger.getAttribute("data-popover-size") === "wide") {
      pop.classList.add("is-wide");
    }
    pop.id = "popover-" + ++uid;
    pop.setAttribute("role", "tooltip");
    pop.dataset.depth = String(depth);
    pop.style.zIndex = String(BASE_Z + depth);

    var accent = accentFor(trigger, depth);
    pop.style.setProperty("--accent", accent.value);

    var arrow = document.createElement("span");
    arrow.className = "popover-arrow";

    var head = document.createElement("div");
    head.className = "popover-head";

    var label = document.createElement("span");
    label.className = "popover-label";
    label.textContent = labelFor(trigger);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "popover-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "\u00d7";
    close.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var index = indexOfPopover(pop);
      if (index !== -1) closeFrom(index);
    });

    var body = document.createElement("div");
    body.className = "popover-body";
    body.innerHTML = contentFor(trigger);

    head.appendChild(label);
    head.appendChild(close);
    pop.appendChild(arrow);
    pop.appendChild(head);
    pop.appendChild(body);

    pop.addEventListener("mouseenter", cancelClose);
    pop.addEventListener("mouseleave", scheduleClose);

    // Popovers can contain their own popover links.
    Array.prototype.forEach.call(body.querySelectorAll(TRIGGERS), enhance);

    // An image has no height until it loads, which would leave the bubble
    // measured wrong and parked in the wrong spot. Re-place it once it's in.
    Array.prototype.forEach.call(body.querySelectorAll("img"), function (img) {
      if (img.complete) return;
      img.addEventListener("load", function () {
        var index = indexOfPopover(pop);
        if (index !== -1) place(pop, arrow, stack[index].trigger);
      });
    });

    return { el: pop, arrow: arrow, accentIndex: accent.index };
  }

  function place(pop, arrow, trigger) {
    var rect = trigger.getBoundingClientRect();
    var width = pop.offsetWidth;
    var height = pop.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;

    var above = rect.top - height - GAP >= EDGE;
    var top = above ? rect.top - height - GAP : rect.bottom + GAP;
    top = Math.max(EDGE, Math.min(top, vh - height - EDGE));

    var left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(EDGE, Math.min(left, vw - width - EDGE));

    var arrowX = rect.left + rect.width / 2 - left;
    arrowX = Math.max(16, Math.min(arrowX, width - 16));

    pop.classList.toggle("is-above", above);
    pop.classList.toggle("is-below", !above);
    pop.style.top = Math.round(top) + "px";
    pop.style.left = Math.round(left) + "px";
    arrow.style.left = Math.round(arrowX) + "px";
  }

  /* --------------------------------------------------------- open / close */

  function open(trigger, marker, slot) {
    cancelOpen();
    cancelClose();

    // Already showing? Just drop anything opened on top of it.
    var existing = indexOfTrigger(trigger);
    if (existing !== -1) {
      closeFrom(existing + 1);
      return;
    }

    // A trigger inside a popover stacks on top of it; anything else is a
    // fresh start.
    var parentPop = trigger.closest(".popover");
    var parentIndex = parentPop ? indexOfPopover(parentPop) : -1;
    closeFrom(parentIndex + 1);

    var depth = stack.length;
    var built = build(trigger, depth);

    built.el.style.visibility = "hidden";
    document.body.appendChild(built.el);
    place(built.el, built.arrow, trigger);
    built.el.style.visibility = "";

    trigger.setAttribute("aria-describedby", built.el.id);
    if (marker) marker.setAttribute("aria-expanded", "true");

    stack.push({
      trigger: trigger,
      marker: marker,
      slot: slot,
      el: built.el,
      arrow: built.arrow,
      accentIndex: built.accentIndex,
    });
  }

  function destroy(entry, immediate) {
    entry.trigger.removeAttribute("aria-describedby");
    if (entry.marker) entry.marker.setAttribute("aria-expanded", "false");

    var pop = entry.el;
    if (immediate || reduceMotion.matches) {
      pop.remove();
      return;
    }
    pop.classList.add("is-closing");
    window.setTimeout(function () {
      pop.remove();
    }, 140);
  }

  /** Closes the popover at `index` and everything stacked on top of it. */
  function closeFrom(index, immediate) {
    if (index < 0) index = 0;
    while (stack.length > index) {
      destroy(stack.pop(), immediate);
    }
  }

  function closeAll(immediate) {
    cancelOpen();
    cancelClose();
    closeFrom(0, immediate);
  }

  /** Keeps the popovers the pointer (or focus) is still inside of. */
  function pruneToPointer() {
    while (stack.length) {
      var top = stack[stack.length - 1];
      var busy =
        isHovered(top.el) ||
        isHovered(top.slot) ||
        top.el.contains(document.activeElement) ||
        top.slot.contains(document.activeElement);
      if (busy) break;
      destroy(stack.pop());
    }
  }

  /* -------------------------------------------------------------- timers */

  function cancelOpen() {
    window.clearTimeout(openTimer);
    openTimer = null;
  }

  function cancelClose() {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  function scheduleOpen(trigger, marker, slot) {
    cancelClose();
    cancelOpen();
    openTimer = window.setTimeout(function () {
      open(trigger, marker, slot);
    }, OPEN_DELAY);
  }

  function scheduleClose() {
    cancelOpen();
    cancelClose();
    closeTimer = window.setTimeout(pruneToPointer, CLOSE_DELAY);
  }

  /* ------------------------------------------------------------- wiring */

  function enhance(trigger) {
    if (trigger.dataset.popoverReady) return;
    trigger.dataset.popoverReady = "1";

    var isButton = trigger.classList.contains("link-item");
    var slot = document.createElement("span");
    slot.className =
      "pop-slot " + (isButton ? "pop-slot--button" : "pop-slot--inline");
    trigger.parentNode.insertBefore(slot, trigger);
    slot.appendChild(trigger);

    // Nav buttons already carry an --accent from the stylesheet, and triggers
    // inside a popover inherit one from it. Everything else (links and words
    // in the prose) would otherwise default to the same colour, so hand each
    // one the next colour in the palette, in document order.
    var nested = !!trigger.closest(".popover");
    if (
      !nested &&
      !getComputedStyle(trigger).getPropertyValue("--accent").trim()
    ) {
      slot.style.setProperty(
        "--accent",
        palette[inlineIndex % palette.length],
      );
      inlineIndex++;
    }

    // The nav buttons are their own affordance, so they get no marker:
    // hovering (or tabbing to) the button is enough. Inline links get a
    // small footnote-style marker so you can tell there's more to read —
    // and so they can be opened by tapping on touch screens.
    var marker = null;
    if (!isButton) {
      marker = document.createElement("button");
      marker.type = "button";
      marker.className = "pop-marker";
      marker.setAttribute("aria-expanded", "false");
      marker.setAttribute("aria-label", "More about " + labelFor(trigger));
      marker.textContent = "?";
      slot.appendChild(marker);

      // Tap / click the marker toggles, without following the link.
      marker.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var index = indexOfTrigger(trigger);
        if (index !== -1) {
          closeFrom(index);
        } else {
          open(trigger, marker, slot);
        }
      });
    }

    if (canHover) {
      slot.addEventListener("mouseenter", function () {
        scheduleOpen(trigger, marker, slot);
      });
      slot.addEventListener("mouseleave", scheduleClose);
    }

    // On touch there is no hover, and the marker is a tiny target. Triggers
    // that aren't links have nowhere to navigate to, so let the whole word
    // be tapped. Real links keep their tap for the link itself.
    var isLink = trigger.tagName === "A" && trigger.hasAttribute("href");
    if (!canHover && !isLink) {
      slot.classList.add("is-tappable");
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var index = indexOfTrigger(trigger);
        if (index !== -1) {
          closeFrom(index);
        } else {
          open(trigger, marker, slot);
        }
      });
    }

    // Keyboard: tabbing onto the link reveals its popover.
    slot.addEventListener("focusin", function (event) {
      if (!isKeyboardFocus(event.target)) return;
      open(trigger, marker, slot);
    });
    slot.addEventListener("focusout", function (event) {
      if (slot.contains(event.relatedTarget)) return;
      scheduleClose();
    });
  }

  function insideAnyPopover(node) {
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].el.contains(node) || stack[i].slot.contains(node)) {
        return true;
      }
    }
    return false;
  }

  function init() {
    resolvePalette();
    Array.prototype.forEach.call(
      document.querySelectorAll(TRIGGERS),
      enhance,
    );

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !stack.length) return;
      var top = stack[stack.length - 1];
      var focusTarget = top.trigger;
      closeFrom(stack.length - 1, true);
      if (document.activeElement === document.body) focusTarget.focus();
    });

    document.addEventListener("click", function (event) {
      if (!stack.length) return;
      if (insideAnyPopover(event.target)) return;
      closeAll(true);
    });

    window.addEventListener("resize", function () {
      for (var i = 0; i < stack.length; i++) {
        place(stack[i].el, stack[i].arrow, stack[i].trigger);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
