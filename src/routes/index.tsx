import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Heart, Leaf, Sparkles } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/salon";
import heroImage from "@/assets/hero.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumière Nails — Gel Polish Studio in Tel Aviv" },
      {
        name: "description",
        content:
          "Boutique gel polish, structure gel and pedicure studio. Choose your service, pick a time and book online in under a minute.",
      },
      { property: "og:title", content: "Lumière Nails — Gel Polish Studio" },
      {
        property: "og:description",
        content: "Book gel polish, structure gel and pedicure appointments online.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="surface-hero relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="eyebrow">Gel polish studio</p>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-7xl">
              Quiet luxury
              <br />
              <span className="text-gradient-rose italic">for your hands.</span>
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              Careful prep, clean lines and a finish that lasts for weeks. One chair, one client at
              a time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-8 shadow-soft">
                <Link to="/book">
                  Book appointment <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                <a href="#services">View services</a>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> 3-week wear
              </span>
              <span className="flex items-center gap-2">
                <Leaf className="size-4 text-primary" /> Gentle e-file prep
              </span>
              <span className="flex items-center gap-2">
                <Heart className="size-4 text-primary" /> Sterile tools
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] shadow-soft">
              <img
                src={heroImage}
                alt="Hands with a glossy nude gel manicure resting on silk"
                width={1408}
                height={1600}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-xl">
          <p className="eyebrow">The menu</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Services &amp; pricing</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <article
              key={service.id}
              className="shadow-card rounded-3xl border border-border/70 bg-card p-6 transition-transform hover:-translate-y-1"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                <h3 className="truncate text-2xl">{service.name}</h3>
                <span className="shrink-0 text-lg text-primary">{service.price}</span>
              </div>
              <p className="eyebrow mt-2">{service.duration}</p>
              <p className="mt-4 text-sm text-muted-foreground">{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-secondary/50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-xl">
            <p className="eyebrow">The studio</p>
            <h2 className="mt-3 text-4xl md:text-5xl">A look inside</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { src: gallery1, alt: "Blush pink manicure table inside the studio" },
              { src: gallery2, alt: "Soft pink french gel manicure close-up" },
              { src: gallery3, alt: "Nude pink pedicure with rose petals" },
            ].map((image) => (
              <div key={image.alt} className="overflow-hidden rounded-3xl">
                <img
                  src={image.src}
                  alt={image.alt}
                  loading="lazy"
                  width={912}
                  height={912}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h2 className="text-4xl md:text-5xl">Ready when you are</h2>
        <p className="mt-4 text-muted-foreground">
          Pick a service, choose a free time slot and leave your details. That's it.
        </p>
        <Button asChild size="lg" className="mt-8 rounded-full px-10 shadow-soft">
          <Link to="/book">
            Book appointment <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <SiteFooter />
    </div>
  );
}
