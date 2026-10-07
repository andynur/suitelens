# Static documentation site

`pnpm docs:build` renders the maintained Markdown sources to `.site/` using the local `marked`
build dependency. The output has no JavaScript, remote fonts, trackers or server requirements.
Local links are checked during the build. Preview with a static server, for example
`python3 -m http.server 8080 --directory .site`.

Deploy `.site/` to the maintainer's selected static host. Hosting selection/publication is pending;
the optional GitHub Pages workflow is manual (`workflow_dispatch`) and requires repository Pages
configuration plus maintainer review before running. No push automatically publishes this site.
