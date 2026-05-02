import { LLMProvider } from "@marie/llm";
import imageCommand from "../telegram/dist/commands/image.js";

async function runTest() {
  console.log("Starting E2E Integration Test...");

  const mockCtx = {
    args: ["sunset", "over", "mountains"],
    reply: async (msg) => {
      console.log("[Bot Reply]:", msg);
    }
  };

  try {
    console.log("Triggering .image command...");
    const cmd = imageCommand.default || imageCommand;
    await cmd.handler(mockCtx);
    console.log("Integration Test Passed!");
  } catch (err) {
    console.error("Integration Test Failed:", err);
  }
}

runTest();
