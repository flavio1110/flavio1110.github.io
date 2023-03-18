---
layout: home
---

<section id="one">
    <div class="image main" data-position="center">
        <img src="images/banner.jpeg" alt="" />
    </div>
    <div class="home-container">
        <div class="card">
            <h3>Hello there! 👋 </h3>
            <p>I'm fascinated about how tech can change people's lives and how we can tackle real-world problems with software.</p>
            <p>As a full-stack software engineer with loads of experience, I've spent most of my career focused on the .NET stack, but I also have profissional experience with Typescript, React, NextJs, etc.</p>
            <p>But listen, my interest goes way beyond code – I'm all about the entire life cycle the software development.</p>
            <p>Hit me up using one of the channels below, and we'll chat real soon! :)</p>
            <div class="icons-card">
                <ul class="icons">
                    <li><a href="https://github.com/flavio1110" target="_blank" class="icon brands fa-twitter"><span class="label">Twitter</span></a></li>
                    <li><a href="https://www.linkedin.com/in/flavio1110" target="_blank" class="icon brands fa-linkedin"><span class="label">Instagram</span></a></li>
                    <li><a href="https://github.com/flavio1110" target="_blank" class="icon brands fa-github"><span class="label">Github</span></a></li>
                    <li><a href="mailto:flavio1110@gmail.com" target="_blank" class="icon solid fa-envelope"><span class="label">Email</span></a></li>
                </ul>
            </div>
        </div>
        {%- if site.posts.size > 0 -%}
        <div class="card">
            <h3>📣 Latest posts </h3>
            <ul class="post-list">
                {%- for post in site.posts -%}
                <li>
                    {%- assign date_format = site.minima.date_format | default: "%b %-d, %Y" -%}
                    <span class="post-meta">{{ post.date | date: date_format }}</span>
                    <h3>
                    <a class="post-link" href="{{ post.url | relative_url }}">
                        {{ post.title | escape }}
                    </a>
                    </h3>
                    {%- if site.show_excerpts -%}
                    {{ post.excerpt }}
                    {%- endif -%}
                </li>
                {%- endfor -%}
            </ul>
        </div>
        {%- endif -%}
    </div>
</section>
