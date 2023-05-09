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

[got](https://github.com/flavio1110/got){:target="\_blank"} is a CLI written in Go, created on top of the git CLI, to make my life easier by shortening some commands I use daily.

Because it's built on top of git, all git commands will also work just fine and I don't need to keep switching between `got` and `git`!

If I want to clean up my local dead branches I can `got rmb` instead of `git branch | grep -v "main" | xargs git branch -D` (you can call me lazy. I accept that 😅).

[<img src="https://imgs.xkcd.com/comics/automation_2x.png" alt="xckd 1319" />](https://xkcd.com/1319/){:target="\_blank"}

> [xkcd](https://xkcd.com/1319/){:target="\_blank"} Automation.

<!--more-->

### But... Why?

My first experience with a Distributed version control system (DVCS), was many years ago with [mercurial hg](https://en.wikipedia.org/wiki/Mercurial){:target="\_blank"}, and despite taking some time to get used to the new way of working as compared to a centralized version control system, I got very used to [its short commands](https://gist.github.com/cortesben/016cd401faae5a8dae59){:target="\_blank"}, aliases, and simplicity.
We could do something like `hg pull` or `hg pul` (that's not a typo. This is an actual alias for `hg pull`), we were able to close a branch and commit a message in a single command like `hg commit --close-branch -m 'closing this branch'`. It was super nice and handy!
Then, eventually, I started working with [git](https://git-scm.com/){:target="\_blank"} and I was amazed by its differences, possibilities, and features. However, it felt more verbose for day-to-day tasks. So I ended up creating a bunch of aliases for the commands that I use more often, or commands that are longer and I always have to google it to remember.
Sneak peek of my `~/.zshrc`

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

You can now add a command with executing `cobra-cli add ping`, then execute the command again. You will see a result like:

```shell
A longer description that spans multiple lines and likely contains
examples and usage of using your application. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.

Usage:
  my-cli [command]

Available Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  ping        A brief description of your command

Flags:
  -h, --help     help for my-cli
  -t, --toggle   Help message for toggle

Use "my-cli [command] --help" for more information about a command.
```

The foundation for your CLI is in place, you _only_ need to worry about the actual logic of the commands because [cobra](https://github.com/spf13/cobra){:target="\_blank"} will take care of all the pumbling for you.

You can check several examples in the [cobra](https://git{:target="_blank"},hub.com/spf13/cobra/blob/main/user_guide.md)[ documentation](https://git{:target="_blank"},hub.com/spf13/cobra/blob/main/user_guide.md){:target="\_blank"}, and use it as a base to create your shine CLI.

### Ok, what about the logic in got?

In got I have two ways of executing some logic. 1) using [go-git](https://github.com/go-git/go-git){:target="\_blank"} to perform some actions like iterate in all local branches and delete all except main, and 2) executing a git cli command from my Go application directly.

#### go-git

> [go-git](https://github.com/go-git/go-git){:target="\_blank"} is a highly extensible git implementation library written in pure Go. It can be used to manipulate git repositories at low level (plumbing) or high level (porcelain), through an idiomatic Go API. - (Description from its repo).

It is such a well-documented, flexible, and powerful lib. I highly recommend looking into it if you even thought to do something with git, or if you intend to create your own lib. 10/10!

The example below stages all files (including untracked) and commit them:

```go
path, err := os.Getwd() // get the current path
exitIfError(err)

r, err := git.PlainOpen(path) // open the repository related to the path
exitIfError(err)

w, err := r.Worktree() // get the current worktree
exitIfError(err)

_, err = w.Add(".") // Stage all files
exitIfError(err)

_, err = w.Commit("commit yay!", &git.CommitOptions{}) // commit
exitIfError(err)
```

I have to say that for basic operations like this one, we could be better served by executing the git cli directly like in the example below. However, _go-git_ opens several possibilities like in the support of several type of storage, such as in-memory, file system, or anything you can think of as long as you implement the [`Storer`](https://pkg.go.dev/github.com/go-git/go-git/v5/plumbing/storer){:target="\_blank"} interface.
At this moment I'm not using such features yet, but I'm planning to use them for some commands like `got squash` that will squash all commits of the current branch.

```go
cmd := exec.Command("git", "add", "-A")
cmd.Stdout = os.Stdout
cmd.Stderr = os.Stdout
_ = cmd.Run()


cmd = exec.Command("git", "commit", "-m", "commit yay!")
cmd.Stdout = os.Stdout
cmd.Stderr = os.Stdout
_ = cmd.Run()
```

#### Fallback to git

It is important because I wanted to "proxy" all unknown _got_ commands to _git_. In this way, I can use _got_ for my custom commands and the standard _git_ commands without worrying about what is available where.
The other benefit is I don't need to implement things that are good enough or I don't use so often.

Implementing it was fairly simple.
_The snippet below is part of the [`root.go`](https://github.com/flavio1110/got/blob/main/cmd/root.go){:target="\_blank"}_

```go
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		fallbackToGit()
	}
}

func fallbackToGit() {
	cmd := exec.Command("git", os.Args[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stdout
	_ = cmd.Run() // Skipping error here, because git already sends it to stdout, and I don't have anything else to do with it.
```

### Conclusion and what's next?

This small project started as an experiment for playing with writing a custom CLI, but I ended up creating something that is very useful for me. Win-win!

I still have a few commands I want to introduce in `got`, but my next step is to create a reasonable test suit, so I can have confidence that things work as they suppose to. This is especially important given it is responsible for my interaction with `git`. That's a big deal!

Anyways, I created it to attend to my laziness, but if `got` looks interesting to you, feel free to use, fork, and contribute. 💪

I hope this post can help you to see how easy is to write a CLI using Go, and maybe can inspire you to identify things that you do daily and can be somehow optimized.

---

Till next time o/
