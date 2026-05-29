import React from 'react';

const LED_COUNT = 8;
const CX = 150;
const CY = 152;
const LED_RING_R = 108;
const BODY_R = 130;

function GamerBellWidget({ active, isPressed, screenText, onPress, onRelease }) {
  const leds = Array.from({ length: LED_COUNT }, (_, i) => {
    const angle = (i / LED_COUNT) * Math.PI * 2 - Math.PI / 2;
    return {
      x: CX + Math.cos(angle) * LED_RING_R,
      y: CY + Math.sin(angle) * LED_RING_R,
    };
  });

  const btnR = isPressed ? 39 : 41;
  const btnFill = isPressed ? '#c0392b' : '#e74c3c';

  return (
    <svg
      viewBox="0 0 300 320"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: '300px', display: 'block', margin: '0 auto', cursor: onPress ? 'pointer' : 'default' }}
      aria-label="GamerBell device"
    >
      <defs>
        <filter id="led-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="btn-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
        </filter>
        <radialGradient id="body-grad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#2c3e50" />
          <stop offset="100%" stopColor="#1a252f" />
        </radialGradient>
      </defs>

      {/* Drop shadow */}
      <circle cx={CX + 4} cy={CY + 6} r={BODY_R} fill="rgba(0,0,0,0.35)" />

      {/* Device body */}
      <circle cx={CX} cy={CY} r={BODY_R} fill="url(#body-grad)" />

      {/* Outer bezel ring */}
      <circle cx={CX} cy={CY} r={BODY_R} fill="none" stroke="#3d5166" strokeWidth="3" />
      <circle cx={CX} cy={CY} r={BODY_R - 7} fill="none" stroke="#243444" strokeWidth="1" opacity="0.6" />

      {/* 8 LEDs */}
      {leds.map(({ x, y }, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="7"
          fill={active ? '#2ecc71' : '#1a2a1a'}
          stroke={active ? '#27ae60' : '#0d1a0d'}
          strokeWidth="1"
          filter={active ? 'url(#led-glow)' : undefined}
        />
      ))}

      {/* Screen rectangle */}
      <rect x="90" y="75" width="120" height="54" rx="5" fill="#080e14" stroke="#1e3a52" strokeWidth="1.5" />
      {/* Screen scanlines effect */}
      <rect x="90" y="75" width="120" height="54" rx="5" fill="none" stroke="#0d2136" strokeWidth="0.5" opacity="0.5" />
      {screenText ? (
        <text x={CX} y="108" textAnchor="middle" fontSize="9" fill="#2ecc71"
          fontFamily="'Courier New', monospace" letterSpacing="0.5">
          {screenText.length > 18 ? screenText.slice(0, 18) + '…' : screenText}
        </text>
      ) : (
        <>
          <text x={CX} y="98" textAnchor="middle" fontSize="7" fill="#1a4a2a"
            fontFamily="'Courier New', monospace" letterSpacing="1">FITZNET BELL</text>
          <text x={CX} y="112" textAnchor="middle" fontSize="7" fill="#1a4a2a"
            fontFamily="'Courier New', monospace" letterSpacing="1">v1.0</text>
        </>
      )}

      {/* Button */}
      <circle
        cx={CX}
        cy={196}
        r={btnR}
        fill={btnFill}
        filter="url(#btn-shadow)"
        style={{ transition: 'r 0.08s ease, fill 0.08s ease' }}
        onMouseDown={onPress}
        onMouseUp={onRelease}
        onMouseLeave={onRelease}
        onTouchStart={onPress}
        onTouchEnd={onRelease}
      />
      {/* Button glint */}
      {!isPressed && (
        <ellipse cx={CX - 10} cy={182} rx="12" ry="7" fill="rgba(255,255,255,0.15)" />
      )}

      {/* Label */}
      <text x={CX} y="303" textAnchor="middle" fontSize="11" fill="#4a6072"
        fontFamily="'Courier New', monospace" letterSpacing="2">
        GAMERBELL
      </text>
    </svg>
  );
}

export default GamerBellWidget;
