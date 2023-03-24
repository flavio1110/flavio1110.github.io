---
layout: home
---

<div class="center-container px-1">
  <div class="text-size-9" >
    <a href="{{ "/" | absolute_url }}">Home</a> › <a href="{{ "/blog" | absolute_url }}">Blog</a>
  </div>
    <h2>Blog</h2>
    <ul class="no-bullets items-separator">
        {%- for post in site.posts -%}
        <li>
            {%- assign date_format = site.minima.date_format | default: "%b %-d, %Y" -%}
            <div class="italic text-size-9">
                <span>{{ post.date | date: date_format }}</span>
            </div>
            <h4>
                <a href="{{ post.url | relative_url }}">
                    <span class="block">{{ post.title | escape }}</span>
                    {%- include tags.html -%}
                    {%- if post.show_excerpts -%}
                    <span class="excerpt italic text-size-9 text-normal">
                        {{ post.excerpt }}
                    </span>
                    {%- endif -%}
                </a>
            </h4>
        </li>
        {%- endfor -%}
    </ul>
</div>
