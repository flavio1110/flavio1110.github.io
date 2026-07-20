# Site operations notes (for agents)

Technical/operational knowledge about this repo that isn't obvious from the code alone. If you're an agent picking up work here, read this before touching deploy config, Pages settings, or the Hugo pin. For blog-post writing style, see [`WRITING_STYLE.md`](WRITING_STYLE.md) instead.

## Stack

Hugo (extended) + [Stack theme](https://github.com/CaiJimmy/hugo-theme-stack) v4.0.3, theme included as a git submodule at `themes/hugo-theme-stack`, **not** via Hugo Modules. Deployed to GitHub Pages, custom domain `fsilva.me`.

## The Hugo version pin

Currently `0.164.0`, documented as a comment at the top of `config/_default/hugo.toml` — that comment is the single source of truth; `Makefile` and both GitHub Actions workflows must match it.

Why 0.164.0 specifically: Stack v4.0.3's `module.toml` declares a floor of `0.157.0`, but its `baseof.html` actually calls `Site.Language.Locale`, which was only added in Hugo **v0.158.0** — so anything below that genuinely fails to build. 0.164.0 was the current stable release at migration time and is what's pinned.

Docker image: `hugomods/hugo:<version>` — **not** `hugomods/hugo:exts-<version>`. hugomods dropped the legacy `exts-` tag prefix at some point; bare version tags now ship the extended build by default. If you're ever changing the pin, verify the new tag actually exists before using it: `curl -s -o /dev/null -w "%{http_code}" https://hub.docker.com/v2/repositories/hugomods/hugo/tags/<version>/` should return 200.

## GitHub Pages configuration gotcha (caused a real incident)

The repo's Pages "Source" setting must be `"build_type": "workflow"` (GitHub Actions), not `"legacy"` (Deploy from a branch). Check with:

```sh
gh api repos/flavio1110/flavio1110.github.io/pages -q '{status,cname,build_type}'
```

When this repo was first swapped from Jekyll to Hugo, `build_type` was still `"legacy"` (a leftover from the Jekyll-era Pages config) even though deploys go through `actions/deploy-pages` in `hugo-deploy.yml`. Result: **every single deploy** caused a real multi-minute site-wide 404, not just the initial cutover — because GitHub's legacy branch-based Pages system was racing the Actions artifact deploy on every push to `master`, finding no content it recognized at branch root, and briefly unpublishing. Fixed with:

```sh
gh api -X PUT repos/flavio1110/flavio1110.github.io/pages -f build_type=workflow
```

Verified after the fix: a fresh deploy completed with the site staying at 200 the entire time, no dip. If you ever see routine deploys causing downtime again, check this setting first before assuming it's normal CDN propagation lag — it usually isn't.

Related, lower-stakes leftover: setting the custom domain via the Pages API (`-f cname=...`) makes GitHub auto-commit a root-level `CNAME` file directly to `master`. This duplicates `static/CNAME` (which Hugo copies into the build output as `public/CNAME`) — harmless, same content, not worth cleaning up urgently.

## CI coverage gap

`.github/workflows/hugo-ci.yml` (build-only check) only triggers on pushes/PRs to `hugo-migration` — a branch that no longer has an active purpose now that the migration is done and `master` is the live branch. PRs targeting `master` currently get **no automated build check**. Worth fixing by widening the trigger to include `master`, or retargeting it entirely. Until that's done, verify `hugo --minify --gc --printPathWarnings` locally before merging anything into `master`.

## Local build/test

No local Hugo binary is guaranteed to be installed — use Docker if unsure:

```sh
docker run --rm -v "$PWD":/src -w /src hugomods/hugo:0.164.0 hugo --minify --gc --printPathWarnings
```

For a dev-server smoke test, pick a port that won't collide with anything else you're running:

```sh
docker run --rm -d --name hugo-smoke -v "$PWD":/src -w /src -p 13130:1313 hugomods/hugo:0.164.0 hugo server --bind 0.0.0.0 --disableFastRender
```

`hugo build`/`hugo --minify` with no `-e` flag defaults to the **production** environment (merges `config/production/hugo.toml`, e.g. turns on Google Analytics) — that's expected, not a bug. Use `-e development` explicitly to check dev-only behavior.

Clean up `public/`, `resources/`, `.hugo_build.lock`, and `assets/jsconfig.json` after local builds — all gitignored, never commit them.

## Working in parallel / isolated branches

This repo has been worked on by multiple concurrent agents (the whole Jekyll→Hugo migration ran as ~8 parallel agents per phase). The pattern that worked: each agent gets its own `git worktree` off the target branch (`git worktree add /path/to/worktree origin/<base> -b <branch-name>`), does its work there, opens a PR, and the orchestrating session reviews/merges and cleans up the worktree afterward. Avoids agents stepping on each other's `public/`/`resources/` build output or git working-tree state. Expect occasional real merge conflicts when multiple PRs touch the same shared file in different sections (e.g. `assets/scss/custom.scss`, `config/_default/params.toml`) — these are usually trivial to reconcile by hand (combine both sections), not a sign anything went wrong.

## giscus comments (issue #17, was on hold)

Comments are configured but disabled (`[comments] enabled = false` in `config/_default/params.toml`) pending a human step: enabling GitHub Discussions on this repo, installing the [giscus app](https://github.com/apps/giscus), and grabbing `repoID`/`category`/`categoryID` from [giscus.app](https://giscus.app). No agent can complete this unassisted — check whether it's since been done (`gh api repos/flavio1110/flavio1110.github.io -q '.has_discussions'`) before assuming it's still blocked.
