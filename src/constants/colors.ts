export const Colors = {
  // Backgrounds
  bg: '#09090F',
  surface: '#111119',
  elevated: '#1A1A2A',
  modal: '#161622',

  // Borders
  border: '#252538',
  borderSubtle: '#1D1D2E',

  // Accent (electric purple)
  accent: '#7C6AF7',
  accentBright: '#9B8DFF',
  accentSoft: 'rgba(124, 106, 247, 0.12)',
  accentGlow: 'rgba(124, 106, 247, 0.25)',

  // Gradient
  gradientStart: '#7C6AF7',
  gradientEnd: '#B068EE',
  gradientMid: '#9068EE',

  // Text
  textPrimary: '#F0EEFF',
  textSecondary: '#9090B8',
  textMuted: '#5A5A78',

  // Status
  statusDraft: '#5A5A78',
  statusOutlined: '#4A9EEA',
  statusInProgress: '#F5A623',
  statusPublished: '#4ECDC4',

  // Semantic
  success: '#4ECDC4',
  warning: '#F5A623',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const StatusColors: Record<string, string> = {
  draft: Colors.statusDraft,
  outlined: Colors.statusOutlined,
  'in-progress': Colors.statusInProgress,
  published: Colors.statusPublished,
};

export const StatusLabels: Record<string, string> = {
  draft: 'Draft',
  outlined: 'Outlined',
  'in-progress': 'In Progress',
  published: 'Published',
};
