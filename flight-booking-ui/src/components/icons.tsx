type P = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode, vb = '0 0 24 24') => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const PlaneIcon = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <path transform="rotate(90 12 12)" fill="currentColor" stroke="none" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />,
  );

export const ArrowRight = ({ size = 14, className }: P) => svg(size, className, <path d="M5 12h14M13 6l6 6-6 6" />);
export const ChevronLeft = ({ size = 14, className }: P) => svg(size, className, <path d="M15 6l-6 6 6 6" />);
export const Check = ({ size = 12, className }: P) => svg(size, className, <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const SendIcon = ({ size = 16, className }: P) => svg(size, className, <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />);
export const MicIcon = ({ size = 16, className }: P) =>
  svg(size, className, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>);
export const MicOffIcon = ({ size = 16, className }: P) =>
  svg(size, className, <><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 10V6a3 3 0 0 0-5.7-1.3" /><path d="M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3" /></>);
export const BagIcon = ({ size = 14, className }: P) =>
  svg(size, className, <><rect x="5" y="7" width="14" height="13" rx="2" /><path d="M9 7V4h6v3M9 20v1M15 20v1" /></>);
export const SparkIcon = ({ size = 12, className }: P) => svg(size, className, <path d="M4 20c4-1 7-4 8-8M12 12c1-4 4-7 8-8M14 4h6v6" />);
