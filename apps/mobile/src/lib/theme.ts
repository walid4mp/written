export const palette = {
  ink: '#0B0B0C',
  ink2: '#121216',
  panel: '#17171B',
  panel2: '#1E1E24',
  line: '#2A2A31',
  gold: '#C9A227',
  goldSoft: '#E3C463',
  violet: '#7C3AED',
  text: '#ECECEF',
  muted: '#9A9AA5',
  ok: '#22C55E',
  bad: '#EF4444',
  warn: '#F59E0B',
  // reader themes
  sepia: '#F1E7D0',
  paper: '#FFFFFF',
  night: '#000000',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

export const space = (n: number) => n * 4;
