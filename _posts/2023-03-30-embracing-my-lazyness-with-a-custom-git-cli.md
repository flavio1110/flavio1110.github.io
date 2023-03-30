---
layout: post
title: 🤦 Embracing my lazyness with my custom git CLI"
date: 2023-03-30 14:00:00 +0100
mood: speechless
description: I crated a new CLI called got. It is built on top of git because I'm lazy.
tags:
  - go
  - thougths
  - tools
---

<figure class="aligncenter">
  <img src="https://raw.githubusercontent.com/flavio1110/got/main/got.png" alt="The eyes of Drogon" />
</figure>

<!--more-->

[got](https://github.com/flavio1110/got) is a CLI written in Go, created on top of the git cli, to make my life easier by shortening some commands I use daily. And becuase it's built on top of git, all git commands will also work just fine and I don't need to keep switching between `got` and `git`!

If I want to clean-up

### WHY?

My first experience with a Distributed version control system (DVCS), was many years ago with [mercurial hg](https://en.wikipedia.org/wiki/Mercurial), and despite taking some time to get used to the new way of working as compared to a centralized version control system, I got very used to [its short commands](https://gist.github.com/cortesben/016cd401faae5a8dae59), aliases, and simplicity.
We could do something like `hg pull` or `hg pul`, we were able to close a branch and commit a message in a single command like `hg commit --close-branch -m 'closing this branch'`. It was super nice!

Then, eventually I started working with [git](https://git-scm.com/) and I was amazed by its differences, possibilities, and features. However, it felt way more verbose for day-to-day tasks. So I ended up creating a bunch of aliases for the commands that I use more often, or commands that are longer and I always have to google it to remember.

Sneak peak of my `~/.zshrc`

```shell
#...
alias push='git push origin head'
alias stat='git status -s'
alias gbr="git branch | grep -v "main" | xargs git branch -D"
alias pick="git cherry-pick"
# and a few more...
#...
```

The aliases work so well and are easy to maintain... But I wanted something fancier and all have the opportunity to go through the process of writing a CLI in Go.
