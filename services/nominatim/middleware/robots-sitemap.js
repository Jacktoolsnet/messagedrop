const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
const SITEMAP_XML = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';

function setRobotsSitemapHeaders(res) {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function robotsSitemapMiddleware() {
  return function handleRobotsSitemap(req, res, next) {
    if (req.path === '/robots.txt') {
      setRobotsSitemapHeaders(res);
      res.type('text/plain').send(ROBOTS_TXT);
      return;
    }
    if (req.path === '/sitemap.xml') {
      setRobotsSitemapHeaders(res);
      res.type('application/xml').send(SITEMAP_XML);
      return;
    }
    next();
  };
}

module.exports = robotsSitemapMiddleware;
