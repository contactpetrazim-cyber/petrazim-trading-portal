import { PetrazimLogo } from './PetrazimLogo';

/**
 * CardLogoBand — the shared logo header for every "important moment"
 * card (Login, Access Expired, Portal Selection, and any new one
 * added to that family later): a full-width band, bled edge-to-edge
 * against the card's own p-8 padding and matching its rounded-3xl top
 * corners, holding a centered 56px logo.
 *
 * Supersedes the design handover's original recipe for this family —
 * a 32px logo, top-left, flex justify-start — per direct instruction
 * to size the logo up and give it a full-width band everywhere this
 * pattern appears, not just on the login card. The band's own
 * explicit white background is what makes this safe on any surface:
 * it's the same solid color as the card underneath it, so there's no
 * seam the way there would be if this sat on a tinted or gradient
 * surface instead (a box smaller than that surface leaves a sliver of
 * the surface's color showing around the white).
 */
export function CardLogoBand() {
  return (
    <div className="-mx-8 -mt-8 mb-6 py-5 flex justify-center bg-white rounded-t-3xl">
      <PetrazimLogo height={56} />
    </div>
  );
}
