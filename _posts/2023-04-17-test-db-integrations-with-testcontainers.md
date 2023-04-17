---
layout: post
title: "🔥 Test DB integrations with Testcontainers"
date: 2023-04-17 14:00:00 +0100
mood: speechless
description: Write fast, reliable, and isolated tests for your DB integrations with Testcontainers.
tags:
  - tests
  - database
  - tools
  - docker
---

<figure class="aligncenter">
  <img src="https://golang.testcontainers.org/logo.png" alt="Testcontainers logo" />
</figure>

Picture this, you have a critical and reasonably complicated piece of logic in your application that is handled in the database. Despite any change on it (or around it), you must have a 100% guarantee that piece continues to work just fine. So, what do you do?

<!--more-->

### Back in the days...

<figure class="aligncenter">
  <img src="{{ "images/caveofhands.jpeg" | absolute_url }}" alt="Ancient cave art of many hand prints." />
  <figcaption> Ancient cave art of many hand prints. (Credit: Petr Kratochvila/Shutterstock)</figcaption>
</figure>

Before the "age of containers", the solution would be a variant of the following:

1. Have a database with the schema aligned with the application's version.
2. Ensure your CI tool has access to that database, to run the tests in your CI pipeline.
3. Create a script to arrange the necessary data for the test.
4. Write your testing using the DB.
5. Create a script to revert any DB changes performed by the test, such as inserts, updates, etc.
   > [This is](https://avatao.com/blog-life-before-docker-and-beyond/) a very nice post about the Docker: Life Before and after.

##### What's the problem with testing with a shared database?

Simply put, it's complex, expensive to maintain, and has many other reasons to fail. For example:

- The DB's schema version is not the same as the application's version you want to test.
- There is a change in the network policy that blocks access to the database.
- Someone's test setup corrupted the data that you expected to have, so you arrange script fails, or the test fails because of missing data.

Because of the cost and flakiness of such tests, in many cases, the **_solution_** was to move logic from DB to the application's code when performance was not a problem, or just manually test it from time to time and hope it doesn't break because of an unforeseen reason (it-never-happened-in-the-last-30-minutes).
