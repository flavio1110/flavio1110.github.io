---
layout: home
---

<div>
    <ul class="no-bullets">
        {%- for post in site.posts limit:3 -%}
        <li>
            {%- assign date_format = site.minima.date_format | default: "%b %-d, %Y" -%}
            <div class="post-meta">
                <span>{{ post.date | date: date_format }}</span>
            </div>
            <h4>
                <a href="{{ post.url | relative_url }}">
                    <span class="block">{{ post.title | escape }}</span>
                    {%- if post.show_excerpts -%}
                    <span class="excerpt">
                        {{ post.excerpt }}
                    </span>
                    {%- endif -%}
                </a>
            </h4>
        </li>
        {%- endfor -%}
    </ul>
</div>
