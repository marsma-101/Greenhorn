import React from 'react';

type IconProps = {
  size?: number;
  className?: string;
  title?: string;
};

const base = (size = 20, strokeWidth = 1.75) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconDocument = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);

export const IconGear = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconRobot = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="8.5" cy="16" r="1.25" fill="currentColor" />
    <circle cx="15.5" cy="16" r="1.25" fill="currentColor" />
    <path d="M12 3v4" />
    <circle cx="12" cy="2.5" r="1" fill="currentColor" />
    <path d="M12 11V9" />
  </svg>
);

export const IconPalette = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <circle cx="13.5" cy="6.5" r="1" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r="1" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r="1" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6 2 11a5.5 5.5 0 0 0 5.5 5.5h1.1a2.4 2.4 0 0 1 2.4 2.4 2.4 2.4 0 0 1-2.4 2.4H8a1.5 1.5 0 0 0 0 3h1a7 7 0 0 0 7-7c0-3.9-.5-7-4-7h2c2.8 0 5.5 1.7 6 4 .2 1.2-.3 2.2-1.5 2.2h-1.5a1.5 1.5 0 0 0 0 3h1.5a4.5 4.5 0 0 0 4.5-4.5c0-5.3-5.2-9.4-11-9.4" />
  </svg>
);

export const IconFolder = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const IconBolt = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const IconPin = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 1.8)} className={className} aria-label={title} style={{ transform: 'rotate(45deg)' }}>
    <title>{title}</title>
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
);

export const IconPaperclip = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 1.8)} className={className} aria-label={title} style={{ transform: 'rotate(-45deg)' }}>
    <title>{title}</title>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

export const IconBulb = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z" />
  </svg>
);

export const IconLeaf = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 1.8)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M11 20A7 7 0 0 1 4 13V9a7 7 0 0 1 7-7 7 7 0 0 1 7 7 7 7 0 0 1-7 7z" />
    <path d="M4 13a7 7 0 0 0 7 7" />
  </svg>
);

export const IconArrowLeft = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const IconX = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 2)} className={className} aria-label={title}>
    <title>{title}</title>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconEdit = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const IconTrash = ({ size, className, title }: IconProps) => (
  <svg {...base(size)} className={className} aria-label={title}>
    <title>{title}</title>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

export const IconPlus = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 2)} className={className} aria-label={title}>
    <title>{title}</title>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconChevronDown = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 2)} className={className} aria-label={title}>
    <title>{title}</title>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const IconCheck = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 2)} className={className} aria-label={title}>
    <title>{title}</title>
    <polyline points="5 12 10 17 19 8" />
  </svg>
);

export const IconLink = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 2)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export const IconSparkles = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 2)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M12 3l1.9 4.6L18 9.5l-4.1 1.9L12 16l-1.9-4.6L6 9.5l4.1-1.9L12 3z" />
    <path d="M19 14l.8 2 2 .8-2 .8L19 19.5l-.8-2-2-.8 2-.8L19 14z" />
    <path d="M5 15l.6 1.5 1.5.6-1.5.6L5 19.2l-.6-1.5-1.5-.6 1.5-.6L5 15z" />
  </svg>
);

export const IconWrench = ({ size, className, title }: IconProps) => (
  <svg {...base(size, 2)} className={className} aria-label={title}>
    <title>{title}</title>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4 2.6-2.6z" />
  </svg>
);
