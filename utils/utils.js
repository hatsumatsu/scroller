function clamp(value, min, max) {
  if (value < min) {
    return min;
  } else if (value > max) {
    return max;
  }

  return value;
}

function lerp(value1, value2, amount) {
  amount = amount < 0 ? 0 : amount;
  amount = amount > 1 ? 1 : amount;
  return value1 + (value2 - value1) * amount;
}

function range(value = 0, input = [0, 0], output = [0, 0]) {
  return (
    ((value - input[0]) * (output[1] - output[0])) / (input[1] - input[0]) +
    output[0]
  );
}

const easing = {
  // no easing, no acceleration
  linear: (t) => t,
  // accelerating from zero velocity
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  // decelerating to zero velocity
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  // accelerating from zero velocity
  inQuad: (t) => t * t,
  // decelerating to zero velocity
  outQuad: (t) => t * (2 - t),
  // acceleration until halfway, then deceleration
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  // accelerating from zero velocity
  inCubic: (t) => t * t * t,
  // decelerating to zero velocity
  outCubic: (t) => --t * t * t + 1,
  // acceleration until halfway, then deceleration
  inOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  // accelerating from zero velocity
  inQuart: (t) => t * t * t * t,
  // decelerating to zero velocity
  outQuart: (t) => 1 - --t * t * t * t,
  // acceleration until halfway, then deceleration
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),
  // accelerating from zero velocity
  inQuint: (t) => t * t * t * t * t,
  // decelerating to zero velocity
  outQuint: (t) => 1 + --t * t * t * t * t,
  // acceleration until halfway, then deceleration
  inOutQuint: (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
};

export { lerp, clamp, range, easing };
