"use client";

import Link from "next/link";
import { useState } from "react";
import { pricingOffers, pricingPageContent, type PricingFrequency, type PricingOffer } from "@/features/pricing/offers";

function Price({ offer, frequency }: { offer: PricingOffer; frequency: PricingFrequency }) {
  const price = frequency === "annual" && offer.annual ? offer.annual : offer.monthly;
  return (
    <div className="pricing-card-price">
      <strong>{price.eur}</strong>
      <span>{price.xof}{frequency === "monthly" ? " par mois" : " par an"}</span>
      {frequency === "annual" && offer.annual?.note && <small>{offer.annual.note}</small>}
    </div>
  );
}

function OfferCard({ offer, frequency }: { offer: PricingOffer; frequency: PricingFrequency }) {
  const isFeatured = offer.id === "pro";
  const isPlanned = offer.availability === "planned";
  return (
    <article className={`pricing-offer-card ${isFeatured ? "pricing-offer-card-featured" : ""}`}>
      <div className="pricing-card-top">
        <div>
          {offer.badge && <span className="pricing-badge">{offer.badge}</span>}
          <h3>{offer.name}</h3>
        </div>
        <Price offer={offer} frequency={frequency} />
      </div>
      <p className="pricing-card-description">{offer.description}</p>
      {offer.prefix && <p className="pricing-card-prefix">{offer.prefix}</p>}
      <ul className="pricing-card-features">
        {offer.features.map((feature) => (
          <li key={feature.text}>
            <span aria-hidden="true">✓</span>
            <div>
              <span>{feature.text}</span>
              {feature.children && (
                <ul className="pricing-nested-features">
                  {feature.children.map((child) => <li key={child}>{child}</li>)}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
      {isPlanned ? (
        // TODO: brancher le checkout Max lorsque l'offre Jarvis sera disponible à la vente.
        <Link href="/login?mode=signup&plan=max" className="pricing-card-button pricing-card-button-secondary">{offer.cta}</Link>
      ) : (
        <Link href={offer.checkoutHref ?? "/login?mode=signup"} className="pricing-card-button">{offer.cta}</Link>
      )}
    </article>
  );
}

export function PricingGrid() {
  const [frequency, setFrequency] = useState<PricingFrequency>("monthly");
  return (
    <section id="tarifs" className="pricing-section">
      <div className="pricing-heading">
        <p className="landing-eyebrow">Des offres pour chaque étape</p>
        <h2>{pricingPageContent.title}</h2>
        <p>{pricingPageContent.subtitle}</p>
      </div>
      <div className="pricing-frequency" role="group" aria-label="Fréquence de facturation">
        <button type="button" aria-pressed={frequency === "monthly"} onClick={() => setFrequency("monthly")}>Mensuel</button>
        <button type="button" aria-pressed={frequency === "annual"} onClick={() => setFrequency("annual")}>Annuel <span>(2 mois offerts)</span></button>
      </div>
      <div className="pricing-offers-grid">
        {pricingOffers.map((offer) => <OfferCard key={offer.id} offer={offer} frequency={frequency} />)}
      </div>
      <aside className="pricing-privacy-banner">
        <h3>{pricingPageContent.privacyTitle}</h3>
        <ul>{pricingPageContent.privacyItems.map((item) => <li key={item}>✓ {item}</li>)}</ul>
      </aside>
      <div className="pricing-faq">
        <h3>Questions fréquentes</h3>
        {pricingPageContent.faq.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
      <p className="pricing-disclaimer">Les abonnements Claude et ChatGPT sont facturés séparément par leurs éditeurs. Skillsflow fournit les skills, les méthodes, les guides et l&apos;accompagnement.</p>
    </section>
  );
}

