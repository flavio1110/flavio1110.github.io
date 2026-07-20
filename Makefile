.PHONY: serve
serve:
	@bundle exec jekyll serve

.PHONY: install
install:
	@sudo bundle install

# Hugo (hugo-migration branch) — pinned version, single source of truth here.
# Must match the pin comment in config/_default/hugo.toml and the image tag in
# .github/workflows/hugo-ci.yml.
HUGO_VERSION := 0.164.0
HUGO_IMAGE := hugomods/hugo:$(HUGO_VERSION)

# --- Host Hugo binary -------------------------------------------------------
# Requires a local `hugo` binary (e.g. `brew install hugo`) matching
# HUGO_VERSION above. Fastest local dev loop.

.PHONY: hugo-serve
hugo-serve: hugo-check-version
	@git submodule update --init --recursive
	@hugo server -D --bind 0.0.0.0

.PHONY: hugo-build
hugo-build: hugo-check-version
	@git submodule update --init --recursive
	@hugo --minify --gc

.PHONY: hugo-check-version
hugo-check-version:
	@command -v hugo >/dev/null 2>&1 || { echo "warning: hugo binary not found on PATH (expected v$(HUGO_VERSION))"; exit 0; }
	@installed=$$(hugo version | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 | tr -d v); \
	if [ "$$installed" != "$(HUGO_VERSION)" ]; then \
		echo "warning: local hugo is v$$installed, pinned version is v$(HUGO_VERSION) — install/switch to avoid drift"; \
	fi

# --- Docker (no local Hugo install required) --------------------------------
# Uses the same pinned HUGO_VERSION via the hugomods/hugo image.

.PHONY: hugo-docker-serve
hugo-docker-serve:
	@git submodule update --init --recursive
	@docker run --rm -it -v "$(CURDIR)":/src -w /src -p 1313:1313 $(HUGO_IMAGE) hugo server --bind 0.0.0.0 --disableFastRender

.PHONY: hugo-docker-build
hugo-docker-build:
	@git submodule update --init --recursive
	@docker run --rm -v "$(CURDIR)":/src -w /src $(HUGO_IMAGE) hugo --minify

# Fresh clone reminder: this repo uses a git submodule for the Hugo theme
# (themes/hugo-theme-stack). All hugo-* targets above run
# `git submodule update --init --recursive` for you, so a plain `git clone`
# followed by any `make hugo-*` target works without a separate init step.
