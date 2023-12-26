---
layout: post
title: "🧹 Tidy First? By Kent Beck - My review and takeaways"
date: 2023-12-26 14:00:00 +0100
mood: speechless
description: My review and takeaways of Tidy First? Written by Kent Beck, creator of Extreme Programming and pioneer of software patterns, suggests when and where you might apply tidyings to improve your code while keeping the overall structure of the system in mind.
tags:
  - book
  - programming
  - thougths
  - review
---

<figure class="aligncenter">
  <img src="{{ "images/tidy_first.jpeg" | absolute_url }}" alt="Front cover of the book Tidy First?" />
</figure>

> "Messy code is a nuisance. "Tidying" code, to make it more readable, requires breaking it up into manageable sections. In this practical guide, author Kent Beck, creator of Extreme Programming and pioneer of software patterns, suggests when and where you might apply tidyings to improve your code while keeping the overall structure of the system in mind. (...)" [O'Reilly - Tidy First](https://www.oreilly.com/library/view/tidy-first/9781098151232/)

The book is clear, objective, and easy to read. Its simple explanations and examples on empirical software design carry sophisticated concepts on evaluating when, how, what, and if to tidy at all.

<!--more-->

> TL;DR: The book is an 8/10 and I recommend it to any programmer at any level of experience. It's not a 10/10 because the first section about actual tydings with practical examples felt a bit unnecessary. I understand why it's there, but the discussions presented in sections 2 and 3 were way more valuable for me. It might be the other way around depending on the experience though.

## Sections

The author split the book into three sections: Tidyngs, Managing, and Theory.

### Tydings

According to Kent Beck, tidyings are a subset of refactoring. Tydings are the cute, fuzzy little refactorings that nobody could possibly hate on. In this section, the author presents several tidyings that can be done to leave things better than before, e.g. adjusting the order based on reading or cohesion, improving comments, etc.

For people with little or no experience with refactorings, this is going to probably be the most valuable part.
Personally, the "nobody could possibly hate on" piece, is the highlight of this section. It helped me to create a mental model to identify the line between a tidy and a "full-blown" refactor that would require much more work and discussion.

### Managing

"Tyding is geek self-care" - Kent Beck, Tidy First?

Here is where things started to become more interesting for me. This section addresses when to start and stop tidying, and more importantly how to combine tyding, changing the structure of the code, with changing the behavior of the system.

In this section is the reason why I'd love to change the title of this book is "First, After, Later, Never". It provides a simple and objective guideline to decide when and if to tidy something. I won't spoil it here so you can read this part from the book and reach your conclusions.

### Theory

This was my favorite section and every chapter was very interesting to read, digest, and process. Particularly the correlation between software and cash flow versus options. This analogy helped me to think more structurally about the real cost of software, its development, and its evolution.

Another highlight of this section is having a clear distinction between behavior and structural changes. Where the behavior changes are the ones related to what the software does and structural changes are the ones that support what the software needs to do. E.g. software for HR offers features like payroll, holiday planning, etc. These features are the behaviors, anything else to support these features is structural, such as the code organization, how data is stored, retrieved, etc. Understanding this distinction, their costs, and values helps to better judge when to assume debt and plan to pay/tidy.

## Conclusion

This book is the first of a trilogy. The upcoming books are not yet released (as of the date of writing - 22 December 2023), and they will extend the scope of changes and impact. The first one is focused on the individual programmer (you), the second will be focused on the team, and the third will focus on all stakeholders.
