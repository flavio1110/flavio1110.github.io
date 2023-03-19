---
layout: home
---

<div class="home-container" id="home">
    <div class="card text-center source-pro">
        <h3>Hello there! 👋 </h3>
        <div class="px-2">
            <p>I'm fascinated about how tech can change people's lives and how we can tackle real-world problems with software.</p>
            <p>As a full-stack software engineer I have loads of experience with different stacks and industries.</p>
            <p>But listen, my interest goes way beyond code – I'm all about the entire life cycle the software development.</p>
            <p>Hit me up using one of the channels below, and we'll chat real soon! :)</p>
        </div>            
        <ul class="icons icons-card">
            {%- for link in site.data.contact -%}
                <li><a href="{{ link.url }}" target="_blank" class="icon {{ link.iconClass}}"><span class="label">{{ link.name }}</span></a></li>
            {%- endfor -%}
        </ul>
    </div>
    {%- if site.posts.size > 0 -%}
    <div class="card latest-posts">
        <h4 class="text-center">📣 📣 📣 Latest posts 📣 📣 📣 </h4>
        <ul class="no-bullets items-separator">
            {%- for post in site.posts limit:3 -%}
            <li>
                {%- assign date_format = site.minima.date_format | default: "%b %-d, %Y" -%}
                <div class="italic color-light-gray text-size-7">
                    <span>{{ post.date | date: date_format }}</span>
                </div>
                <h4>
                    <a href="{{ post.url | relative_url }}">
                        <span class="block">{{ post.title | escape }}</span>
                        {%- if post.show_excerpts -%}
                        <span class="excerpt italic color-light-gray text-size-9 line-height-1">
                            {{ post.excerpt }}
                        </span>
                        {%- endif -%}
                    </a>
                </h4>
            </li>
            {%- endfor -%}
            <li class="text-right pr-2 text-size-9">
                <a href="{{ "/blog" | absolute_url }}">
                    <span class="block">👀 View all posts</span>
                </a>
            </li>
        </ul>
    </div>
    {%- endif -%}
</div>
