---
layout: home
---

<div class="m-1 text-center">
    <h2>✉️ Contact</h2>
    <p>Hit me up using one of the channels below, and we'll chat real soon! :)</p>
    <div class="social-cards">
        {%- for link in site.data.contact -%}
            <a href="{{ link.url }}" target="_blank">
                <span class="icon {{ link.iconClass }} fa-3x">
                    <span class="label">{{ link.name }}</span>
                </span>
                <div class="text-size-7 source-prod">
                    {{ link.user }}
                </div>
            </a>
        {%- endfor -%}
    </div>
</div>
