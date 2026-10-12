/**
 * Layered 3D hero composition (CSS 3D transforms, no WebGL).
 * Photographs sit on separate depth planes and tilt gently toward the pointer.
 * Static on touch devices and when the visitor prefers reduced motion.
 */
import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { MenuItem } from '../../types/index.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { LUX_IMAGES, hideOnError, luxImage } from './Reveal.tsx';

export const HeroStage: React.FC<{ dishes: MenuItem[] }> = ({ dishes }) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = innerRef.current;
    if (!el || reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [reduceMotion]);

  const primary = dishes[0];
  const secondary = dishes[1];
  const plateSrc = primary?.imageUrl || luxImage(LUX_IMAGES.dishA, 700);
  const sideSrc = secondary?.imageUrl || luxImage(LUX_IMAGES.dishB, 500);

  return (
    <div className="lux-stage relative w-full max-w-[520px] aspect-[5/6] mx-auto" aria-hidden="true">
      <div ref={innerRef} className="lux-stage-inner absolute inset-0">
        {/* Back plane: double gold frame */}
        <div className="lux-layer top-[2%] right-[0%] w-[74%] h-[80%] border border-gold/40" style={{ '--z': '-90px' } as React.CSSProperties}>
          <div className="absolute inset-3 border border-gold/15" />
        </div>

        {/* Main photograph: dining room */}
        <div
          className="lux-layer top-[7%] right-[6%] w-[70%] h-[76%] overflow-hidden shadow-[0_50px_80px_-30px_rgba(0,0,0,0.85)]"
          style={{ '--z': '0px' } as React.CSSProperties}
        >
          <img
            src={luxImage(LUX_IMAGES.diningRoom, 900)}
            alt=""
            onError={hideOnError}
            className="w-full h-full object-cover scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-ink/10" />
        </div>

        {/* Small square: second signature dish */}
        <div
          className="lux-layer top-[0%] left-[2%] w-[30%] aspect-square overflow-hidden border border-white/10 shadow-[0_30px_50px_-20px_rgba(0,0,0,0.8)] lux-layer-float"
          style={{ '--z': '70px', animationDelay: '-3s' } as React.CSSProperties}
        >
          <img src={sideSrc} alt="" onError={hideOnError} className="w-full h-full object-cover" />
        </div>

        {/* Plate: signature dish with slowly turning gold charger */}
        <div
          className="lux-layer bottom-[4%] left-[0%] w-[50%] aspect-square lux-layer-float"
          style={{ '--z': '120px' } as React.CSSProperties}
        >
          <svg viewBox="0 0 200 200" className="absolute -inset-[9%] w-[118%] h-[118%] lux-spin-slow text-gold">
            <circle cx="100" cy="100" r="97" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.6" />
            <circle cx="100" cy="100" r="91" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="1 5" />
          </svg>
          <div className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-champagne/40 shadow-[0_40px_70px_-20px_rgba(0,0,0,0.9)]">
            <img src={plateSrc} alt="" onError={hideOnError} className="w-full h-full object-cover scale-110" />
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),transparent_55%)]" />
          </div>
        </div>

        {/* Caption: real menu data only */}
        {primary && (
          <div
            className="lux-layer bottom-[14%] right-[0%] w-[46%] p-4 bg-ink/70 backdrop-blur-md border border-white/10"
            style={{ '--z': '160px' } as React.CSSProperties}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">From the kitchen</p>
            <p className="font-display text-xl leading-tight text-ivory mt-1.5 line-clamp-2">{primary.name}</p>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-ivory/55">{primary.categoryName || 'Signature'}</span>
              <span className="font-semibold text-champagne tabular-nums">{formatCurrency(primary.price)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
