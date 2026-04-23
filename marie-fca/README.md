# @marie/fca

Marie-FCA: A high-performance, universal Facebook Chat API for Node.js, specially enhanced for the Marie AI Agent ecosystem.

## Credits & Legacy
This package is a rebranded and enhanced fork of the legacy **ST-FCA / stfca** library. 
We gratefully acknowledge the foundational work by:
- **ST | Sheikh Tamim** (Original creator of ST-FCA)
- The contributors of the original FCA ecosystem.

Enhanced and maintained by **Marie & Grandpa**.

## Features
- Optimized MQTT listening for low-latency message processing.
- Enhanced typing indicators and reaction support.
- Stability patches for modern Node.js environments.

## Usage
```javascript
import login from '@marie/fca';

login({ appState }, (err, api) => {
  // Use api.sendMessage, api.listenMqtt, etc.
});
```
