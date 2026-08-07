const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchDeparturesForStops } = require('../routes/tripgo');

test('fetches grouped station departures separately and combines successful responses', async () => {
  const requested = [];
  const client = {
    departures: async (query) => {
      const stopCode = query.stopCodes[0];
      requested.push(stopCode);
      if (stopCode === 'broken') throw new Error('provider unavailable');
      return {
        status: 200,
        headers: {},
        data: {
          embarkationStops: [{ stopCode, services: [{ serviceTripID: `trip-${stopCode}` }] }],
          alerts: [{ title: `alert-${stopCode}` }]
        }
      };
    }
  };

  const response = await fetchDeparturesForStops(client, {
    region: 'DE_NI_Hanover', locale: 'de', limit: 40,
    stopCodes: ['train-parent', 'tram-parent', 'broken']
  });

  assert.deepEqual(requested, ['train-parent', 'tram-parent', 'broken']);
  assert.deepEqual(response.data.embarkationStops.map((stop) => stop.stopCode), [
    'train-parent', 'tram-parent'
  ]);
  assert.equal(response.data.alerts.length, 2);
});
