const state = {
    pressed: new Set(),
    leftJS: { x: 0, y: 0 },
    rightJS: { x: 0, y: 0 },
    l2Val: 0,
    r2Val: 0,
    rosConnected: false
};

const elements = {
    time: document.getElementById('screen-time'),
    activeList: document.getElementById('active-list'),
    rosStatus: document.getElementById('ros-status'),
    leftStick: document.getElementById('joystick-left'),
    rightStick: document.getElementById('joystick-right'),
    leftKnob: document.getElementById('knob-left'),
    rightKnob: document.getElementById('knob-right'),
    leftDot: document.getElementById('stick-dot-left'),
    rightDot: document.getElementById('stick-dot-right'),
    leftValue: document.getElementById('stick-value-left'),
    rightValue: document.getElementById('stick-value-right'),
    l2Fill: document.getElementById('l2-fill'),
    r2Fill: document.getElementById('r2-fill'),
    triggerBarLeft: document.getElementById('trigger-bar-left'),
    triggerBarRight: document.getElementById('trigger-bar-right'),
    triggerValueLeft: document.getElementById('trigger-value-left'),
    triggerValueRight: document.getElementById('trigger-value-right'),
    triggerL2: document.getElementById('trigger-l2'),
    triggerR2: document.getElementById('trigger-r2')
};

const actionColors = {
    triangle: '#1a9e7a',
    circle: '#d0293a',
    cross: '#2255bb',
    square: '#9b3a8c'
};

const drag = {
    left: false,
    right: false,
    l2: false,
    r2: false
};



let ros = null;
let joyPublisher = null;
let joyPublishTimer = null;
const ROSBRIDGE_URL = `ws://${window.location.hostname}:9090`;

function updateTime() {
    if (!elements.time) return;
    const now = new Date();
    elements.time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setPressed(id, isPressed) {
    if (!id) return;
    if (isPressed) {
        state.pressed.add(id);
    } else {
        state.pressed.delete(id);
    }

    const btn = document.querySelector(`[data-btn="${id}"]`);
    if (btn) {
        btn.classList.toggle('pressed', isPressed);
    }

    updateActiveList();
}

function updateActiveList() {
    if (!elements.activeList) return;
    elements.activeList.innerHTML = '';

    if (state.pressed.size === 0) {
        const muted = document.createElement('span');
        muted.className = 'muted';
        muted.textContent = '—';
        elements.activeList.appendChild(muted);
        return;
    }

    [...state.pressed].forEach((btn) => {
        const chip = document.createElement('span');
        chip.className = 'active-chip';
        const color = actionColors[btn] || 'rgba(255,255,255,0.25)';
        chip.style.color = color;
        chip.style.borderColor = `${color}44`;
        chip.style.background = `${color}22`;
        chip.textContent = `${btn}:1`;
        elements.activeList.appendChild(chip);
    });
}

function getPointer(e) {
    if (e.touches && e.touches[0]) return e.touches[0];
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0];
    return e;
}

// Analog joystick: element center = 0, edge = 1.0 or -1.0
// Smooth float values just like a real PS4 controller
function getAnalogStick(clientX, clientY, element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top  + rect.height / 2;
    const radius  = rect.width / 2;

    const x = Math.max(-1, Math.min(1, (clientX - centerX) / radius));
    const y = Math.max(-1, Math.min(1, (clientY - centerY) / radius));

    return { x, y };
}

function getDpadAxis() {
    const left  = state.pressed.has('left');
    const right = state.pressed.has('right');
    const up    = state.pressed.has('up');
    const down  = state.pressed.has('down');

    const lr = left && !right ? -1 : right && !left ? 1 : 0;
    const ud = up && !down    ?  1 : down && !up   ? -1 : 0;

    return { lr, ud };
}

function getButtonValue(id) {
    return state.pressed.has(id) ? 1 : 0;
}

function publishJoy() {
    if (!state.rosConnected || !joyPublisher) return;

    const dpad = getDpadAxis();

    // axes: real PS4 joy node order
    const axes = [
        state.leftJS.x,   // 0 Left Stick X
        -state.leftJS.y,  // 1 Left Stick Y  (up = 1, down = -1)
        state.l2Val,      // 2 L2 Analog
        state.rightJS.x,  // 3 Right Stick X
        -state.rightJS.y, // 4 Right Stick Y (up = 1, down = -1)
        state.r2Val,      // 5 R2 Analog
        dpad.lr,          // 6 D-Pad X
        dpad.ud           // 7 D-Pad Y
    ];

    // buttons: real PS4 joy node order
    const buttons = [
        getButtonValue('cross'),    // 0
        getButtonValue('circle'),   // 1
        getButtonValue('triangle'), // 3
        getButtonValue('square'),   // 2
        getButtonValue('l1'),       // 4
        getButtonValue('r1'),       // 5
        getButtonValue('l2'),       // 6 L2 digital
        getButtonValue('r2'),       // 7 R2 digital
        0,                          // 8  Share
        0,                          // 9  Options
        0,                          // 10 L3 (stick click)
        0,                          // 11 R3 (stick click)
        0,                          // 12 PS Button
        0                           // 13 Touchpad
    ];

    joyPublisher.publish({ axes, buttons });
}

function updateJoystickUI(side) {
    const pos   = side === 'left' ? state.leftJS   : state.rightJS;
    const knob  = side === 'left' ? elements.leftKnob  : elements.rightKnob;
    const dot   = side === 'left' ? elements.leftDot   : elements.rightDot;
    const value = side === 'left' ? elements.leftValue : elements.rightValue;

    // Move knob visually (up to 30px offset)
    if (knob) {
        const px = pos.x * 30;
        const py = pos.y * 30;
        knob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    }

    if (dot) {
        const px = pos.x * 8;
        const py = pos.y * 8;
        dot.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    }

    if (value) {
        // Show inverted Y so display matches physical feel (up = 1)
        value.textContent = `${pos.x.toFixed(2)},${(-pos.y).toFixed(2)}`;
    }
}

function updateTriggerUI(side) {
    const val   = side === 'left' ? state.l2Val : state.r2Val;
    const fill  = side === 'left' ? elements.l2Fill         : elements.r2Fill;
    const bar   = side === 'left' ? elements.triggerBarLeft  : elements.triggerBarRight;
    const value = side === 'left' ? elements.triggerValueLeft: elements.triggerValueRight;
    const percent = `${val * 100}%`;

    if (fill)  fill.style.width  = percent;
    if (bar)   bar.style.width   = percent;
    if (value) value.textContent = val.toFixed(2);
}

function setupButtons() {
    const buttons = document.querySelectorAll('[data-btn]');
    buttons.forEach((btn) => {
        btn.addEventListener('mousedown',  () => setPressed(btn.dataset.btn, true));
        btn.addEventListener('mouseup',    () => setPressed(btn.dataset.btn, false));
        btn.addEventListener('mouseleave', () => setPressed(btn.dataset.btn, false));
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); setPressed(btn.dataset.btn, true);  }, { passive: false });
        btn.addEventListener('touchend',   (e) => { e.preventDefault(); setPressed(btn.dataset.btn, false); }, { passive: false });
    });
}

function setupJoysticks() {
    function startDrag(side, e) {
        e.preventDefault();
        drag[side] = true;
    }

    if (elements.leftStick) {
        elements.leftStick.addEventListener('mousedown',  (e) => startDrag('left', e));
        elements.leftStick.addEventListener('touchstart', (e) => startDrag('left', e), { passive: false });
    }

    if (elements.rightStick) {
        elements.rightStick.addEventListener('mousedown',  (e) => startDrag('right', e));
        elements.rightStick.addEventListener('touchstart', (e) => startDrag('right', e), { passive: false });
    }
}

function setupTriggers() {
    function pressTrigger(side) {
        const key = side === 'left' ? 'l2' : 'r2';
        drag[key] = true;
        setPressed(key, true);
        if (side === 'left') state.l2Val = 1;
        else                 state.r2Val = 1;
        updateTriggerUI(side);
    }

    if (elements.triggerL2) {
        elements.triggerL2.addEventListener('mousedown',  (e) => { e.preventDefault(); pressTrigger('left');  });
        elements.triggerL2.addEventListener('touchstart', (e) => { e.preventDefault(); pressTrigger('left');  }, { passive: false });
    }

    if (elements.triggerR2) {
        elements.triggerR2.addEventListener('mousedown',  (e) => { e.preventDefault(); pressTrigger('right'); });
        elements.triggerR2.addEventListener('touchstart', (e) => { e.preventDefault(); pressTrigger('right'); }, { passive: false });
    }
}

function setupGlobalHandlers() {
    const move = (e) => {
        const point = getPointer(e);

        if (drag.left) {
            state.leftJS = getAnalogStick(point.clientX, point.clientY, elements.leftStick);
            updateJoystickUI('left');
        }
        if (drag.right) {
            state.rightJS = getAnalogStick(point.clientX, point.clientY, elements.rightStick);
            updateJoystickUI('right');
        }
        // Triggers stay at 1 while held — nothing to update on move
    };

    const up = () => {
        if (drag.left) {
            drag.left     = false;
            state.leftJS  = { x: 0, y: 0 };
            updateJoystickUI('left');
        }
        if (drag.right) {
            drag.right    = false;
            state.rightJS = { x: 0, y: 0 };
            updateJoystickUI('right');
        }
        if (drag.l2) {
            drag.l2      = false;
            state.l2Val  = 0;
            setPressed('l2', false);
            updateTriggerUI('left');
        }
        if (drag.r2) {
            drag.r2      = false;
            state.r2Val  = 0;
            setPressed('r2', false);
            updateTriggerUI('right');
        }
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend',  up);
}

function updateRosStatus() {
    if (!elements.rosStatus) return;
    elements.rosStatus.textContent = state.rosConnected ? 'ROS Connected' : 'ROS Disconnected';
}

function initROSBridge() {
    try {
        ros = new ROSLIB.Ros({ url: ROSBRIDGE_URL });

        ros.on('connection', () => {
            console.log('[ROS Bridge] Connected to rosbridge_server');
            state.rosConnected = true;
            updateRosStatus();

            joyPublisher = new ROSLIB.Topic({
                ros,
                name: '/joy/controller',
                messageType: 'sensor_msgs/Joy'
            });

            if (!joyPublishTimer) {
                joyPublishTimer = setInterval(publishJoy, 50);
            }
        });

        ros.on('error', (error) => {
            console.error('[ROS Bridge] Error:', error);
        });

        ros.on('close', () => {
            console.log('[ROS Bridge] Disconnected from rosbridge_server');
            state.rosConnected = false;
            updateRosStatus();
            setTimeout(initROSBridge, 2000);
        });
    } catch (e) {
        console.error('[ROS Bridge] Failed to initialize:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    updateActiveList();
    updateJoystickUI('left');
    updateJoystickUI('right');
    updateTriggerUI('left');
    updateTriggerUI('right');
    updateRosStatus();

    setupButtons();
    setupJoysticks();
    setupTriggers();
    setupGlobalHandlers();
    initROSBridge();

    setInterval(updateTime, 1000 * 30);
});