import logoImg from '../assets/petrazim_logo.jpg';
import { LOGO_HEIGHT_PX } from '../config/theme';

/**
 * PetrazimLogo — always rendered at the specified height (default
 * 60px, per "use 60pts size"). Use this component everywhere the logo
 * appears rather than referencing the image directly, so a future
 * size change is a one-file edit.
 */
export function PetrazimLogo({ height = LOGO_HEIGHT_PX, className = '' }: { height?: number; className?: string }) {
  return (
    <img
      src={logoImg}
      alt="Petrazim Solutions Ltd"
      style={{ height: `${height}px`, width: 'auto' }}
      className={className}
    />
  );
}
