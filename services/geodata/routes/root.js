const express = require('express');
const router = express.Router();
function serviceStatus() {
  return {
    status: 'Geodata service is up and running.',
    dataExports: {
      description: 'Machine-readable MessageDrop OpenStreetMap POI database exports',
      manifest: '/geodata/exports',
      format: 'JSONL.gz',
      attribution: '© OpenStreetMap contributors',
      attributionUrl: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/'
    }
  };
}

router.get('/', (_req, res) => res.json(serviceStatus()));
module.exports = router;
module.exports.serviceStatus = serviceStatus;
