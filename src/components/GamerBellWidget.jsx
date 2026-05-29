import React from 'react';
import '../css/GamerBellWidget.css';

const LED_COUNT = 8;

function GamerBellWidget({ active, isPressed, screenText, onPress, onRelease }) {
  const leds = Array.from({ length: LED_COUNT }, (_, i) => ({
    angle: (i / LED_COUNT) * 360,
  }));

  return (
    <div className="gb-widget">

      {/* LED Ring */}
      <div className="gb-panel gb-panel--leds">
        <span className="gb-panel-label">LED Ring</span>
        <div className="gb-led-ring">
          {leds.map(({ angle }, i) => (
            <span
              key={i}
              className={`gb-led${active ? ' gb-led--on' : ''}`}
              style={{ '--a': `${angle}deg` }}
            />
          ))}
        </div>
      </div>

      {/* Screen */}
      <div className="gb-panel gb-panel--screen">
        <span className="gb-panel-label">Display</span>
        <div className="gb-lcd">
          <span className="gb-lcd-cursor">{'>'}</span>
          <span className="gb-lcd-text">
            {screenText || 'FITZNET BELL v1.0_'}
          </span>
        </div>
      </div>

      {/* Button */}
      <div className="gb-panel gb-panel--button">
        <span className="gb-panel-label">Button</span>
        <button
          className={`gb-btn${isPressed ? ' gb-btn--pressed' : ''}`}
          onMouseDown={onPress}
          onMouseUp={onRelease}
          onMouseLeave={onRelease}
          onTouchStart={onPress}
          onTouchEnd={onRelease}
          disabled={!onPress}
          aria-label="GamerBell press button"
        />
      </div>

    </div>
  );
}

export default GamerBellWidget;
