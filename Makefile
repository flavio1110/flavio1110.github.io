.PHONY: serve
serve:
	@bundle exec jekyll serve

.PHONY: install
install:
	@sudo bundle install

# Hugo (hugo-migration branch) — pinned version must match config/_default/hugo.toml
# and .github/workflows/hugo-ci.yml.
HUGO_IMAGE := hugomods/hugo:0.164.0

.PHONY: hugo-build
hugo-build:
	@docker run --rm -v "$(CURDIR)":/src -w /src $(HUGO_IMAGE) hugo --minify

.PHONY: hugo-serve
hugo-serve:
	@docker run --rm -it -v "$(CURDIR)":/src -w /src -p 1313:1313 $(HUGO_IMAGE) hugo server --bind 0.0.0.0 --disableFastRender
