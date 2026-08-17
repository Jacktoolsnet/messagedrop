# Geodata source and licence

The geographic and point-of-interest data processed by this service originates
from OpenStreetMap.

- Data: © OpenStreetMap contributors
- Licence: Open Data Commons Open Database License 1.0 (ODbL)
- Copyright and licence information: https://www.openstreetmap.org/copyright
- Extract source: Geofabrik GmbH, https://download.geofabrik.de/

MessageDrop downloads country extracts, filters them according to the countries
and POI categories enabled by an administrator, normalizes selected OpenStreetMap
tags, and stores the required records in a versioned PostgreSQL database.

This notice applies to database copies, backups, and exports created by the
Geodata service. Reuse of OpenStreetMap-derived data is governed by the ODbL.
MessageDrop does not grant additional rights in that data and does not restrict
rights provided directly by the ODbL.
