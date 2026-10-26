/**
 * Landing Page for ABC Hotel & Restaurant
 * Light, editorial presentation. Optimized for mobile, tablet, and desktop viewports.
 */
import React, { useEffect, useRef, useState } from 'react';
import { m, useScroll, useTransform } from 'motion/react';
import {
  Calendar,
  UtensilsCrossed,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  Wine,
  HeartHandshake,
  Clock,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { MenuItem } from '../types/index.ts';
import { MenuApi } from '../api/index.ts';
import { MenuItemCard } from '../components/menu/MenuItemCard.tsx';
import { Spinner } from '../components/common/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { HeroStage } from '../components/customer/HeroStage.tsx';
import { LUX_EASE, LUX_IMAGES, Reveal, hideOnError, luxImage } from '../components/customer/Reveal.tsx';

const DINING_MODES = [
  {
    title: 'Dine-in',
    caption: 'At your table',
    text: 'Order at the table, add courses as the evening unfolds, and settle when you leave.',
    image: luxImage(LUX_IMAGES.diningRoom, 900)
  },
  {
    title: 'Room Service',
    caption: 'To your suite',
    text: 'The full menu, prepared to order and brought to your room.',
    image: luxImage(LUX_IMAGES.hotel, 900)
  },
  {
    title: 'Takeaway',
    caption: 'Ready to collect',
    text: 'Order ahead and collect your meal freshly packed from our kitchen.',
    image: luxImage(LUX_IMAGES.dishB, 900)
  },
  {
    title: 'Delivery',
    caption: 'To your door',
    text: 'Restaurant-grade dishes delivered, with live tracking from kitchen to doorstep.',
    image: luxImage(LUX_IMAGES.dishC, 900)
  }
];

const STANDARDS = [
  {
    title: 'Your Table, Guaranteed',
    text: 'The table you choose is held exclusively for you the moment you book, so there are never double bookings.'
  },
  {
    title: 'Authentic Artisanal Ingredients',
    text: 'Farm-fresh produce, slow-cooked overnight curries, hand-ground spices and cold-pressed oils, with no preservatives.'
  },
  {
    title: 'Real-Time Kitchen Tracking',
    text: "Follow your order live from the chef's tandoor to your table or suite, with accurate preparation milestones."
  }
];

export const HomePage: React.FC<{ navigate: (route: string, state?: any) => void }> = ({ navigate }) => {
  const { isAuthenticated } = useAuth();
  const [featuredDishes, setFeaturedDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-12%']);
  const stageY = useTransform(scrollYProgress, [0, 1], ['0%', '-22%']);
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const storyRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: storyProgress } = useScroll({ target: storyRef, offset: ['start end', 'end start'] });
  const storyBackY = useTransform(storyProgress, [0, 1], ['6%', '-6%']);
  const storyFrontY = useTransform(storyProgress, [0, 1], ['18%', '-18%']);

  const handleBookTable = () => {
    if (isAuthenticated) {
      navigate('book-table');
    } else {
      navigate('login', {
        returnTo: 'book-table',
        message: 'Please login or register to book a table.'
      });
    }
  };

  const handleBookOrder = () => {
    if (isAuthenticated) {
      navigate('menu');
    } else {
      navigate('login', {
        returnTo: 'menu',
        message: 'Please login or register to place an order.'
      });
    }
  };

  useEffect(() => {
    async function loadFeatured() {
      try {
        const items = await MenuApi.getItems({ sortBy: 'popular' });
        setFeaturedDishes(items.filter((i) => i.isChefSpecial).slice(0, 4));
      } catch (err) {
        console.error('Failed to load featured dishes', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  return (
    <div className="lux-home overflow-x-clip">
      {/* ------------------------------------------------------------------ */}
      {/* Cinematic Hero                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section
        ref={heroRef}
        className="relative min-h-[calc(100svh-4.5rem)] ambient text-stone-900 overflow-hidden flex items-center"
      >
        <m.div style={{ y: bgY }} className="absolute inset-0 will-change-transform">
          <img
            src={luxImage(LUX_IMAGES.interior, 2000)}
            alt="Candle-lit dining room at ABC Hotel"
            fetchPriority="high"
            onError={hideOnError}
            className="w-full h-full object-cover opacity-30 saturate-[0.85] lux-kenburns"
          />
        </m.div>
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--page-bg)] via-[var(--page-bg)]/92 to-[var(--page-bg)]/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--page-bg)] via-transparent to-[var(--page-bg)]/70" />
        <div className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full bg-champagne/45 blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-48 right-[-12%] w-[560px] h-[560px] rounded-full bg-[var(--brand-soft)] blur-[120px] pointer-events-none" />

        <m.div
          style={{ opacity: heroFade }}
          className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 sm:pt-16 lg:pt-14 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center"
        >
          <m.div style={{ y: contentY }}>
            <m.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: LUX_EASE, delay: 0.1 }}
              className="lux-eyebrow text-amber-700"
            >
              ABC Hotel · Fine Dining & Suites
            </m.p>

            <h1 className="lux-display mt-7 text-[clamp(3.1rem,8.4vw,7.4rem)] text-stone-900">
              <m.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: LUX_EASE, delay: 0.2 }}
                className="block"
              >
                Exceptional Dining.
              </m.span>
              <m.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: LUX_EASE, delay: 0.35 }}
                className="block italic font-normal text-[var(--brand)]"
              >
                Unforgettable Evenings.
              </m.span>
            </h1>

            <m.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: LUX_EASE, delay: 0.55 }}
              className="mt-7 max-w-lg text-[15px] sm:text-base text-stone-600 leading-relaxed"
            >
              Reserve your table, explore our menu, and enjoy heritage recipes reimagined with modern culinary
              artistry, served at your table, in your suite, or at your door.
            </m.p>

            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: LUX_EASE, delay: 0.7 }}
              className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <button onClick={handleBookOrder} className="lux-btn lux-btn-wine">
                <UtensilsCrossed className="w-4 h-4" />
                <span>Order from the Menu</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={handleBookTable} className="lux-btn lux-btn-outline bg-white/60">
                <Calendar className="w-4 h-4" />
                <span>Reserve a Table</span>
              </button>
            </m.div>

            <m.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, delay: 1 }}
              className="mt-14 grid grid-cols-3 gap-4 max-w-lg border-t border-stone-300/70 pt-6"
            >
              <div>
                <dt className="text-[9.5px] uppercase tracking-[0.24em] text-stone-500">Open Daily</dt>
                <dd className="font-display text-lg sm:text-2xl text-stone-900 mt-1">9 AM – 11 PM</dd>
              </div>
              <div>
                <dt className="text-[9.5px] uppercase tracking-[0.24em] text-stone-500">Ways to Dine</dt>
                <dd className="font-display text-lg sm:text-2xl text-stone-900 mt-1">Four</dd>
              </div>
              <div>
                <dt className="text-[9.5px] uppercase tracking-[0.24em] text-stone-500">Orders</dt>
                <dd className="font-display text-lg sm:text-2xl text-stone-900 mt-1">Live Tracked</dd>
              </div>
            </m.dl>
          </m.div>

          <m.div
            style={{ y: stageY }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, ease: LUX_EASE, delay: 0.3 }}
            className="hidden lg:block"
          >
            <HeroStage dishes={featuredDishes} />
          </m.div>
        </m.div>

        {/* Scroll cue */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-3 text-[9px] uppercase tracking-[0.3em] text-stone-500">
          <span>Scroll</span>
          <span className="w-px h-10 bg-stone-300/70 overflow-hidden">
            <span className="block w-full h-full bg-[var(--brand)] lux-scroll-cue" />
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Reservation in three moments                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative bg-[var(--surface)] text-stone-900 border-y border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-6 md:gap-10 items-center">
          {[
            { icon: Calendar, step: '01', label: 'Select Date & Time' },
            { icon: UtensilsCrossed, step: '02', label: 'Pick Table & Floor' },
            { icon: ShieldCheck, step: '03', label: 'Instant Guarantee' }
          ].map(({ icon: Icon, step, label }, i) => (
            <Reveal key={step} delay={i * 0.08} y={16}>
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 shrink-0 rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] flex items-center justify-center text-amber-700">
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.26em] text-stone-500">Step {step}</p>
                  <p className="font-display text-xl text-stone-900 mt-0.5">{label}</p>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.24} y={16}>
            <button onClick={handleBookTable} className="lux-btn lux-btn-wine w-full md:w-auto">
              <span>Reserve Table Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Story                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-10 items-center">
          <div ref={storyRef} className="lg:col-span-6 relative h-[420px] sm:h-[560px]">
            <m.div
              style={{ y: storyBackY }}
              className="absolute top-0 left-0 w-[78%] h-[82%] overflow-hidden rounded-2xl lux-zoom shadow-[0_40px_80px_-40px_rgba(48,18,52,0.5)]"
            >
              <img
                src={luxImage(LUX_IMAGES.diningRoom, 1100)}
                alt="The ABC Hotel dining room"
                loading="lazy"
                onError={hideOnError}
                className="w-full h-full object-cover"
              />
            </m.div>
            <m.div
              style={{ y: storyFrontY }}
              className="absolute bottom-0 right-0 w-[52%] h-[52%] overflow-hidden rounded-2xl border-[6px] border-white shadow-[0_40px_80px_-30px_rgba(48,18,52,0.55)] lux-zoom"
            >
              <img
                src={luxImage(LUX_IMAGES.plated, 800)}
                alt="A plated dish from the ABC kitchen"
                loading="lazy"
                onError={hideOnError}
                className="w-full h-full object-cover"
              />
            </m.div>
            <div className="absolute -bottom-6 left-[8%] w-24 h-24 border border-gold/50 -z-10 hidden sm:block" />
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal>
              <p className="lux-eyebrow text-amber-700">About ABC Hotel & Fine Dining</p>
              <h2 className="lux-display text-[clamp(2.5rem,5vw,4.25rem)] text-stone-900 mt-6 text-balance">
                A legacy of regal flavours <em className="text-wine font-normal">&amp; sophisticated comfort.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-7 text-stone-600 text-[15px] leading-[1.8]">
                Established with an enduring passion for culinary excellence, ABC Hotel blends timeless architectural
                elegance with bespoke hospitality. Our chefs draw inspiration from time-honoured royal recipes and fresh
                organic harvests, presenting authentic delicacies with care.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
                <div className="bg-ivory p-6">
                  <Wine className="w-6 h-6 text-wine" strokeWidth={1.4} />
                  <h3 className="font-display text-2xl text-stone-900 mt-4">Fine Dining Cellar</h3>
                  <p className="text-[13px] text-stone-500 mt-1.5 leading-relaxed">Artisanal mocktails & global botanical infusions.</p>
                </div>
                <div className="bg-ivory p-6">
                  <HeartHandshake className="w-6 h-6 text-wine" strokeWidth={1.4} />
                  <h3 className="font-display text-2xl text-stone-900 mt-4">White-Glove Service</h3>
                  <p className="text-[13px] text-stone-500 mt-1.5 leading-relaxed">Dedicated concierge and customized event styling.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Chef's signature dishes (live menu data)                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-cream/60 border-y border-stone-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-28">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 sm:mb-14">
            <Reveal>
              <p className="lux-eyebrow text-amber-700">Culinary Highlights</p>
              <h2 className="lux-display text-[clamp(2.5rem,5vw,4.25rem)] text-stone-900 mt-5">
                Chef&rsquo;s <em className="font-normal text-wine">Signature</em> Dishes
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <button
                onClick={() => navigate('menu')}
                className="lux-link text-[11px] font-bold uppercase tracking-[0.22em] text-stone-900 cursor-pointer"
              >
                <span>View Complete Menu</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Reveal>
          </div>

          {loading ? (
            <Spinner text="Loading gourmet specials..." />
          ) : featuredDishes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {featuredDishes.map((item, i) => (
                <Reveal key={item.id} delay={i * 0.08}>
                  <MenuItemCard item={item} />
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-stone-300">
              <p className="font-display text-2xl text-stone-800">Our full menu awaits.</p>
              <button onClick={() => navigate('menu')} className="lux-btn lux-btn-outline mt-6">
                Browse the Menu
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Ways to dine                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative bg-[var(--surface)] text-stone-900 overflow-hidden border-y border-[var(--border-subtle)]">
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-champagne/35 blur-[140px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="grid lg:grid-cols-2 gap-6 items-end mb-14">
            <Reveal>
              <p className="lux-eyebrow text-amber-700">The Experience</p>
              <h2 className="lux-display text-[clamp(2.5rem,5vw,4.25rem)] text-stone-900 mt-5">
                One kitchen. <em className="font-normal text-[var(--brand)]">Four ways to dine.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-stone-600 text-[15px] leading-relaxed lg:max-w-md lg:ml-auto">
                Whether you are seated in our dining room, resting in your suite, or ordering from home, every dish is
                prepared fresh to order.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 [perspective:1200px]">
            {DINING_MODES.map((mode, i) => (
              <Reveal key={mode.title} delay={i * 0.08}>
                <button
                  onClick={handleBookOrder}
                  className="group relative block w-full text-left aspect-[3/4] overflow-hidden rounded-2xl bg-charcoal shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-float)] cursor-pointer transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:[transform:rotateX(3deg)_translateY(-6px)] focus-visible:[transform:translateY(-6px)]"
                  aria-label={`${mode.title}: ${mode.text}`}
                >
                  <img
                    src={mode.image}
                    alt=""
                    loading="lazy"
                    onError={hideOnError}
                    className="absolute inset-0 w-full h-full object-cover opacity-70 transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07] group-hover:opacity-85"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent" />
                  <div className="absolute inset-3 rounded-xl border border-white/0 group-hover:border-gold/50 transition-colors duration-700" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="text-[9.5px] uppercase tracking-[0.28em] text-gold">{mode.caption}</p>
                    <div className="flex items-end justify-between gap-3 mt-2">
                      <h3 className="font-display text-3xl text-ivory leading-none">{mode.title}</h3>
                      <ArrowUpRight className="w-5 h-5 text-champagne shrink-0 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" />
                    </div>
                    <p className="text-[13px] text-ivory/60 leading-relaxed mt-3 max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-focus-visible:max-h-24 group-focus-visible:opacity-100 transition-all duration-700 overflow-hidden">
                      {mode.text}
                    </p>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The ABC Standard                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="lux-eyebrow text-amber-700">The ABC Standard</p>
          <h2 className="lux-display text-[clamp(2.5rem,5vw,4.25rem)] text-stone-900 mt-5">Why dine at ABC Hotel</h2>
          <p className="text-stone-500 text-[15px] mt-5 leading-relaxed">
            Every detail is considered to deliver an effortless, gracious and flavourful experience.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 border-t border-stone-300/70">
          {STANDARDS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className={`pt-10 pb-4 md:px-8 ${i > 0 ? 'md:border-l border-stone-300/70' : ''} ${i === 0 ? 'md:pl-0' : ''}`}>
                <span className="font-display text-6xl text-gold/80 italic leading-none">0{i + 1}</span>
                <h3 className="font-display text-[1.75rem] text-stone-900 mt-6 leading-tight">{s.title}</h3>
                <p className="text-[14px] text-stone-500 leading-[1.75] mt-3">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Visit                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 lux-card rounded-2xl overflow-hidden">
          <div className="relative min-h-[300px] lux-zoom overflow-hidden">
            <img
              src={luxImage(LUX_IMAGES.interior, 1200)}
              alt="Evening ambience at the ABC Hotel restaurant"
              loading="lazy"
              onError={hideOnError}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-ink/50 to-transparent" />
          </div>
          <div className="p-8 sm:p-12 lg:p-14">
            <Reveal>
              <p className="lux-eyebrow text-amber-700">Visit Us</p>
              <h2 className="lux-display text-[clamp(2.25rem,4vw,3.5rem)] text-stone-900 mt-5">Hours & location</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <ul className="mt-10 space-y-6 text-[15px] text-stone-600">
                <li className="flex gap-4">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <p className="text-stone-900 font-semibold">Daily Dining</p>
                    <p>09:00 AM – 11:00 PM</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>742 Heritage Promenade, Royal Gardens, Sector 4</span>
                </li>
                <li className="flex gap-4">
                  <Phone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <a href="tel:+912249876543" className="lux-link hover:text-stone-900">+91 22 4987 6543</a>
                </li>
                <li className="flex gap-4">
                  <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <a href="mailto:concierge@abchotel.com" className="lux-link hover:text-stone-900">concierge@abchotel.com</a>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Closing call to action                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-[var(--brand-soft)] text-stone-900 border-t border-[var(--border-subtle)]">
        <img
          src={luxImage(LUX_IMAGES.plated, 1800)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={hideOnError}
          className="absolute inset-0 w-full h-full object-cover opacity-[0.14] mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--page-bg)]/90 via-[var(--brand-soft)]/70 to-champagne/50" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <Reveal>
            <p className="lux-eyebrow text-amber-700 justify-center">An Evening at ABC</p>
            <h2 className="lux-display text-[clamp(2.75rem,7vw,5.75rem)] text-stone-900 mt-6">
              Your table <em className="font-normal text-[var(--brand)]">awaits.</em>
            </h2>
            <p className="text-stone-600 text-[15px] sm:text-base leading-relaxed mt-6 max-w-xl mx-auto">
              Reserve your table today or order from our menu directly to your suite or doorstep.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <button onClick={handleBookTable} className="lux-btn lux-btn-wine">
                <span>Reserve Your Table</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={handleBookOrder} className="lux-btn lux-btn-outline bg-white/60">
                Browse Menu
              </button>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};
