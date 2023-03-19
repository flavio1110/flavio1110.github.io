---
layout: home
---

<section id="one">
    <div class="image main" data-position="center">
        <img src="images/banner.jpeg" alt="" />
    </div>
    <div class="home-container" id="home">
        <div class="card center source-pro">
            <h3>Hello there! 👋 </h3>
            <div class="px-2">
                <p>I'm fascinated about how tech can change people's lives and how we can tackle real-world problems with software.</p>
                <p>As a full-stack software engineer I have loads of experience with different stacks and industries.</p>
                <p>But listen, my interest goes way beyond code – I'm all about the entire life cycle the software development.</p>
                <p>Hit me up using one of the channels below, and we'll chat real soon! :)</p>
            </div>            
            <ul class="icons icons-card">
                <li><a href="https://github.com/flavio1110" target="_blank" class="icon brands fa-twitter"><span class="label">Twitter</span></a></li>
                <li><a href="https://www.linkedin.com/in/flavio1110" target="_blank" class="icon brands fa-linkedin"><span class="label">Instagram</span></a></li>
                <li><a href="https://github.com/flavio1110" target="_blank" class="icon brands fa-github"><span class="label">Github</span></a></li>
                <li><a href="mailto:flavio1110@gmail.com" target="_blank" class="icon solid fa-envelope"><span class="label">Email</span></a></li>
            </ul>
        </div>
        {%- if site.posts.size > 0 -%}
        <div class="card latest-posts">
            <h4 class="text-center">📣 📣 📣 Latest posts 📣 📣 📣 </h4>
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
        {%- endif -%}
    </div>
</section>
