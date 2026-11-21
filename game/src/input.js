// WHITEOUT — keyboard and mouse input. The game reads this one object every step:
// held keys, a click-to-move target, and edge-triggered presses (Enter, P, R, M).
export function createInput(canvas) {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    crouch: false,
    // Click-to-move: the player walks toward this point until it arrives or the
    // player presses a movement key. Null when there is no active target.
    clickTarget: null,
    // Edge-triggered actions, consumed by the game loop each frame.
    pressedEnter: false,
    pressedPause: false,
    pressedRestart: false,
    pressedMute: false,
    pressedAny: false,
  };

  const KEYMAP = {
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    KeyC: 'crouch',
    ControlLeft: 'crouch',
    ControlRight: 'crouch',
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    const field = KEYMAP[event.code];
    if (field) {
      input[field] = true;
      input.clickTarget = null; // a movement key cancels click-to-move
      event.preventDefault();
    }
    if (event.code === 'Enter' || event.code === 'Space') {
      input.pressedEnter = true;
      input.pressedAny = true;
      event.preventDefault();
    }
    if (event.code === 'KeyP' || event.code === 'Escape') input.pressedPause = true;
    if (event.code === 'KeyR') input.pressedRestart = true;
    if (event.code === 'KeyM') input.pressedMute = true;
  }

  function onKeyUp(event) {
    const field = KEYMAP[event.code];
    if (field) input[field] = false;
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    input.clickTarget = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    input.pressedAny = true;
  }

  function onBlur() {
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;
    input.run = false;
    input.crouch = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('blur', onBlur);

  /** A unit movement vector from the held keys (zero when none are held). */
  input.moveVector = function moveVector() {
    let x = 0;
    let y = 0;
    if (input.left) x -= 1;
    if (input.right) x += 1;
    if (input.up) y -= 1;
    if (input.down) y += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  };

  /** Clear the edge-triggered presses after the loop has read them. */
  input.consumePresses = function consumePresses() {
    input.pressedEnter = false;
    input.pressedPause = false;
    input.pressedRestart = false;
    input.pressedMute = false;
    input.pressedAny = false;
  };

  return input;
}
