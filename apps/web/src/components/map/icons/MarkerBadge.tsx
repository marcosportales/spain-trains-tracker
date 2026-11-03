import {
  GLYPH_PATHS,
  GLYPH_SHARE,
  GLYPH_UNITS,
  RUN_BADGE_RADIUS,
  RUN_BADGE_SIZE,
  RUN_GLYPH_COLOR,
} from './marker-icons';

const S = RUN_BADGE_SIZE;
const GLYPH_BOX = S * GLYPH_SHARE;

/**
 * A Run badge as drawn on the map (a white train on `color`, with the dot outline), for DOM
 * keys such as the legend. Pass a CSS colour, e.g. `serviceTypeVar(type)`, to follow the theme.
 */
export function MarkerBadge({ color, className = '' }: { color: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${S} ${S}`}
      className={`inline-block shrink-0 ${className}`}
    >
      <rect
        x={0.5}
        y={0.5}
        width={S - 1}
        height={S - 1}
        rx={RUN_BADGE_RADIUS - 0.5}
        fill={color}
        stroke="var(--color-dot-outline)"
      />
      <path
        d={GLYPH_PATHS.train}
        fill={RUN_GLYPH_COLOR}
        fillRule="evenodd"
        transform={`translate(${(S - GLYPH_BOX) / 2} ${(S - GLYPH_BOX) / 2}) scale(${GLYPH_BOX / GLYPH_UNITS})`}
      />
    </svg>
  );
}
