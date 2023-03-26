var hostname = "https://fsilva.me";
var index = lunr(function () {
    this.field('title')
    this.field('content', {boost: 10})
    this.field('category')
    this.field('tags')
    this.ref('id')
});



    index.add({
      title: "🔢 Go: Where is the decimal type?",
      category: null,
      content: "\n    \n\n\nGo doesn’t have a primitive decimal type for arbitrary-precision fixed-point decimal numbers. Yes, you read it right. Therefore, if you need to deal with fixed-point precision there are two main options:\n\n\n  Use an external package like decimal, which introduces the decimal type. However, the current version (1.3.1), can “only” represent numbers with a maximum of 2^31 digits after the decimal point.\n  Use int64 to store and deal with these numbers. For e.g. given you need 6 precision digits, therefore 79.23, 23.00, and 54.123456, become respectively 79230000, 23000000, and 54123456.\n\n\nThere is an open proposal to add decimal float types (IEEE 754-2008) in the std lib. However, for now, it’s just a proposal being discussed, without guarantee it will be ever added.\n",
      tags: ["go","programming","gotchas"],
      id: 0
    });
    

    index.add({
      title: "🧠 Go resources for beginners",
      category: null,
      content: "\n    \n\n\nBelow a living list of compiled links for whoever is learning Go.\n\nOfficial docs\n\n\n  Effective Go - https://go.dev/doc/effective_go\n    \n      A document that gives tips for writing clear, idiomatic Go code. A must-read for any new Go programmer. It augments the tour and the language specification, both of which should be read first.\n    \n  \n  \n    Go Code Review Comments https://github.com/golang/go/wiki/CodeReviewComment\n\n    \n      This page collects common comments made during reviews of Go code, so that a single detailed explanation can be referred to by shorthands. This is a laundry list of common mistakes, not a comprehensive style guide. You can view this as a supplement to Effective Go.\n    \n\n    \n  \n  Go Docs - https://go.dev/doc/\n    \n      Root for many useful documentations\n    \n  \n  FAQ - https://go.dev/doc/faq\n    \n      Answers to common questions about Go.\n    \n  \n\n\nBlogs\n\n\n  Dave Cheney - https://dave.cheney.net/\n    \n      Specially the practical go section, it has TONS of good advice and real-world examples of how to deal with daily challenges. I highly recommend it.\n    \n  \n\n\nCourses\n\n\n  \n    The way to go - https://www.educative.io/courses/the-way-to-go\n\n    \n      It’s a course from educative.io, it goes from the basics concepts of the language to more advanced ones. It also brings very interesting insights into the differences between the approaches of Java/C# to Go..\n    \n  \n  \n    How to code in go - https://www.digitalocean.com/community/tutorial_series/how-to-code-in-go\n    \n      A great collection of tutorials that cover basic Go concepts, ideal for beginers\n    \n  \n\n\nVideos\n\n\n  Go in 100 seconds - https://www.youtube.com/watch?v=446E-r0rXHI&amp;t=38s\n    \n      Short introduction about Go\n    \n  \n  Simplicity is complicated - https://www.youtube.com/watch?v=rFejpH_tAHM\n    \n      Rob Pike talks about how Go is often described as a simple language. It is not, it just seems that way. Rob explains how Go’s simplicity hides a great deal of complexity, and that both the simplicity and complexity are part of the design.\n    \n  \n  Concurrency is not parallelism - https://www.youtube.com/watch?v=qmg1CF3gZQ0&amp;t=1582s\n    \n      Rob Pike talks about concurrency and how Go implements it\n    \n  \n  Understanding channels - https://www.youtube.com/watch?v=KBZlN0izeiY&amp;t=1011s\n    \n      Channels provide a simple mechanism for goroutines to communicate, and a powerful construct to build sophisticated concurrency patterns. We will delve into the inner workings of channels and channel operations, including how they’re supported by the runtime scheduler and memory\n    \n  \n  Concurrency in Go - https://www.youtube.com/watch?v=\\_uQgGS_VIXM&amp;list=PLsc-VaxfZl4do3Etp_xQ0aQBoC-x5BIgJ\n    \n      Playlist with a few short videos about different components of concurrency in Go\n    \n  \n  Just for func - https://www.youtube.com/watch?v=H_4eRD8aegk&amp;list=PL64wiCrrxh4Jisi7OcCJIUpguV_f5jGnZ\n    \n      A very complete playlist of tutorials given by Francesc Campoy, a past Developer Advocate for the Go team at Google, that cover simple to advanced topics in Go\n    \n  \n  Golang crash course - https://www.youtube.com/watch?v=SqrbIlUwR0U\n    \n      A 90 minutes video that covers most of Go features with cristal clear live coding examples, excelent for beginers to get a fast gist of Go\n    \n  \n\n\nPodcasts\n\n\n  Go Time - Spotify\n    \n      Diverse discussions from around the Go and its community\n    \n  \n\n",
      tags: ["go","programming","learning"],
      id: 1
    });
    

    index.add({
      title: "👋 Welcome",
      category: null,
      content: "\n    \n\n\nWelcome, here I’ll be sharing my discoveries, studies, and experiences in the software industry. As a software engineer, I’ve had the opportunity to work on a variety of projects and technologies, and I’ve learned a lot along the way.\n\n\n\nMy goal in creating this blog is to document my journey and share what I’ve learned with others. Whether you’re a seasoned developer or just starting out, I hope that the insights and knowledge I share will be useful and valuable to you.\n\nIn this blog, you can expect to find posts about various topics related to software engineering, such as programming languages, frameworks, tools, best practices, and more. I’ll also share my thoughts on the latest trends and developments in the industry.\n\nAbove all, I hope that this blog will inspire you to continue learning and growing as a software engineer. Thanks for stopping by, and I look forward to sharing my experiences with you.\n",
      tags: ["thougths"],
      id: 2
    });
    


var store = [{
    "title": "🔢 Go: Where is the decimal type?",
    "link": "/go-decimal-type.html",
    "image": null,
    "date": "March 21, 2023",
    "category": null,
    "excerpt": "Go doesn’t have a primitive decimal type for arbitrary-precision fixed-point decimal numbers. Yes, you read it right. Therefore, if you..."
},{
    "title": "🧠 Go resources for beginners",
    "link": "/go-resources.html",
    "image": null,
    "date": "March 19, 2023",
    "category": null,
    "excerpt": "Below a living list of compiled links for whoever is learning Go. Official docs Effective Go - https://go.dev/doc/effective_go A document..."
},{
    "title": "👋 Welcome",
    "link": "/welcome.html",
    "image": null,
    "date": "March 19, 2023",
    "category": null,
    "excerpt": "Welcome, here I’ll be sharing my discoveries, studies, and experiences in the software industry. As a software engineer, I’ve had..."
}]

$(document).ready(function() {
    $('#search-input').on('keyup', function () {
        var resultdiv = $('#results-container');
        if (!resultdiv.is(':visible'))
            resultdiv.show();
        var query = $(this).val();
        var result = index.search(query);
        resultdiv.empty();
        $('.show-results-count').text(result.length + ' Results');
        for (var item in result) {
            var ref = result[item].ref;
            var searchitem = '<li><a href="'+ hostname + store[ref].link+'">'+store[ref].title+'</a></li>';
            resultdiv.append(searchitem);
        }
    });
});