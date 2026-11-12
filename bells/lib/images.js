// Image blocks are illustrated from Wikipedia: the research agent names an
// article and the wall shows that article's lead image. Nothing else on the
// web is hot-linked, so every picture has a known page and licence.
//
// Wikipedia rate-limits API clients that don't identify themselves with a
// contact address. With BELLS_CONTACT set, the lookup happens here and the
// agent is told when an article has no picture. Without it the lookup may be
// refused, in which case the block is kept and the browser resolves the
// picture when the wall renders (see public/js/hud.js).

const CONTACT = (process.env.BELLS_CONTACT || "").trim();
const UA = `BellsHUD/0.1 (${CONTACT || "personal voice assistant"})`;
const ALLOWED_HOST = /(^|\.)wikimedia\.org$/i;

export function wikipediaQuery(title) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "960",
    inprop: "url",
    redirects: "1",
    titles: title,
  });
  return `https://en.wikipedia.org/w/api.php?${params}`;
}

/**
 * @returns {{status: "found", image: object} | {status: "none"} | {status: "unknown"}}
 *   "none" means Wikipedia answered and there is no such article or picture;
 *   "unknown" means the lookup itself did not go through.
 */
export async function findWikipediaImage(title) {
  const clean = String(title ?? "").trim();
  if (!clean) return { status: "none" };

  let body;
  try {
    const res = await fetch(wikipediaQuery(clean), {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { status: "unknown" };
    body = await res.json();
  } catch {
    return { status: "unknown" };
  }

  const image = imageFromResponse(body);
  return image ? { status: "found", image } : { status: "none" };
}

/** Shared shape with the browser-side lookup. */
export function imageFromResponse(body) {
  const page = body?.query?.pages?.[0];
  const src = page?.thumbnail?.source;
  if (!page || page.missing || !src || !isAllowed(src)) return null;
  return {
    src,
    page: typeof page.fullurl === "string" ? page.fullurl : `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    title: page.title,
  };
}

function isAllowed(src) {
  try {
    const u = new URL(src);
    return u.protocol === "https:" && ALLOWED_HOST.test(u.hostname);
  } catch {
    return false;
  }
}
