import React from 'react';
import { Icon } from '../icons';
import '../../css/recipes/doodles.css';

/**
 * The recipe box's little hand-drawn icons and illustrations, all inline SVG so they take the
 * theme's colours (`currentColor`) and cost no requests. Icons are decorative (aria-hidden): pair
 * them with text or an aria-label.
 */

export const WhiskIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3c-3.2 2.4-4.6 6.2-4.6 9.6 0 2.2 1.1 4.3 4.6 4.3s4.6-2.1 4.6-4.3C16.6 9.2 15.2 5.4 12 3Z" />
    <path d="M12 3v13.9M9.7 5.2c-.9 2.4-1.2 5.6-.3 9.6M14.3 5.2c.9 2.4 1.2 5.6.3 9.6" />
    <path d="M12 17v4" />
  </Icon>
);

export const SpoonIcon = (props) => (
  <Icon {...props}>
    <ellipse cx="9" cy="8" rx="4" ry="5" transform="rotate(-35 9 8)" />
    <path d="m12.2 11.2 7.8 8.6" />
  </Icon>
);

export const HeartIcon = ({ filled = false, ...props }) => (
  <Icon {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.5 12 20 12 20Z" />
  </Icon>
);

export const ClockIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
    <path d="M9.5 2.8h5" />
  </Icon>
);

export const PeopleIcon = (props) => (
  <Icon {...props}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 19.5c.4-3.4 2.8-5.2 6-5.2s5.6 1.8 6 5.2" />
    <path d="M16.2 5.6a3 3 0 0 1 0 5.8M18 14.6c1.8.6 2.8 2.2 3 4.6" />
  </Icon>
);

export const CameraIcon = (props) => (
  <Icon {...props}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
    <circle cx="12" cy="13" r="3.4" />
  </Icon>
);

export const ChevronUpIcon = (props) => (
  <Icon {...props}>
    <path d="m6 14 6-6 6 6" />
  </Icon>
);

export const ChevronDownIcon = (props) => (
  <Icon {...props}>
    <path d="m6 10 6 6 6-6" />
  </Icon>
);

export const ArrowLeftIcon = (props) => (
  <Icon {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const SlidersIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="17" r="2" />
  </Icon>
);

/** A cheerful bowl with a heart rising from it: the recipe box's empty state. */
export function BowlIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 160 130" className={`doodle ${className}`} aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="118" rx="52" ry="6" className="doodle__shadow" />
      <path d="M22 66h116c0 26-18 46-58 46S22 92 22 66Z" className="doodle__fill" />
      <path d="M22 66h116c0 26-18 46-58 46S22 92 22 66Z" className="doodle__line" />
      <path d="M18 66h124" className="doodle__line" />
      <path d="M44 84c3 6 9 10 16 12" className="doodle__shine" />
      <path d="M80 54s-17-9.5-17-22a9.6 9.6 0 0 1 17-6 9.6 9.6 0 0 1 17 6c0 12.5-17 22-17 22Z" className="doodle__heart" />
      <path d="M44 48c-4-5 4-8 0-14M116 48c4-5-4-8 0-14" className="doodle__steam" />
      <path d="M130 26l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5ZM30 18l1.800 4.200 4.200 1.800-4.200 1.800L30 30l-1.800-4.200L24 24l4.200-1.800Z" className="doodle__spark" />
    </svg>
  );
}

/** A magnifier over a plate, for a search with no matches. */
export function PlateSearchIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 160 130" className={`doodle ${className}`} aria-hidden="true" focusable="false">
      <ellipse cx="72" cy="112" rx="46" ry="6" className="doodle__shadow" />
      <circle cx="72" cy="66" r="42" className="doodle__fill" />
      <circle cx="72" cy="66" r="42" className="doodle__line" />
      <circle cx="72" cy="66" r="27" className="doodle__line doodle__line--soft" />
      <circle cx="108" cy="92" r="19" className="doodle__lens" />
      <circle cx="108" cy="92" r="19" className="doodle__line" />
      <path d="m121.5 105.5 18 18" className="doodle__line doodle__line--thick" />
      <path d="M101 90c1-4 4-6 8-6" className="doodle__shine" />
      <path d="M68 60c0-4 8-4 8 0M58 70c2 4 14 4 16 0" className="doodle__line doodle__line--soft" />
    </svg>
  );
}

/** The stand-in "photo" for a recipe without one: a plate with a whisk and spoon, tinted by the chapter. */
export function PlateIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 120 120" className={`doodle ${className}`} aria-hidden="true" focusable="false">
      <circle cx="60" cy="62" r="38" className="doodle__fill" />
      <circle cx="60" cy="62" r="38" className="doodle__line" />
      <circle cx="60" cy="62" r="25" className="doodle__line doodle__line--soft" />
      <path d="M60 74s-12-6.5-12-15a6.7 6.7 0 0 1 12-4 6.7 6.7 0 0 1 12 4c0 8.5-12 15-12 15Z" className="doodle__heart" />
      <path d="M14 34v22M10 34v8a4 4 0 0 0 8 0v-8M106 34c-5 0-7 6-7 14 0 5 2 8 7 8v24" className="doodle__line doodle__line--soft" />
    </svg>
  );
}
