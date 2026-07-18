# Writing Style Guide

Derived from reading every post on the blog (10 posts, March–December 2023). This is not generic writing advice — every rule below is anchored in patterns that actually show up in the existing posts, with quotes where useful.

## Tone & Voice

- **First person, direct, conversational.** Posts are written as personal notes, not as documentation. Almost every post opens with "I" or describes a personal experience.
  - *welcome*: "Welcome, here I'll be sharing my discoveries, studies, and experiences in the software industry."
  - *rinha-de-backend*: "I participated in the Rinha de backend challenge and after some good hours of development... and my results were too far from I expected."
  - *got*: "got is a CLI written in Go, created on top of the git CLI, to make my life easier by shortening some commands I use daily."
- **Teach without lecturing.** Explain what happened and what you learned. Avoid imperatives like "you should". State things in your own experience ("for me", "in my opinion"), then let the reader take what they want.
  - *testcontainers*: "Despite Testcontainers reducing the cost of integration tests and making them more reliable, it doesn't remove the cost entirely." (then: "in my opinion, the price is low compared to the benefit")
- **Honest about mistakes.** When something went wrong, say so plainly, including embarrassing ones. Self-deprecating humour is allowed.
  - *rinha-de-backend*: "I built the docker image to `linux/arm64` instead of `linux/amd64` 🤦🤦🤦. I fixed the issue and ran the same tests afterward..."
  - *tidy-first*: "It's not a 10/10 because the first section about actual tydings with practical examples felt a bit unnecessary."
- **No hype, no marketing language.** Comparisons are "10/10", "8/10", "excellent", "super nice", but never "game-changer", "revolutionary", "blazing fast".

## Sentence & Paragraph Length

- **Short paragraphs.** Most paragraphs are 1–3 sentences. Long paragraphs (4+ sentences) are rare; when they appear they are explanations of a concept, not narration.
  - *go-decimal-type* is a model of brevity: 22 lines total, paragraphs of 1–2 sentences, two bullets.
- **Medium-length sentences.** Not punchy one-worders, not academic prose. Average 12–22 words. Lists, code, and headings break up the flow heavily.
- **Allowed informalities:** lowercase "i" occasionally, minor typos ("Importig", "lazyness", "challeges", "insteresting", "recive", "laden", "Apelido" — many posts contain typos). Don't polish out the human touch but don't intentionally add errors either; the blog has them because they're real.

## Opening Patterns

Three recurring openings:

1. **Lead with the artifact / outcome.**
   - *got*: "[got](github) is a CLI written in Go, created on top of the git CLI, to make my life easier by shortening some commands I use daily."
   - *csv-import*: "If you are using Go ad PostgreSQL, and need to performa a bulk import a CSV, it's most likely you will find the COPY protocol is the feature that suits you better."
2. **Lead with a story / personal scene.**
   - *rinha*: "I participated in the Rinha de backend challenge and I was super excited... So I stayed up til later that night grabbed popcorn, and waited for the results. Well, I wish I hadn't waited..."
   - *tidy-first*: "The book is clear, objective, and easy to read. Its simple explanations and examples..."
3. **Lead with a hook question or "Picture this".**
   - *testcontainers*: "Picture this, you have a critical and reasonably complicated piece of logic in your application that is handled in the database... So, what do you do?"

Avoid: "In this post, I will...", "Today I'm going to talk about...", "Recently, I..."

## Closing Patterns

- **Invite the reader in** ("What about you? How do you write integration tests, and what are your main challenges?" — *testcontainers*).
- **Project forward** ("I'll apply the lessons learned to my solution and hopefully get better results. Watch [repo] and see how it will evolve." — *rinha*).
- **Sign off casually** ("Till next time o/" — *got*).
- **TL;DR + link to repo** for technical posts: "Checkout the repository with examples and details presented here."

The post almost never ends with a summary "in conclusion" paragraph. If it does, it's brief and contains forward-looking or personal commentary.

## Headers & Structure

- **One H2 per major section, H3 for subsections.** Headers are short, often a single word or phrase: "Context", "How", "Why", "Final thoughts", "What's next?".
  - *got* uses `### But... Why?`, `### How`, `### Ok, what about the logic in got?`, `### Conclusion and what's next?`. Questions and informal phrasings are welcome.
- **No deep header nesting.** H4+ is rare and only used for inline sub-cases.
- **`<!--more-->` excerpt break** appears in every post: above it is the lead image and the lede paragraph (1–2 paragraphs); below it is the full content. The lede is what shows on the index page.
- **TL;DR callout** appears as a Markdown blockquote (`> TL;DR: ...`) right after the `<!--more-->` for most posts. Sometimes it includes the GitHub repo link.

## Code Blocks

- **Always fenced with a language tag** (`go`, `shell`, `sql`). Code is real, runnable code from the project — never pseudocode.
- **Code is introduced, not dropped.** A short sentence frames the snippet, then the snippet, then commentary. (See *got*'s `#### Install` / `#### Booststraping your CLI` pattern.)
- **Real CLI output is included verbatim** for steps where seeing the output matters (*testcontainers* prints the full `go test -v` output).
- **One code block per concept.** Don't bury multiple ideas in one snippet.

## Callouts, Quotes, Asides

- **Markdown blockquotes (`>`) are used for:**
  - The TL;DR.
  - Quotes from external sources (book descriptions, xkcd captions).
  - Cautionary or sidebar notes: *got* has `> Speaking on zsh... if you use it with the go plugin, you will have a conflict with the alias got for go test.`
- **Italic emphasis** (`_..._`) is used for meta-notes and personal asides: "_The snippet below is part of the root.go_", "_You can read more about the meaning of each metric on..._".
- **No "tip boxes" or styled aside components.** Everything is plain Markdown.

## Images & Visuals

- **Every post leads with a single image or video** inside a `<figure class="aligncenter">`.
  - Image path uses Jekyll's `absolute_url` filter: `<img src="{{ "images/foo.webp" | absolute_url }}" alt="..." />`.
  - Alt text is plain English describing the image.
- **Captions via `<figcaption>`** when the image needs context, often with credit.
- **In-line figures** appear where they aid the narrative (memes, result screenshots, "before/after" comparisons in *rinha-de-backend*).
- **Image content leans fun / personal**: Gophers, xkcd strips, memes, screenshots of dashboards — not stock photography or diagrams.

## Link Conventions

- **External links open in a new tab** with `{:target="\_blank"}`. Every external link uses this pattern.
  - Example: `[got](https://github.com/flavio1110/got){:target="\_blank"}`.
- **Internal / cross-references** to personal projects always point to the GitHub repo with a short framing sentence: "Checkout the repository with examples and details presented here."
- **Code identifiers** are linked to their official docs (`pgx.CopyFrom`, `pgx.CopyFromRows`, `Effective Go`).
- **Names of tools / people** get inline links to homepages or Twitter on first mention.

## Length Conventions per Post Type

- **Short (15–60 lines):** Quick gotchas or simple announcements (*go-decimal-type* = 22 lines, *go-resources* = 67 lines, *tidy-first* = 53 lines, *frontendmentor* = 47 lines, *youtube-suggestions* = 62 lines).
- **Medium (100–160 lines):** Tutorials with one or two code blocks (*csv-import* = 135, *rinha-de-backend* = 132, *got* = 191 — slightly longer).
- **Long (200–310 lines):** Deep dives with several code blocks and step-by-step structure (*testcontainers* = 307 lines).

A two-paragraph "short note" is acceptable when the message is genuinely small (see *go-decimal-type*).

## Tags & Frontmatter

The Jekyll frontmatter schema (consistent across all 10 posts):

```yaml
---
layout: post
title: "EMOJI Short descriptive title"     # Title starts with a single emoji
date: YYYY-MM-DD 14:00:00 +0100            # Always 14:00 +0100 (CET), no exceptions
mood: speechless                           # mood: speechless | happy (sometimes omitted)
description: <one-sentence summary used by SEO/excerpt>
tags:
  - tag-one
  - tag-two
---
```

**Title conventions:**
- Always leads with a single emoji that signals the topic (`🐔` rooster fight, `🐉` dragon for "got", `🔥` for hot takes, `📂` for file/data, `🧠` for learning, `🔢` for numbers, `🧹` for cleanup, `👋` for hello, `📺` for video).
- Title is short — usually under 60 characters.
- Titles are phrased conversationally, not as SEO headlines.

**Tag conventions:**
- Lowercase, hyphenated where multi-word (`gotchas`, `thougths` — note the typo, don't "correct" it; new posts should use existing tag names where possible).
- Reused tags: `go`, `programming`, `tools`, `learning`, `gotchas`, `thougths`, `postgresql`, `docker`, `database`, `tests`.
- 3–5 tags per post.

**Mood:**
- Used in most posts. `speechless` for serious / technical / "wow this is interesting" content, `happy` for lighter / celebratory / list-style posts. The `welcome` post uses `happy`; `tidy-first`, `got`, `rinha`, `csv-import`, `testcontainers`, `frontendmentor`, `go-decimal-type` use `speechless`. Use sparingly; omit only if unsure.

## Voice & Point of View

- **First person singular** for personal narrative ("I participated", "I built").
- **First person plural / second person** sparingly, when explaining ("we can now effortlessly run not only...", "When studying HTML, CSS, and Javascript it's hard to practice...").
- **Never third-person about yourself.** Never "the author" or "Flavio".

## How Lessons Are Framed

- **Lessons are observations from experience**, not prescriptions. Often end with "What about you? ... How do you..." to invite the reader's perspective.
- **Lessons come at the end**, in sections titled "Conclusion", "Final thoughts", "What's next?", "Ok, what about the logic in got?", or woven into the body.
- **Failure is part of the lesson.** *rinha-de-backend* has a whole section "What could I have done differently?" listing 5 bullet points of what went wrong — that's the structural model for retrospective posts.

## Emoji & Tone Markers

- Sparse emoji usage: one or two per post, usually in the title. In-body emoji is rare, mostly used for self-deprecation (`🤦🤦🤦`, `😅`, `💪`).
- No emoji in technical sections (code, headings, lists).
- xkcd and meme references are welcome as flavour when they fit (*got* includes the xkcd "Automation" comic).

## Anti-patterns to Avoid

- ❌ Opening with "In this post, we will..."
- ❌ Long-winded preambles before getting to the point
- ❌ Stuffed "Conclusion" paragraphs restating the body
- ❌ Generic SEO titles like "How to X: A Complete Guide"
- ❌ Marketing words: "blazing fast", "revolutionary", "next-generation"
- ❌ Bullet points where prose works better
- ❌ Hiding which repositories are involved — always link the actual repo

## Style Checklist (per post)

1. Frontmatter matches the schema above (emoji + short title, 14:00 +0100, mood, description, 3–5 tags).
2. `<!--more-->` break is present.
3. Opens with a `<figure class="aligncenter">` and a relevant image (or video).
4. First paragraph is short (1–3 sentences) and leads with the artifact / story / hook — not a generic intro.
5. Every external link uses `{:target="\_blank"}`.
6. Code blocks have a language tag and are introduced, not dropped.
7. Voice is first-person and direct. No "we should", no marketing tone.
8. Length matches the post type: short note → 1–2 paragraphs; tutorial → 100–200 lines; deep dive → 200–300 lines.
9. Closes with forward-looking note, sign-off, or question to the reader.
10. No fabricated technical claims — link to real repos / docs.