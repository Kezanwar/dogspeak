import { useEffect, useRef } from "react";

/**
 * DogHeadset — a self-drawing line-art dog wearing a headset.
 *
 * Self-contained: inlines its own keyframes (scoped `dh-*` class names), no deps.
 * - Line colour = `currentColor` (inherits the surrounding text colour).
 * - Accent (boom mic + pulsing sound waves) = `--dh-accent`, default #22c55e.
 * - Draws itself on once, then idles (gentle bob + looping mic waves) and leans
 *   subtly toward the pointer. Respects `prefers-reduced-motion`.
 *
 * Width is controlled by the parent (set a width on the wrapper via className/style).
 *
 *   <DogHeadset className="w-48 text-foreground" />
 */

const CSS = `
.dh{display:block}
.dh svg{display:block;width:100%;height:auto}
.dh-scene{transition:transform .25s cubic-bezier(.2,.7,.2,1)}

.dh-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:dh-draw .9s ease forwards var(--d,0s)}
@keyframes dh-draw{to{stroke-dashoffset:0}}

.dh-pop{opacity:0;transform:scale(.4);transform-box:fill-box;transform-origin:center;animation:dh-pop .5s ease forwards var(--d,0s)}
@keyframes dh-pop{to{opacity:1;transform:scale(1)}}

.dh-wave{opacity:0;transform-box:fill-box;transform-origin:left center;animation:dh-wave 2.6s ease-in-out infinite var(--d,0s)}
@keyframes dh-wave{0%{opacity:0;transform:translateX(0) scale(.55)}18%{opacity:.95}55%{opacity:0;transform:translateX(7px) scale(1.15)}100%{opacity:0}}

.dh-dog{transform-box:fill-box;transform-origin:center;animation:dh-bob 5.5s ease-in-out 2.6s infinite}
@keyframes dh-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}

.dh-d1{--d:.15s}.dh-d2{--d:.3s}.dh-d3{--d:.42s}.dh-d4{--d:.55s}.dh-d5{--d:.82s}
.dh-d6{--d:.92s}.dh-d7{--d:1.05s}.dh-d8{--d:1.18s}.dh-d9{--d:1.26s}.dh-d10{--d:1.35s}
.dh-d11{--d:1.42s}.dh-d12{--d:1.3s}.dh-d13{--d:1.6s}.dh-d14{--d:2s}.dh-d15{--d:2.3s}

@media (prefers-reduced-motion: reduce){
  .dh-draw{stroke-dashoffset:0;animation:none}
  .dh-pop{opacity:1;transform:none;animation:none}
  .dh-wave{opacity:.55;animation:none}
  .dh-dog{animation:none}
  .dh-scene{transition:none}
}
`;

type Props = {
  className?: string;
  /** Accent colour for the boom mic + sound waves. Defaults to #22c55e. */
  accent?: string;
  style?: React.CSSProperties;
};

export default function DogHeadset({ className, accent, style }: Props) {
  const sceneRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scene = sceneRef.current;
    if (!scene) return;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      scene.style.transform = `translate(${(dx * 10).toFixed(2)}px, ${(dy * 7).toFixed(2)}px)`;
    };
    // Ease back to centre when the pointer leaves the window: window never
    // gets pointerleave, but a pointerout with no relatedTarget means it
    // exited the page.
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) scene.style.transform = "translate(0,0)";
    };

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerout", onOut);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
    };
  }, []);

  return (
    <div
      className={`dh${className ? ` ${className}` : ""}`}
      style={{ ["--dh-accent" as string]: accent ?? "#22c55e", ...style }}
    >
      <style>{CSS}</style>
      <svg
        viewBox="0 0 260 236"
        role="img"
        aria-label="line drawing of a dog wearing a headset"
      >
        <g ref={sceneRef} className="dh-scene">
          <g
            className="dh-dog"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          >
            {/* headband */}
            <path
              className="dh-draw dh-d1"
              pathLength={1}
              d="M81 86 C96 52 164 52 179 86"
            />
            {/* ear cups */}
            <rect
              className="dh-draw dh-d2"
              pathLength={1}
              x="69"
              y="84"
              width="23"
              height="32"
              rx="10"
            />
            <rect
              className="dh-draw dh-d3"
              pathLength={1}
              x="168"
              y="84"
              width="23"
              height="32"
              rx="10"
            />

            {/* head */}
            <path
              className="dh-draw dh-d4"
              pathLength={1}
              d="M96 152 C80 134 82 104 95 86 C100 64 160 64 165 86 C178 104 180 134 164 152 C154 172 106 172 96 152 Z"
            />
            {/* ears */}
            <path
              className="dh-draw dh-d5"
              pathLength={1}
              d="M95 88 C70 94 58 122 69 152 C75 168 90 164 97 150"
            />
            <path
              className="dh-draw dh-d6"
              pathLength={1}
              d="M165 88 C190 94 202 122 191 152 C185 168 170 164 163 150"
            />

            {/* muzzle */}
            <path
              className="dh-draw dh-d7"
              pathLength={1}
              d="M112 126 C116 150 144 150 148 126"
            />
            {/* nose */}
            <path
              className="dh-draw dh-d8"
              pathLength={1}
              d="M123 120 C123 115 137 115 137 120 C137 127 123 127 123 120 Z"
            />
            {/* mouth */}
            <path
              className="dh-draw dh-d9"
              pathLength={1}
              d="M130 127 L130 136 M130 136 C125 142 118 140 116 135 M130 136 C135 142 142 140 144 135"
            />
            {/* eyes */}
            <circle
              className="dh-pop dh-d10"
              cx="112"
              cy="104"
              r="3.3"
              fill="currentColor"
              stroke="none"
            />
            <circle
              className="dh-pop dh-d11"
              cx="148"
              cy="104"
              r="3.3"
              fill="currentColor"
              stroke="none"
            />

            {/* boom mic arm */}
            <path
              className="dh-draw dh-d12"
              pathLength={1}
              d="M81 118 C77 142 95 152 110 143"
              stroke="var(--dh-accent)"
            />
            {/* mic tip */}
            <circle
              className="dh-pop dh-d13"
              cx="110"
              cy="143"
              r="4.2"
              fill="var(--dh-accent)"
              stroke="none"
            />

            {/* sound waves (loop) */}
            <g stroke="var(--dh-accent)" strokeWidth="2.2">
              <path
                className="dh-wave dh-d14"
                d="M118 135 C123 139 123 147 118 151"
              />
              <path
                className="dh-wave dh-d15"
                d="M125 130 C134 137 134 149 125 156"
              />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
