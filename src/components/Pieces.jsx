// Chess pieces as inline SVG.
//
// Unicode chess glyphs look fine until you measure them: the outlined (white)
// and filled (black) sets often resolve to different fonts with different
// metrics, so the white king can render a third larger than the black one and
// overflow its square. Which fonts get picked varies by platform, so there is
// no CSS fix. Drawing the pieces means every square is identical everywhere.
//
// All pieces share a 45x45 viewBox, a common base, and the same optical
// weight, so they read as one set.

const BASE = 'M10.4 39h24.2a1.5 1.5 0 0 1 1.4 1l.8 2.2a.9.9 0 0 1-.9 1.3H8.1a.9.9 0 0 1-.9-1.3l.8-2.2a1.5 1.5 0 0 1 1.4-1z';

// Every body is drawn down to y=39, where the shared base begins, so the
// pieces stand on their base instead of hovering above it.
const SHAPES = {
  p: [
    // Head, a defined neck, then a body that flares to the base.
    'M22.5 8a5.1 5.1 0 0 1 3.2 9.1c2.7 1.2 4.5 3.7 4.5 6.6 0 2.2-1 4.2-2.7 5.6 2.5 2 4.1 5.2 4.5 9.7H13c.4-4.5 2-7.7 4.5-9.7a7.3 7.3 0 0 1-2.7-5.6c0-2.9 1.8-5.4 4.5-6.6A5.1 5.1 0 0 1 22.5 8z',
    BASE,
  ],
  r: [
    // Crenellations, a tapered shaft, then a flared foot.
    'M11 9.5h5v3.4h4.2V9.5h4.6v3.4H29V9.5h5v8.2l-3.1 2.7v11.3l3.4 7.3H10.7l3.4-7.3V20.4L11 17.7z',
    BASE,
  ],
  n: [
    // A horse in profile: muzzle to the left, mane sweeping back to the right.
    'M18.4 8.5c1.1 1 1.7 2.1 1.9 3.4 3.6.2 6.8 1.7 9.1 4.3 2.5 2.8 3.7 6.7 3.7 11.4V39H12.6v-5.6c0-3.4 1.2-6.3 3.4-8.7 1.4-1.5 3-2.8 4.8-4-.4-.7-1-1.2-1.8-1.6l-3 3.2-2.9-1.7 1-3.8c.5-2 1.5-3.7 3-5l.7-3.3z',
    'M17.6 18.9a1.35 1.35 0 1 1 0-2.7 1.35 1.35 0 0 1 0 2.7z',
    BASE,
  ],
  b: [
    // Finial, mitre with its slit, then the collar.
    'M22.5 7.2a2.4 2.4 0 0 1 1.7 4.1c2.6 3 5.6 6.8 5.6 10.6 0 3.6-2.4 6.6-5.7 7.7 2.6 1.6 4.4 5 4.8 9.4H16.1c.4-4.4 2.2-7.8 4.8-9.4-3.3-1.1-5.7-4.1-5.7-7.7 0-3.8 3-7.6 5.6-10.6a2.4 2.4 0 0 1 1.7-4.1z',
    'M20.2 19.4h4.6M22.5 17.1v4.6',
    BASE,
  ],
  q: [
    // Five orbs over a flared crown, then two bands down to the base.
    'M9.6 14.6a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM16 11.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM22.5 10a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM29 11.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM35.4 14.6a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2z',
    'M10.6 16.4l3.4 8.1h17l3.4-8.1 -4.6 3.2 -2.4-7.4 -3.4 6.6h-2.4l-3.4-6.6 -2.4 7.4z',
    'M14 25.5h17l1.7 5.4c-3.2 1.1-6.8 1.7-10.2 1.7s-7-.6-10.2-1.7z',
    'M12.3 32.6c3.3 1 6.8 1.5 10.2 1.5s6.9-.5 10.2-1.5L34.3 39H10.7z',
    BASE,
  ],
  k: [
    // Cross, a small crowned head, then shoulders flaring to the base.
    'M22.5 4.6v9.2M18.6 8.4h7.8',
    'M22.5 13.2a5.3 5.3 0 0 1 3.9 8.9h3.7c3 0 5.5 2.1 5.5 4.7 0 1.9-.8 4.3-2.3 7.1L31.7 39H13.3l-1.6-5.1c-1.5-2.8-2.3-5.2-2.3-7.1 0-2.6 2.5-4.7 5.5-4.7h3.7a5.3 5.3 0 0 1 3.9-8.9z',
    'M12.6 31.6c3.2 1 6.6 1.5 9.9 1.5s6.7-.5 9.9-1.5',
    BASE,
  ],
};

/** Which entries are stroked outlines rather than filled shapes. */
const STROKE_ONLY = { b: [1], k: [0, 2] };

export default function PieceIcon({ type, color, title }) {
  const shapes = SHAPES[type];
  if (!shapes) return null;
  const strokeOnly = STROKE_ONLY[type] ?? [];

  return (
    <svg
      className={`piece piece--${color}`}
      viewBox="0 0 45 45"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {shapes.map((d, index) => (
          <path
            key={d}
            d={d}
            fill={strokeOnly.includes(index) ? 'none' : undefined}
            strokeWidth={strokeOnly.includes(index) ? 2 : 1.6}
          />
        ))}
      </g>
    </svg>
  );
}
