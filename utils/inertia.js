import { lerp } from "./utils.js";

export default class Inertia {
  constructor(options = {}) {
    this.isActive = false;

    this.value = null;

    this.lerpFactor = options.lerpFactor || 0.035;
    this.precision = options.precision || 0.1;

    this.frame = null;
  }

  activate() {
    if (Math.abs(this.value) < this.precision) {
      return;
    }

    this.isActive = true;

    this.onFrame();
  }

  deactivate() {
    this.isActive = false;
    this.value = 0;

    cancelAnimationFrame(this.frame);
  }

  setValue(value) {
    this.value = value;
  }

  destroy() {
    this.deactivate();
  }

  onFrame() {
    if (!this.isActive) {
      return;
    }

    this.value = lerp(this.value, 0, this.lerpFactor);

    if (Math.abs(this.value) < this.precision) {
      this.deactivate();
    }

    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.onFrame();
    });
  }

  getIsActive() {
    return this.isActive;
  }

  getValue() {
    return this.value;
  }
}
