const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
const SITEMAP_XML = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';

function robotsSitemapMiddleware() {
  return function handleRobotsSitemap(req, res, next) {
    if (req.path === '/robots.txt') {
      res.type('text/plain').send(ROBOTS_TXT);
      return;
    }
    if (req.path === '/sitemap.xml') {
      res.type('application/xml').send(SITEMAP_XML);
      return;
    }
    next();
  };
}

module.exports = robotsSitemapMiddleware;
