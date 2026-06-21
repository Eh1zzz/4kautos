/* Destination resolver — maps a buyer's locale string (e.g. "Accra, Ghana") to a
   clearance/shipping profile. Nigeria uses the detailed duty model in
   clearance.js; other West-African destinations use a single, clearly-labeled
   "effective import charges" ESTIMATE (refine the numbers as real data arrives).

   effectiveDutyPct = indicative all-in import charges (duty + levies + VAT) as a
   percentage of the vehicle's CIF value. Nigeria's 48% mirrors the detailed model
   in governmentCharges() for a like-for-like fallback. */

export const DESTINATIONS = {
  'Nigeria': {
    aliases: ['nigeria', 'lagos', 'abuja', 'kano', 'ibadan', 'port harcourt', 'benin city', 'enugu'],
    port: 'Tin Can Island / Apapa, Lagos · Onne, Port Harcourt',
    currency: 'NGN', effectiveDutyPct: 48, estimate: false,
    contact: { protocol: 'Compare vetted clearing agents and duty quotes on the Clearance page.', channel: 'Clearance directory' },
  },
  'Ghana': {
    aliases: ['ghana', 'accra', 'kumasi', 'tema'],
    port: 'Tema Port, Accra', currency: 'GHS', effectiveDutyPct: 35, estimate: true,
    contact: { protocol: 'A vetted Ghanaian clearing partner is assigned after purchase; our international desk coordinates handover at Tema.', channel: 'Contact Us' },
  },
  'Togo': {
    aliases: ['togo', 'lomé', 'lome'],
    port: 'Port of Lomé', currency: 'XOF', effectiveDutyPct: 30, estimate: true,
    contact: { protocol: 'A local partner clears at Lomé after purchase; our international desk coordinates handover.', channel: 'Contact Us' },
  },
  'Benin': {
    aliases: ['benin', 'cotonou'],
    port: 'Port of Cotonou', currency: 'XOF', effectiveDutyPct: 30, estimate: true,
    contact: { protocol: 'A local partner clears at Cotonou after purchase; our international desk coordinates handover.', channel: 'Contact Us' },
  },
  "Côte d'Ivoire": {
    aliases: ['côte', 'cote d', 'ivoire', 'abidjan', 'ivory coast'],
    port: 'Port of Abidjan', currency: 'XOF', effectiveDutyPct: 35, estimate: true,
    contact: { protocol: 'A local partner clears at Abidjan after purchase; our international desk coordinates handover.', channel: 'Contact Us' },
  },
  'Cameroon': {
    aliases: ['cameroon', 'douala', 'yaound'],
    port: 'Port of Douala', currency: 'XAF', effectiveDutyPct: 35, estimate: true,
    contact: { protocol: 'A local partner clears at Douala after purchase; our international desk coordinates handover.', channel: 'Contact Us' },
  },
  'Senegal': {
    aliases: ['senegal', 'dakar'],
    port: 'Port of Dakar', currency: 'XOF', effectiveDutyPct: 40, estimate: true,
    contact: { protocol: 'A local partner clears at Dakar after purchase; our international desk coordinates handover.', channel: 'Contact Us' },
  },
};

const FALLBACK = {
  port: 'Nearest seaport', currency: 'USD', effectiveDutyPct: 40, estimate: true,
  contact: { protocol: 'Our international desk assigns a local clearing partner and coordinates handover after purchase.', channel: 'Contact Us' },
};

/**
 * Resolve a locale string to a destination profile.
 * - Empty/unknown-but-blank → defaults to Nigeria (the primary market).
 * - Non-empty but unrecognised → a generic "International" estimate.
 */
export function resolveDestination(localeString = '') {
  const s = String(localeString || '').toLowerCase();
  for (const [country, d] of Object.entries(DESTINATIONS)) {
    if (d.aliases.some(a => s.includes(a))) return { country, ...d };
  }
  if (!s.trim()) return { country: 'Nigeria', ...DESTINATIONS['Nigeria'] };
  return { country: 'International', ...FALLBACK };
}

export const destinationCountry = localeString => resolveDestination(localeString).country;
