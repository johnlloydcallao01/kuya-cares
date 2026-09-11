import type { Metadata } from "next";
import Image from "next/image";

const ctaUrl = "https://tap2go.menue.io/";

const featuredCards = [
  {
    title: "Pizza Favorites",
    description: "Show off signature slices, family trays, and best-selling specialties in a premium visual layout.",
    image:
      "https://images.pexels.com/photos/2619967/pexels-photo-2619967.jpeg?auto=compress&cs=tinysrgb&w=1200",
    stat: "Best sellers",
  },
  {
    title: "Burger Combos",
    description: "Feature juicy burgers, sides, and upgrades with a modern presentation built for hungry customers.",
    image:
      "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=1200",
    stat: "Combo ready",
  },
];

const benefits = [
  {
    icon: "fas fa-bolt",
    title: "Launch Faster",
    description:
      "Go live with a polished online menu experience designed to feel premium from the first impression.",
  },
  {
    icon: "fas fa-mobile-screen-button",
    title: "Mobile-First Design",
    description:
      "Built for customers who discover, browse, and order from their phones in just a few taps.",
  },
  {
    icon: "fas fa-layer-group",
    title: "Clear Menu Structure",
    description:
      "Organize categories, featured meals, and popular items in a way that reduces friction and boosts confidence.",
  },
  {
    icon: "fas fa-store",
    title: "Brand-Ready Presentation",
    description:
      "Showcase your food photography and menu personality with a layout that feels modern and trustworthy.",
  },
];

const highlights = [
  "Modern restaurant presentation",
  "Food-first visual storytelling",
  "One direct path to order",
];

export const metadata: Metadata = {
  title: "Get Started | Tap2Go",
  description:
    "A modern food landing page for restaurants ready to launch a professional online ordering experience with Tap2Go.",
};

export default function GetStartedPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(32,26,124,0.10),_transparent_38%),linear-gradient(180deg,_#fff_0%,_#f8fafc_100%)] text-slate-900">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute left-[-8rem] top-20 h-64 w-64 rounded-full bg-[#201a7c]/10 blur-3xl" />
          <div className="absolute right-[-6rem] top-8 h-72 w-72 rounded-full bg-[#ab3b43]/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.webp"
                alt="Tap2Go"
                width={40}
                height={40}
                className="rounded-xl"
                priority
              />
              <div>
                <p className="font-display text-lg font-semibold text-slate-900">Tap2Go</p>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Food Ordering Platform
                </p>
              </div>
            </div>
            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 md:block">
              Modern landing experience for food brands
            </div>
          </div>

          <div className="my-auto">
            <div className="grid items-center gap-10 rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_30px_100px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#201a7c]/10 bg-white/80 px-4 py-2 text-sm font-medium text-[#201a7c] shadow-sm backdrop-blur">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Built for modern restaurant discovery
                </div>

                <h1 className="heading-primary max-w-3xl text-4xl text-slate-950 sm:text-5xl lg:text-6xl">
                  A premium food landing page for pizza, burgers, and crave-worthy menus.
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                  Give customers a polished first impression with rich food visuals, modern layout, and a
                  focused experience that moves them straight into your live ordering flow.
                </p>

                <div className="mt-8 flex max-w-2xl flex-wrap gap-3 text-sm text-slate-600">
                  {highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="rounded-full border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur"
                    >
                      {highlight}
                    </div>
                  ))}
                </div>

                <div className="mt-10">
                  <a
                    href={ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#201a7c] to-[#ab3b43] px-8 py-4 font-semibold text-white shadow-[0_20px_45px_rgba(32,26,124,0.28)] transition-transform duration-300 hover:-translate-y-1"
                  >
                    Order Now!
                    <i className="fas fa-arrow-up-right-from-square ml-3 text-sm" />
                  </a>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  {benefits.map((benefit) => (
                    <div
                      key={benefit.title}
                      className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-sm"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg text-[#201a7c]">
                        <i className={benefit.icon} />
                      </div>
                      <h2 className="mt-4 text-xl font-semibold text-slate-950">{benefit.title}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{benefit.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-10 hidden h-24 w-24 rounded-3xl bg-[#201a7c]/10 blur-2xl lg:block" />
                <div className="absolute -right-2 bottom-10 hidden h-28 w-28 rounded-full bg-[#ab3b43]/10 blur-2xl lg:block" />

                <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-3 shadow-2xl backdrop-blur">
                  <div className="relative overflow-hidden rounded-[1.5rem]">
                    <Image
                      src="https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=1400"
                      alt="Fresh pizza and burger spread"
                      width={900}
                      height={1100}
                      className="h-[520px] w-full object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/20 bg-white/15 p-4 text-white backdrop-blur-md">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/75">Designed For</p>
                          <p className="mt-2 text-xl font-semibold">
                            Pizza, burgers, combos, and comfort food menus
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-slate-950/45 p-4 text-white backdrop-blur-md">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/75">Customer Experience</p>
                          <p className="mt-2 text-xl font-semibold">
                            Fast browsing, polished visuals, stronger trust
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {featuredCards.map((item) => (
                    <article
                      key={item.title}
                      className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
                    >
                      <div className="relative">
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={900}
                          height={700}
                          className="h-44 w-full object-cover"
                        />
                        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 backdrop-blur">
                          {item.stat}
                        </div>
                      </div>
                      <div className="p-5">
                        <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
