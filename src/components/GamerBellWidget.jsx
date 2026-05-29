import React from 'react';

const LED_COUNT = 8;
const LED_RING_RADIUS = 68;
const CX = 130;
const CY = 132;

function GamerBellWidget({ active, isPressed, onPress, onRelease }) {
  const leds = Array.from({ length: LED_COUNT }, (_, i) => {
    const angle = (i / LED_COUNT) * Math.PI * 2 - Math.PI / 2;
    return {
      x: CX + Math.cos(angle) * LED_RING_RADIUS,
      y: CY + Math.sin(angle) * LED_RING_RADIUS,
    };
  });

  const btnCY = isPressed ? CY + 3 : CY;

  return (
    <svg
      viewBox="0 0 260 280"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: '280px', display: 'block', margin: '0 auto' }}
      aria-label="GamerBell device"
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
    >
      {/* Drop shadow */}
      <rect x="20" y="20" width="220" height="220" rx="20" fill="rgba(0,0,0,0.18)" />

      {/* Base — blue */}
      <rect x="14" y="14" width="220" height="220" rx="20" fill="#1565c0" />

      {/* Lid — red */}
      <rect x="10" y="10" width="220" height="220" rx="20" fill="#c0392b" />

      {/* Lid inner highlight */}
      <rect x="22" y="22" width="196" height="196" rx="14" fill="none" stroke="#e57373" strokeWidth="1.2" opacity="0.35" />

      {/* Screw holes × 4 */}
      {[[32,32],[208,32],[32,208],[208,208]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="6" fill="#2a0a0a" />
      ))}

      {/* LEDs */}
      {leds.map(({ x, y }, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="7"
          fill={active ? '#2ecc71' : '#3a1a1a'}
          style={active ? { filter: 'drop-shadow(0 0 5px #2ecc71)' } : undefined}
        />
      ))}

      {/* Green collar */}
      <circle cx={CX} cy={CY} r="36" fill="#27ae60" />
      <circle cx={CX} cy={CY} r="36" fill="none" stroke="#1e8449" strokeWidth="2" />

      {/* Orange button */}
      <circle
        cx={CX}
        cy={btnCY}
        r="23"
        fill={isPressed ? '#d35400' : '#e67e22'}
        style={{ transition: 'cy 0.08s ease, fill 0.08s ease' }}
      />
      {/* Button glint */}
      <ellipse cx={CX - 5} cy={btnCY - 7} rx="8" ry="5" fill="rgba(255,255,255,0.18)" />

      {/* Label */}
      <text
        x={CX}
        y="250"
        textAnchor="middle"
        fontSize="12"
        fill="#90a4ae"
        fontFamily="'Courier New', monospace"
        letterSpacing="1.5"
      >
        FITZNET BELL v1.0
      </text>
    </svg>
  );
}

export default GamerBellWidget;
