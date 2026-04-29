const path = require('path');
try {
    const mod = require('./temp/CYBER-MIRAI-BOT/Script/commands/setting.js');
    console.log("Success loading setting.js");
} catch (e) {
    console.error("Error loading setting.js:");
    console.error(e);
}
