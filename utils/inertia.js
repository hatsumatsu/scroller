import { lerp } from "./utils.js";

export default class Inertia {
  constructor() {
    this.isActive = false;

    this.value = null;

    this.lerpFactor = 0.035;

    this.frame = null;
  }

  activate() {
    if (Math.abs(this.value) < 0.1) {
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

    if (Math.abs(this.value) < 0.1) {
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
