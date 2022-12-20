/**
 * For background on throttling of touchmove events on Chrome Android 85.* see
 * https://crbug.com/1123304
 *
 * once this is fixed we can make touchstart, touchmove and touchend passive again without calling event.preventDefault();
 */
import Tween from "./utils/tween.js";
import Inertia from "./utils/inertia.js";
import { clamp } from "./utils/utils.js";

export default class Scroller {
  constructor(options = {}) {
    this.defaults = {
      active: true,

      direction: "y",

      loop: false,

      autoSpeed: 0,

      container: window,

      scrollPositionMax: Infinity,

      scrollToEasing: "outQuart",

      scrollFactor: {
        touch: 1,
        wheel: 1,
      },

      touchInertiaStrength: 0.035,

      keyboard: {
        distance: 0.25, // fraction of scrollerSize
      },

      scrollBar: {
        minSize: 40,
      },

      onScroll: () => {},

      bindResize: true,
    };

    this.options = Object.assign({}, this.defaults, options);

    this.elements = {};

    this.frame = null;

    this.is = {
      initiated: false,
      active: false,
      scrollbaring: false,
      mouseover: false,
    };

    this.scrollerSize = 0; // either window.innerHeight/innerWidth or this.options.container.offsetHeight/offsetWidth depending on this.options.direction

    this.mode = undefined;

    this.touchPosition = {
      current: 0,
      previous: 0,
    };

    this.mousePosition = {
      current: 0,
      previous: 0,
    };

    this.touchInertia = new Inertia({
      lerpFactor: this.options.touchInertiaStrength,
    });
    this.scrollToTween = new Tween({ easing: this.options.scrollToEasing });

    // aggregated delta from input events that are not synced to frame rate
    this.delta = 0;

    this.scrollPosition = 0;
    this.previousScrollPosition = 0;
    this.targetScrollPosition = 0;

    this.scrollProgress = 0;

    this.loopCount = 0;

    this.scrollBar = {
      size: 0,
    };

    this.debouncer = {
      resize: null,
      wheel: null,
    };

    this.init();
  }

  init() {
    this.buildScrollbar();

    this.bindEvents();

    if (this.options.loop) {
      this.scrollPosition = 1;
      this.targetScrollPosition = 1;
      this.previousScrollPosition = 1;
    }

    this.resize();

    this.is.initiated = true;
    document.documentElement.setAttribute("data-Scroller-initiated", true);

    if (this.options.active) {
      this.activate();
    } else {
      this.deactivate();
    }
  }

  buildScrollbar() {
    // scrollBar
    this.elements.scrollBar = document.createElement("div");
    this.elements.scrollBar.setAttribute("data-scroller-role", "scrollBar");
    this.elements.scrollBar.setAttribute(
      "data-scroller-direction",
      this.options.direction
    );

    (this.options.container === window
      ? document.body
      : this.options.container
    ).appendChild(this.elements.scrollBar);
  }

  destroyScrollbar() {
    if (this.elements.scrollBar) {
      this.elements.scrollBar.remove();
    }

    this.elements = {};
  }

  updateScrollBar() {
    if (!this.elements.scrollBar) {
      return;
    }

    if (this.options.direction === "y") {
      this.elements.scrollBar.style.transform =
        "translateY( " +
        (this.scrollPosition / this.options.scrollPositionMax) *
          (this.scrollerSize - this.scrollBar.size) +
        "px )";
    } else {
      this.elements.scrollBar.style.transform =
        "translateX( " +
        (this.scrollPosition / this.options.scrollPositionMax) *
          (this.scrollerSize - this.scrollBar.size) +
        "px )";
    }
  }

  showScrollBar() {
    this.elements.scrollBar.classList.remove("hidden");
  }

  hideScrollBar() {
    this.elements.scrollBar.classList.add("hidden");
  }

  /**
   * Public method
   */
  activate() {
    this.is.active = true;

    this.showScrollBar();
    this.onFrame();
  }

  /**
   * Public method
   */
  deactivate() {
    this.is.active = false;

    this.hideScrollBar();
    cancelAnimationFrame(this.frame);
  }

  /**
   * Public method
   * @param {float} scrollPosition
   * @param {boolean} animate
   */
  scrollTo(scrollPosition, animate = false) {
    if (scrollPosition === undefined) {
      return;
    }

    if (this.scrollToTween.getIsRunning()) {
      this.scrollToTween.stop();
    }

    // if looped, check if the way forward is shorter than backwards
    // TODO: do  the same backwards
    if (this.options.loop) {
      if (
        Math.abs(
          scrollPosition -
            this.targetScrollPosition +
            this.options.scrollPositionMax
        ) < Math.abs(scrollPosition - this.targetScrollPosition)
      ) {
        scrollPosition = scrollPosition + this.options.scrollPositionMax;
      } else if (
        Math.abs(
          scrollPosition -
            this.targetScrollPosition -
            this.options.scrollPositionMax
        ) < Math.abs(scrollPosition - this.targetScrollPosition)
      ) {
        scrollPosition = scrollPosition - this.options.scrollPositionMax;
      }
    }

    if (!animate) {
      this.targetScrollPosition = scrollPosition;
    } else {
      this.scrollToTween.start(this.scrollPosition, scrollPosition);
    }
  }

  setScrollPosition(scrollPosition, update = true) {
    this.previousScrollPosition = this.scrollPosition;
    this.scrollPosition = clamp(
      scrollPosition,
      0,
      this.options.scrollPositionMax
    );
    this.scrollProgress = this.options.scrollPositionMax
      ? this.scrollPosition / this.options.scrollPositionMax
      : 0;

    this.updateScrollBar();

    if (this.previousScrollPosition !== this.scrollPosition && update) {
      this.options.onScroll(this.scrollPosition);
    }
  }

  /**
   * Public method
   * @returns {float} scrollPosition
   */
  getScrollPosition() {
    return this.scrollPosition;
  }

  /**
   * Public method
   * @returns {float} scrollPositionMax
   */
  getScrollPositionMax() {
    return this.options.scrollPositionMax;
  }

  /**
   * Public method
   * @returns {float} scrollProgress
   */
  getScrollProgress() {
    return this.scrollProgress;
  }

  /**
   * Public method
   * @returns {int} loopCount
   */
  getLoopCount() {
    return this.loopCount;
  }

  /**
   * Public method
   * @returns {*} option
   */
  getOption(key) {
    return this.options[key] || undefined;
  }

  /**
   * Public method
   * @param {string} key
   * @param {*} value
   * @param {boolean} update
   */
  setOption(key, value, update = true) {
    // validate
    if (key === "scrollPositionMax") {
      value = clamp(value, this.options.loop ? 1 : 0, Infinity);
    }

    // set value
    this.options[key] = value;

    // implications
    if (key === "direction") {
      if (this.elements.scrollBar) {
        this.elements.scrollBar.setAttribute(
          "data-scroller-direction",
          this.options.direction
        );
      }
    }

    this.resize();

    this.updateScrollBar();
  }

  /**
   * Public method
   */
  destroy() {
    // INERTIA
    if (this.touchInertia) {
      this.touchInertia.destroy();
    }

    if (this.scrollToTween) {
      this.scrollToTween.destroy();
    }

    // RESIZE
    if (this.options.bindResize) {
      window.removeEventListener("resize", this.onWindowResize);
    }

    // KEYBOARD
    window.removeEventListener("keydown", this.onKeyDown);

    // MOUSEWHEEL
    this.options.container.removeEventListener("wheel", this.onWheel, {
      passive: true,
    });

    // MOUSE
    this.options.container.removeEventListener("mouseenter", this.onMouseEnter);
    this.options.container.removeEventListener("mouseleave", this.onMouseLeave);

    if (this.elements.scrollBar) {
      this.elements.scrollBar.removeEventListener(
        "mousedown",
        this.onMouseDown
      );
    }
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);

    // TOUCH
    this.options.container.removeEventListener(
      "touchstart",
      this.onTouchStart,
      {
        passive: true,
      }
    );
    this.options.container.removeEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.options.container.removeEventListener("touchend", this.onTouchEnd, {
      passive: true,
    });
    document.removeEventListener("touchcancel", this.onTouchEnd, {
      passive: true,
    });

    // ELEMENTS
    this.destroyScrollbar();

    // STATE
    document.documentElement.setAttribute("data-Scroller-initiated", false);
    this.is.initiated = false;
  }

  bindEvents() {
    // RESIZE
    this.onWindowResize = this.onWindowResize.bind(this);
    if (this.options.bindResize) {
      window.addEventListener("resize", this.onWindowResize);
    }

    // KEYBOARD
    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener("keydown", this.onKeyDown);

    // MOUSEWHEEL

    this.onWheel = this.onWheel.bind(this);
    this.options.container.addEventListener("wheel", this.onWheel, {
      passive: true,
    });

    // MOUSE
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    if (this.elements.scrollBar) {
      this.elements.scrollBar.addEventListener("mousedown", this.onMouseDown);
    }
    this.options.container.addEventListener("mouseenter", this.onMouseEnter);
    this.options.container.addEventListener("mouseleave", this.onMouseLeave);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);

    // TOUCH
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.options.container.addEventListener("touchstart", this.onTouchStart, {
      passive: true,
    });
    this.options.container.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.options.container.addEventListener("touchend", this.onTouchEnd, {
      passive: true,
    });
    document.addEventListener("touchcancel", this.onTouchEnd, {
      passive: true,
    });
  }

  /**
   * RESIZE
   */
  onWindowResize() {
    this.scrollToTween.stop();

    clearTimeout(this.debouncer.resize);

    this.debouncer.resize = setTimeout(() => {
      this.resize();
    }, 500);
  }

  resize() {
    this.scrollerSize =
      this.options.direction === "y"
        ? this.options.container[
            this.options.container === window ? "innerHeight" : "offsetHeight"
          ]
        : this.options.container[
            this.options.container === window ? "innerWidth" : "offsetWidth"
          ];

    // modify the scrollbar size to allow scrolling in small virtual viewports
    if (this.options.scrollPositionMax) {
      this.scrollBar.size = clamp(
        (this.scrollerSize / this.options.scrollPositionMax) *
          this.scrollerSize,
        this.options.scrollBar.minSize,
        this.scrollerSize * 0.8
      );
    } else {
      this.scrollBar.size = 0;
    }

    if (this.options.direction === "y") {
      this.elements.scrollBar.style.width = ``;
      this.elements.scrollBar.style.height = this.scrollBar.size + "px";
    } else {
      this.elements.scrollBar.style.width = this.scrollBar.size + "px";
      this.elements.scrollBar.style.height = ``;
    }
  }

  /**
   * KEYBOARD
   */
  onKeyDown(event) {
    if (!this.options.active) {
      return;
    }

    if (event.target.matches("input") || event.target.matches("textarea")) {
      return;
    }

    console.log(
      document.activeElement,
      this.options.container === document.activeElement,
      this.options.container.contains(document.activeElement)
    );

    if (
      this.options.container !== window &&
      this.options.container !== document.activeElement &&
      !this.options.container.contains(document.activeElement) &&
      !this.is.mouseover
    ) {
      return;
    }

    if (this.options.direction === "x") {
      if (event.keyCode === 39 || event.keyCode === 32) {
        this.scrollToTween.stop();
        this.delta += this.options.keyboard.distance * this.scrollerSize;
      }

      if (event.keyCode === 37) {
        this.scrollToTween.stop();
        this.delta += -1 * this.options.keyboard.distance * this.scrollerSize;
      }
    } else {
      if (event.keyCode === 40 || event.keyCode === 32) {
        this.scrollToTween.stop();
        this.delta += this.options.keyboard.distance * this.scrollerSize;
      }

      if (event.keyCode === 38) {
        this.scrollToTween.stop();
        this.delta += -1 * this.options.keyboard.distance * this.scrollerSize;
      }
    }
  }

  /**
   * MOUSEWHEEL
   */
  onWheel(event) {
    if (!this.options.active) {
      return;
    }

    this.scrollToTween.stop();

    this.mode = "wheel";

    const delta = this.options.direction === "y" ? event.deltaY : event.deltaX;

    this.delta += 1 * delta;

    clearTimeout(this.debouncer.wheel);
    this.debouncer.wheel = setTimeout(() => {
      this.onWheelEnd();
    }, 100);
  }

  onWheelEnd() {
    this.delta = 0;
  }

  /**
   * TOUCH
   */
  onTouchStart(event) {
    if (!this.options.active) {
      return;
    }

    // No preventDefault since the event is passive
    // event.preventDefault();

    this.mode = "touch";

    this.touchInertia.deactivate();
    this.scrollToTween.stop();

    this.touchPosition.previous =
      this.options.direction === "y"
        ? event.touches[0].clientY
        : event.touches[0].clientX;

    this.touchPosition.current =
      this.options.direction === "y"
        ? event.touches[0].clientY
        : event.touches[0].clientX;
  }

  onTouchMove(event) {
    if (!this.is.active) {
      return;
    }

    // preventDefault since the event is NOT passive
    event.preventDefault();

    this.touchInertia.deactivate();
    this.scrollToTween.stop();

    this.touchPosition.previous = this.touchPosition.current;

    this.touchPosition.current =
      this.options.direction === "y"
        ? event.touches[0].clientY
        : event.touches[0].clientX;

    const delta = this.touchPosition.current - this.touchPosition.previous;

    this.delta += -1 * delta;

    this.touchInertia.setValue(this.delta);
  }

  onTouchEnd(event) {
    if (!this.is.active) {
      return;
    }

    // No preventDefault since the event is passive
    // event.preventDefault();

    this.delta = 0;
    this.touchInertia.activate();
  }

  /**
   * MOUSE ENTER
   */
  onMouseEnter(event) {
    if (!this.is.active) {
      return;
    }

    this.is.mouseover = true;
  }

  onMouseLeave(event) {
    if (!this.is.active) {
      return;
    }

    this.is.mouseover = false;
  }

  /**
   * MOUSE ON SCROLLBAR
   */
  onMouseDown(event) {
    if (!this.is.active) {
      return;
    }

    this.scrollToTween.stop();

    this.is.scrollbaring = true;

    this.mousePosition.current =
      this.options.direction === "y" ? event.clientY : event.clientX;

    this.mousePosition.previous =
      this.options.direction === "y" ? event.clientY : event.clientX;

    this.elements.scrollBar.classList.add("active");
  }

  onMouseMove(event) {
    if (!this.is.active) {
      return;
    }

    if (!this.is.scrollbaring) {
      return;
    }

    this.mousePosition.previous = this.mousePosition.current;

    this.mousePosition.current =
      this.options.direction === "y" ? event.clientY : event.clientX;

    const distance = this.mousePosition.current - this.mousePosition.previous;

    this.delta +=
      (distance / (this.scrollerSize - this.scrollBar.size)) *
      this.options.scrollPositionMax;
  }

  onMouseUp(event) {
    if (!this.is.active) {
      return;
    }

    if (!this.is.scrollbaring) {
      return;
    }

    this.mousePosition.current =
      this.options.direction === "y" ? event.clientY : event.clientX;

    this.delta = 0;

    this.is.scrollbaring = false;

    this.elements.scrollBar.classList.remove("active");
  }

  /**
   * FRAME LOOP
   */
  onFrame(time) {
    if (!this.is.initiated) {
      return;
    }

    if (!this.is.active) {
      return;
    }

    let delta =
      (this.touchInertia.getIsActive()
        ? this.touchInertia.getValue()
        : this.scrollToTween.getIsRunning()
        ? this.scrollToTween.getDelta() % this.options.scrollPositionMax // use only the remainder in case we are scrolling forwards/backwards through the loop boundaries
        : this.delta) * (this.options.scrollFactor[this.mode] || 1);

    if (!delta) {
      delta = this.options.autoSpeed || 0;
    }

    this.targetScrollPosition = clamp(
      this.targetScrollPosition + delta,
      0,
      this.options.scrollPositionMax
    );

    if (this.options.loop) {
      if (this.scrollPosition > this.options.scrollPositionMax - 1) {
        this.targetScrollPosition = 1;
        this.loopCount++;
      } else if (this.scrollPosition < 1) {
        this.targetScrollPosition = this.options.scrollPositionMax - 1;
        this.loopCount--;
      }
    }

    this.setScrollPosition(this.targetScrollPosition);

    this.delta = 0;

    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame((time) => {
      this.onFrame(time);
    });
  }
}
