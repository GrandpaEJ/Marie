import os from 'os';

export default {
  name: 'stats',
  description: 'Display Marie\'s operational statistics and usage metrics.',
  minRole: 'user',
  handler: async (ctx) => {
    const { reply, config, registry } = ctx;
    
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const memory = process.memoryUsage();
    const rss = Math.round(memory.rss / 1024 / 1024);
    
    let statsText = `📊 **Marie v3 Operational Metrics**\n`;
    statsText += `\n**System:**`;
    statsText += `\n├─ Uptime: ${hours}h ${minutes}m`;
    statsText += `\n├─ OS: ${os.type()} ${os.release()}`;
    statsText += `\n├─ Memory: ${rss}MB RSS`;
    statsText += `\n└─ Commands: ${registry.commands.size} active`;
    
    statsText += `\n\n**Providers:**`;
    statsText += `\n├─ Default: ${config.llm?.defaultModel}`;
    statsText += `\n└─ Fallback: ${config.llm?.fallbackModel}`;
    
    statsText += `\n\n**Environment:**`;
    statsText += `\n├─ Node: ${process.version}`;
    statsText += `\n└─ Prefix: ${config.prefix}`;

    await reply(statsText);
  }
};
