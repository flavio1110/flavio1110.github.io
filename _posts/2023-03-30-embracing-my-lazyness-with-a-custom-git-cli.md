---
layout: post
title: "🐉 got: Embracing my lazyness with my custom git CLI"
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

[got](https://github.com/flavio1110/got){:target="\_blank"} is a CLI written in Go, created on top of the git cli, to make my life easier by shortening some commands I use daily.

Because it's built on top of git, all git commands will also work just fine and I don't need to keep switching between `got` and `git`!

If I want to clean-up my local dead branchs I can `got rmb` instead of `git branch | grep -v "main" | xargs git branch -D` (you can call me lazy. I accept that 😅).

<!--more-->

### But... Why?

My first experience with a Distributed version control system (DVCS), was many years ago with [mercurial hg](https://en.wikipedia.org/wiki/Mercurial){:target="\_blank"}, and despite taking some time to get used to the new way of working as compared to a centralized version control system, I got very used to [its short commands](https://gist.github.com/cortesben/016cd401faae5a8dae59){:target="\_blank"}, aliases, and simplicity.
We could do something like `hg pull` or `hg pul`, we were able to close a branch and commit a message in a single command like `hg commit --close-branch -m 'closing this branch'`. It was super nice!

Then, eventually I started working with [git](https://git-scm.com/){:target="\_blank"} and I was amazed by its differences, possibilities, and features. However, it felt way more verbose for day-to-day tasks. So I ended up creating a bunch of aliases for the commands that I use more often, or commands that are longer and I always have to google it to remember.

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

> Speaking on [zsh](https://ohmyz.sh/){:target="\_blank"}, if you use it with the `go` plugin, you will have a conflict with the alias `got` for `go test`.

The aliases work so well and are easy to maintain... But I wanted something fancier and all have the opportunity to go through the process of writing a CLI in Go.

### How

Got is built using [cobra](https://github.com/spf13/cobra){:target="\_blank"}, which makes the work so much easier. Cobra has its own [CLI called Cobra Generator](https://github.com/spf13/cobra-cli/blob/main/README.md){:target="\_blank"} that helps bootstrap your CLI project and add commands. You can check the full documentation [here](https://github.com/spf13/cobra-cli/blob/main/README.md){:target="\_blank"}, but here goes the basic usage:

#### Install

With go installed, open the terminal and execute the following command:

```shell
go install github.com/spf13/cobra-cli@latest
```

#### Booststraping your CLI

Navigate to a folder that you want to have your project, init a go module, then execute the cobra init. e.g

```shell
go mod init my-cli
cobra-cli init
```

Voilá! You have your custom CLI, ad you can run it with `go run .`! You will see a result like:

```shell
A longer description that spans multiple lines and likely contains
examples and usage of using your application. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.
```

You can now add a command with executing `cobra-cli add ping`, then execute the command again
