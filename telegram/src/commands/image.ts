import { IMarieContext, ICommand } from "@marie/brain";
import fs from "fs";

export default {
  name: "image",
  description: "Generate an image natively",
  category: "AI",
  usage: "<prompt>",
  cooldown: 5,
  
  handler: async (ctx: IMarieContext) => {
    const prompt = ctx.args.join(" ");
    
    if (!prompt) {
      await ctx.reply("Please provide a prompt. Example: .image a cute orange cat");
      return;
    }

    const waitMsg = await ctx.reply("🎨 Generating image...");

    try {
      const response = await ctx.llm.generateImage(prompt);
      
      // Send the image with the prompt as the caption
      await ctx.platform.sendMedia(ctx.event.threadID, response.filePath, "image", `🎨 ${prompt}`);
      
      // Clear the temporary file
      try {
        fs.unlinkSync(response.filePath);
      } catch (e) {
        console.error("Failed to delete temp image:", e);
      }
    } catch (error: any) {
      await ctx.reply(`❌ Error generating image: ${error.message}`);
    }
  }
} as ICommand;
