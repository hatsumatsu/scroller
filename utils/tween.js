import { easing } from "./utils.js";

export default class Tween {
  constructor(options) {
    this.defaults = {
      duration: 1000,
      easing: "linear",

      onUpdate: () => {},
      onCompleted: () => {},
    };
    this.options = Object.assign({}, this.defaults, options);

    this.isRunning = false;

    this.value = null;
    this.startValue = null;
    this.previousValue = null;
    this.targetValue = null;

    this.startTime = null;

    this.progress = 0;
    this.delta = 0;

    this.frame = null;
  }

  start(startValue, targetValue) {
    console.log("Tween.start()", startValue, targetValue);

    this.value = startValue;
    this.startValue = startValue;
    this.previousValue = startValue;
    this.targetValue = targetValue;

    this.delta = 0;

    this.progress = 0;

    this.isRunning = true;

    this.frame = requestAnimationFrame((time) => {
      this.startTime = time;
      this.onFrame(time);
    });
  }

  stop(finish = false) {
    console.log("Tween.stop()", finish);

    this.isRunning = false;

    cancelAnimationFrame(this.frame);

    if (finish) {
      this.value = this.targetValue;
      this.options.onUpdate(this.value);
    }

    this.options.onCompleted(this.value);
  }

  destroy() {
    this.stop();
  }

  onFrame(time = 0) {
    if (!this.isRunning) {
      return;
    }

    const progress = easing[this.options.easing](
      (time - this.startTime) / this.options.duration
    );

    this.previousValue = this.value;

    this.value =
      this.startValue + (this.targetValue - this.startValue) * progress;

    this.delta = this.value - this.previousValue;

    this.options.onUpdate(this.value, this.delta, this.progress);

    if (
      time - this.startTime >= this.options.duration ||
      Math.abs(this.value - this.targetValue) <= 0
    ) {
      this.stop();
      return;
    }

    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame((time) => {
      this.onFrame(time);
    });
  }

  getIsRunning() {
    return this.isRunning;
  }

  getValue() {
    return this.value;
  }

  getProgress() {
    return this.progress;
  }

  getDelta() {
    return this.delta;
  }
}
