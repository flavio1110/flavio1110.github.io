# fsilva.me

Source for [fsilva.me](https://fsilva.me) — Flavio Silva's personal blog. Built with [Hugo](https://gohugo.io) using the [Stack](https://github.com/CaiJimmy/hugo-theme-stack) theme (v4.0.3, via git submodule), deployed to GitHub Pages on every push to `master`.

The site used to run on Jekyll; it was migrated to Hugo in July 2026 (see closed issues [#12](https://github.com/flavio1110/flavio1110.github.io/issues/12)–[#22](https://github.com/flavio1110/flavio1110.github.io/issues/22)).

## Prerequisites

Either of these works — pick whichever you already have:

- **Docker** (no local Hugo install needed), or
- **Hugo extended**, pinned to the exact version documented at the top of [`config/_default/hugo.toml`](config/_default/hugo.toml) (currently `0.164.0`). Install with `brew install hugo` (or see [gohugo.io/installation](https://gohugo.io/installation/)) — the extended edition is required (Stack's SCSS pipeline needs it).

The theme is a git submodule, so after cloning:

```sh
git clone --recurse-submodules git@github.com:flavio1110/flavio1110.github.io.git
# or, if already cloned without it:
git submodule update --init --recursive
```

(The `make hugo-*` targets below run this for you automatically, so a plain `git clone` + `make hugo-serve` also works.)

## Running locally

```sh
make hugo-serve          # host Hugo binary, live reload, drafts included
make hugo-build          # host Hugo binary, production build → public/

make hugo-docker-serve   # same, via Docker (no local Hugo install needed)
make hugo-docker-build   # same, via Docker
```

`hugo-serve`/`hugo-build` warn (non-fatally) if your local `hugo` version doesn't match the pin. See the [`Makefile`](Makefile) for details.

## Writing a post

```sh
hugo new content post/my-new-post-slug/index.md
```

This creates a page bundle from [`archetypes/post.md`](archetypes/post.md). Posts are page bundles (`content/post/<slug>/index.md` + any local images) rather than flat files, so a post's cover image and any inline images can live right next to it and get Hugo's responsive image processing. Front matter:

```yaml
title: "Post Title"
date: 2026-01-01T12:00:00+01:00
description: "One-line summary, used in cards, RSS, and SEO meta."
image: cover.webp        # optional, relative to the bundle
tags: [go, learning]
```

Use `<!--more-->` in the body to control where the homepage/RSS summary cuts off. See [`.agents/WRITING_STYLE.md`](.agents/WRITING_STYLE.md) for the tone/style this blog uses.

## Repo structure

```
config/_default/    Hugo config (hugo.toml, params.toml, menu.toml, related.toml)
config/production/  Production-only overrides (Google Analytics)
content/post/        Blog posts (page bundles)
content/page/         Standalone pages (search, archives)
layouts/              Site-level template overrides (theme handles everything else)
assets/scss/          Custom SCSS (accent color, share-button styles)
assets/ts/             Custom TypeScript (copy-link handler)
assets/icons/          Custom icon SVGs not shipped by the theme
assets/img/             Sidebar avatar
static/                Files served as-is (images/, robots.txt, CNAME)
archetypes/             `hugo new` templates
themes/hugo-theme-stack/  Theme, git submodule pinned to v4.0.3
```

## Deployment

Every push to `master` triggers [`.github/workflows/hugo-deploy.yml`](.github/workflows/hugo-deploy.yml): installs the pinned Hugo version, runs `hugo --minify --gc`, and deploys the `public/` output to GitHub Pages. No manual steps. [`.github/workflows/hugo-ci.yml`](.github/workflows/hugo-ci.yml) runs a build-only check (currently scoped to the `hugo-migration` branch — a leftover from the migration, worth widening to cover `master` PRs too).

Custom domain (`fsilva.me`) and HTTPS are configured in the repo's GitHub Pages settings. See [`.agents/SITE_OPERATIONS.md`](.agents/SITE_OPERATIONS.md) if you're an agent working on this repo — it has details on a couple of non-obvious Pages configuration gotchas.
