import fs from "fs";

export default {
  name: "image",
  description: "Generate an image natively",
  category: "AI",
  usage: "<prompt>",
  cooldown: 5,
  
  handler: async (ctx) => {
    const prompt = ctx.args.join(" ");
    
    if (!prompt) {
      await ctx.reply("Please provide a prompt. Example: .image a cute orange cat");
      return;
    }

    const waitMsg = await ctx.reply("🎨 Generating image...");

    try {
      const response = await ctx.llm.generateImage(prompt);
      
      await ctx.platform.sendMedia(ctx.event.threadID, response.filePath, "image", `🎨 ${prompt}`);
      
      try {
        fs.unlinkSync(response.filePath);
      } catch (e) {
        console.error("Failed to delete temp image:", e);
      }
    } catch (error) {
      await ctx.reply(`❌ Error generating image: ${error.message}`);
    }
  }
};
