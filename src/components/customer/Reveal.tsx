/**
 * Customer UI primitives: scroll reveal, curated imagery, cinematic page hero.
 * Presentation only — no data fetching or business logic lives here.
 */
import React from 'react';
import { m } from 'motion/react';

export const LUX_EASE = [0.22, 1, 0.36, 1] as const;

/** Unsplash images already used elsewhere in the application */
export const luxImage = (id: string, width = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&auto=format&fit=crop&q=80`;

export const LUX_IMAGES = {
  interior: '1517248135467-4c7edcad34c4',
  diningRoom: '1550966871-3ed3cdb5ed0c',
  hotel: '1566073771259-6a8506099945',
  plated: '1546069901-ba9599a7e63c',
  dishA: '1599488615731-7e5c2823ff28',
  dishB: '1603894584373-5ac82b2ae398',
  dishC: '1645177628172-a94c1f96e6db',
  dishD: '1567188040759-fb8a883dc6d8',
  dishE: '1544025162-d76694265947'
} as const;

/** Fades content up once it scrolls into view. Honors reduced motion via MotionConfig. */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}> = ({ children, delay = 0, y = 28, className }) => (
  <m.div
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.9, ease: LUX_EASE, delay }}
    className={className}
  >
    {children}
  </m.div>
);

/** Hides a broken remote image instead of showing the browser's broken-image icon */
export const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = 'hidden';
};

/**
 * Full-bleed cinematic banner used at the top of inner customer pages.
 * Place it as the first child of a page container that has no top padding.
 */
export const PageHero: React.FC<{
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  image?: string;
  children?: React.ReactNode;
  className?: string;
}> = ({ eyebrow, title, description, image = luxImage(LUX_IMAGES.interior, 1800), children, className = '' }) => (
  <section className={`lux-bleed relative overflow-hidden bg-ink text-ivory lux-grain ${className}`}>
    <img
      src={image}
      alt=""
      aria-hidden="true"
      onError={hideOnError}
      className="absolute inset-0 w-full h-full object-cover opacity-45 lux-kenburns"
    />
    <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/70 to-transparent" />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <m.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: LUX_EASE }}
          className="max-w-2xl"
        >
          <p className="lux-eyebrow text-gold">{eyebrow}</p>
          <h1 className="lux-display text-[clamp(2.5rem,6vw,4.75rem)] mt-5 text-ivory text-balance">{title}</h1>
          {description && (
            <p className="mt-5 text-sm sm:text-base text-ivory/65 leading-relaxed max-w-xl">{description}</p>
          )}
        </m.div>
        {children && (
          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: LUX_EASE, delay: 0.15 }}
            className="shrink-0"
          >
            {children}
          </m.div>
        )}
      </div>
    </div>
    <div className="absolute inset-x-0 bottom-0 lux-hairline" />
  </section>
);
