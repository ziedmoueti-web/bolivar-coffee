# BOLIVAR Coffee & Lounge — Website

Premium single-page website for Bolivar Coffee & Lounge, Megrine, Tunisia.
Built with plain HTML / CSS / JavaScript — **no build step, no framework, no dependencies**.
Upload the folder to any web host and it works.

```
index.html      → all content & sections
css/style.css   → design system & animations
js/main.js      → interactions (preloader, menu tabs, lightbox, parallax…)
```

---

## ⚠️ What to replace before going live

The site ships with **clearly-marked editable placeholders** — nothing about
prices, dishes, or photography was invented. Find every `EDITABLE:` comment in
`index.html` and swap in the real information.

### 1. Menu items & prices (section: "EDITABLE MENU")
Each dish is one `<article class="dish">` block. Edit:
- `<h3>Name</h3>` — the dish name
- `<p class="dish__desc">` — short description
- `<span class="dish__price">—</span>` — replace `—` with the real price in TND (e.g. `4.500`)
- `<img src="…">` — a real photo

The `data-category` attribute must match one of the tabs
(`coffee`, `breakfast`, `crepes`, `food`, `drinks`, `desserts`, `lounge`).

### 2. Photos
All photos are tasteful placeholder images loaded from Unsplash. Replace them
with real photography of the café — search for each `images.unsplash.com` URL
in `index.html` and swap in your own images (WebP or AVIF recommended).
Sizes used: hero `w=2000`, menu `w=700`, gallery `w=900`.

### 3. Links
| Link | Currently | Edit |
|---|---|---|
| Order / Glovo | `https://glovoapp.com/` | Replace with the **direct Glovo store link** for Bolivar Coffee |
| Instagram | `https://www.instagram.com/bolivar_coffeee` | Correct already — update if the handle changes |
| Domain (canonical, Open Graph) | `https://www.bolivarcoffee.tn/` | Replace with the final domain |

### 4. Reviews
Three real Google review excerpts are included. Add more by copying the
`<figure class="review">` block (after the `EDITABLE:` comment in the Reviews
section).

### 5. Instagram tiles
The six tiles are placeholders — either swap in real post images, or connect
the Instagram Graph API later. Each tile is one `<a class="ig-tile">` block.

---

## Verified business facts used (from the brief)
- Address: 87 Av. de la République, Megrine 2033, Tunisia — plus code Q69V+8R
- Phone: +216 22 535 138
- Hours: Monday–Sunday, 07:00–00:00
- Google: 4.7 / 5, 24 reviews
- Instagram: @bolivar_coffeee
- Available on Glovo

Nothing else is claimed. The map uses Google Maps' embed for the business
address; directions link opens Google Maps navigation.

---

## Editing tips
- **Colors / fonts:** all tokens live in `:root` at the top of `css/style.css`.
- **Reduced motion:** fully supported via `prefers-reduced-motion` (animations
  are disabled automatically for those users).
- **Performance:** images are lazy-loaded, animations use only
  transforms/opacity, and there are zero third-party scripts beyond Google
  Fonts and the map iframe.
- To test locally, just open `index.html` in a browser (or `npx serve .`).
