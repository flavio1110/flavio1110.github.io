---
layout: post
title: "🔢 Go: Where is the decimal type?"
date: 2023-03-21 14:00:00 +0100
mood: speechless
description: If you are coming from other languange backgrounds lile C# and Java, you probably wondered where is the decimal type in Go
tags:
  - go
  - programming
  - gotchas
---

<figure class="aligncenter">
    <img src="{{ "images/gopher-side-eye.png" | absolute_url }}" alt="Gopher side-eye" />
</figure>

**Go** doesn't have a primitive `decimal` type for arbitrary-precision fixed-point decimal numbers. Yes, you read it right. Therefore, if you need to deal with fixed-point precision there are two main options:

- Use an external package like [decimal](https://github.com/shopspring/decimal), which introduces the `decimal` type. However, the current version (1.3.1), can "only" represent numbers with a maximum of 2^31 digits after the decimal point.
- Use `int64` to store and deal with these numbers. For e.g. given you need 6 precision digits, therefore `79.23`, `23.00`, and `54.123456`, become respectively `79230000`, `23000000`, and `54123456`.

There is an [open proposal](https://github.com/golang/go/issues/19787#issue-218228389) to add decimal float types (IEEE 754-2008) in the std lib. However, for now, it's just a proposal being discussed, without guarantee it will be ever added.
