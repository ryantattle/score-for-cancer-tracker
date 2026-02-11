import * as cheerio from "cheerio";

const CAMPAIGN_URL = "https://fundraisemyway.cancer.ca/campaigns/scoreforcancer";
const GOAL = 250000;

function parseMoneyToNumber(text) {
  if (!text) return null;
  const n = Number(String(text).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function handler(req, res) {
  try {
    const resp = await fetch(CAMPAIGN_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-CA,en;q=0.9"
      },
      cache: "no-store"
    });

    if (!resp.ok) {
      return res.status(502).json({ error: "Failed to fetch campaign page" });
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    const candidates = [
      $('[data-testid*="raised"]').first().text(),
      $('[class*="raised"]').first().text(),
      $('[class*="donation"]').first().text(),
      $('body').text().match(/\$[\d,]+(?:\.\d{2})?/g)?.[0] || null
    ].filter(Boolean);

    let totalRaised = null;
    for (const c of candidates) {
      const n = parseMoneyToNumber(c);
      if (n && n > 0) {
        totalRaised = n;
        break;
      }
    }

    if (!totalRaised) {
      return res.status(500).json({
        error: "Could not parse total raised",
        debugCandidates: candidates.slice(0, 3)
      });
    }

    const progressPct = GOAL ? Number(((totalRaised / GOAL) * 100).toFixed(2)) : null;

    return res.status(200).json({
      totalRaised,
      totalRaisedDisplay: formatMoney(totalRaised),
      goal: GOAL,
      goalDisplay: GOAL ? formatMoney(GOAL) : null,
      progressPct,
      updatedAt: new Date().toISOString(),
      source: CAMPAIGN_URL
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
