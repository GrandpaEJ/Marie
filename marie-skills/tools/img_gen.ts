import { z } from 'zod';

/**
 * Image Generation tool using Pollinations.ai (free).
 */
export default {
  name: 'generate_image',
  description: 'Generate high-quality images from a text prompt. Ideal for anime, scenery, or characters.',
  category: 'media',
  riskLevel: 'low',
  schema: z.object({
    prompt: z.string().describe('Detailed description of the image to generate'),
    width: z.number().optional().default(1024),
    height: z.number().optional().default(1024),
    enhance: z.boolean().optional().default(true)
  }),
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      width: { type: 'number' },
      height: { type: 'number' },
      enhance: { type: 'boolean' }
    },
    required: ['prompt']
  },
  handler: async ({ prompt, width, height, enhance }: any) => {
    // Pollinations.ai simple URL generation
    const seed = Math.floor(Math.random() * 1000000);
    const optimizedPrompt = enhance ? `masterpiece, high quality, ${prompt}` : prompt;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(optimizedPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

    return {
      success: true,
      url,
      prompt: optimizedPrompt,
      message: `Image generated successfully. ![image](${url})`
    };
  }
};
