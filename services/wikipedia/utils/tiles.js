const MAX_LATITUDE = 85.05112878;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lonToX(lon, zoom) {
  const size = 2 ** zoom;
  return clamp(Math.floor(((lon + 180) / 360) * size), 0, size - 1);
}

function latToY(lat, zoom) {
  const size = 2 ** zoom;
  const rad = clamp(lat, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI / 180;
  return clamp(Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * size), 0, size - 1);
}

function tileBounds(x, y, zoom) {
  const size = 2 ** zoom;
  const west = x / size * 360 - 180;
  const east = (x + 1) / size * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI;
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / size))) * 180 / Math.PI;
  return { north, south, east, west };
}

function tilesForBounds(bounds, zoom, maxTiles = 64) {
  if (bounds.west > bounds.east) throw new Error('antimeridian_not_supported');
  const minX = lonToX(bounds.west, zoom);
  const maxX = lonToX(bounds.east, zoom);
  const minY = latToY(bounds.north, zoom);
  const maxY = latToY(bounds.south, zoom);
  const count = (maxX - minX + 1) * (maxY - minY + 1);
  if (count > maxTiles) throw new Error('viewport_too_large');
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) tiles.push({ x, y, zoom, bounds: tileBounds(x, y, zoom) });
  }
  return tiles;
}

module.exports = { MAX_LATITUDE, tileBounds, tilesForBounds };
