import React from 'react';

/** Inline SVG icons (no icon package). All are decorative: pair them with a text label or aria-label. */
function Icon({ children, size = 18, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SidebarIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
);

export const PlusIcon = (props) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const ChevronDownIcon = (props) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (props) => (
  <Icon {...props}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
);

export const MoreIcon = (props) => (
  <Icon {...props}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Icon>
);

export const PinIcon = (props) => (
  <Icon {...props}>
    <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
  </Icon>
);

export const PencilIcon = (props) => (
  <Icon {...props}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
  </Icon>
);

export const TrashIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
);

export const CloseIcon = (props) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const RefreshIcon = (props) => (
  <Icon {...props}>
    <path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5" />
  </Icon>
);

export const ArrowUpIcon = (props) => (
  <Icon {...props}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
);

export const StopIcon = (props) => (
  <Icon {...props} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Icon>
);

export const EyeIcon = (props) => (
  <Icon {...props}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const SparkIcon = (props) => (
  <Icon {...props}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z" />
  </Icon>
);

export const AlertIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3 2 20h20L12 3ZM12 10v4M12 17.5v.01" />
  </Icon>
);

export const CopyIcon = (props) => (
  <Icon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
);

export const RetryIcon = (props) => (
  <Icon {...props}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
  </Icon>
);

export const SwapIcon = (props) => (
  <Icon {...props}>
    <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </Icon>
);
