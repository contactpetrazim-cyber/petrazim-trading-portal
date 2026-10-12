// Lightweight annotated screen sketch for the user guide (no image files).
export interface DiagramSpec { title: string; layout: 'nav' | 'chart' | 'order' | 'cards' | 'console'; callouts: string[] }

const BOXES: Record<DiagramSpec['layout'], [number, number, number, number][]> = {
  nav: [[10, 8, 300, 22], [10, 40, 300, 70], [10, 120, 300, 22]],
  chart: [[10, 8, 300, 20], [10, 34, 220, 108], [236, 34, 74, 108]],
  order: [[10, 8, 190, 134], [206, 8, 104, 60], [206, 74, 104, 68]],
  cards: [[10, 8, 145, 64], [165, 8, 145, 64], [10, 80, 300, 62]],
  console: [[10, 8, 300, 24], [10, 38, 145, 104], [165, 38, 145, 104]],
};

export function GuideDiagram({ spec, dark }: { spec: DiagramSpec; dark: boolean }) {
  const boxes = BOXES[spec.layout];
  const muted = dark ? 'text-corporate-text-on-hero/70' : 'text-corporate-text-on-bg/70';
  return (
    <figure className="mb-4 rounded-xl border border-corporate-accent/25 p-3">
      <svg viewBox="0 0 320 150" className="w-full h-auto text-corporate-accent" role="img" aria-label={spec.title}>
        {boxes.map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx="6" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.45" />
            {i < spec.callouts.length && (
              <g>
                <circle cx={x + 12} cy={y + 11} r="8" fill="currentColor" />
                <text x={x + 12} y={y + 14.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{i + 1}</text>
              </g>
            )}
          </g>
        ))}
      </svg>
      <figcaption className={`mt-2 text-xs ${muted}`}>
        <span className="font-semibold">{spec.title}</span>
        <ol className="mt-1 space-y-0.5">{spec.callouts.map((c, i) => <li key={c}>{i + 1}. {c}</li>)}</ol>
      </figcaption>
    </figure>
  );
}
