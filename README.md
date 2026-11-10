# Melvern Mogens — Portfolio

**Personal portfolio site: software & AI developer, live at [melvernmogens.my.id](https://melvernmogens.my.id/).**

A static, single-page site with a raymarched ice-crystal hero, built without frameworks or a build step.

![Portfolio preview](static/images/og.jpg)

## What's on it

- **About**: background and education
- **Skills**: what I work with
- **Experience**: timeline of roles (AI automation, agentic development, IoT, and more)
- **Work**: 15 project cards with screenshots, e.g. Sinyal, Saham Desk, Hermes Mobile, Reel Studio, Wordwick, BaoSeas, a Mac app suite, Elisa
- **Honors**: 2nd Place, In2Food 2023
- **Contact**

## How it's built

| Part | Details |
|---|---|
| Hero | `js/ice.js`: raw WebGL 1 raymarched ice scene, no dependencies, CSS fallback when WebGL isn't available |
| Interaction | `js/main.js`: preloader, custom cursor, scroll reveals, menu; respects `prefers-reduced-motion` |
| Styles | `css/main.css`, `hero.css`, `sections.css`, `preloader.css` |
| SEO | canonical URL, Person JSON-LD, Open Graph image, `robots.txt`, `sitemap.xml` |
| Hosting | GitHub Pages with a custom domain (`CNAME`) |

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

```
index.html
css/              styles
js/ice.js         WebGL hero
js/main.js        interactions
static/images/    profile, project and award images (work/ = project screenshots)
```

Project screenshots have private data blurred.

Built by [Melvern Mogens](https://github.com/MelvernMogens).
