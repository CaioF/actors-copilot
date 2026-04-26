jest.mock("firebase/ai", () => ({
  getAI: jest.fn(),
  getGenerativeModel: jest.fn(),
  VertexAIBackend: jest.fn().mockImplementation(() => ({})),
  SchemaType: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
  },
}));

jest.mock("@/lib/firebase", () => ({
  getApp: jest.fn(),
}));

jest.mock("./extraction-tool-schema", () => ({
  EXTRACTION_TOOL: {
    functionDeclarations: [
      {
        name: "update_master_profile",
        description: "Test",
        parameters: {
          type: "OBJECT",
          properties: {},
          required: [],
        },
      },
    ],
  },
}));

import { getAI, getGenerativeModel, VertexAIBackend } from "firebase/ai";
import type { ChatHistoryMessage, ExtractedPsychData } from "@/lib/chat-types";

describe("runCoachTriggeredExtraction", () => {
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent = jest.fn();
    (getAI as jest.Mock).mockReturnValue({});
    (getGenerativeModel as jest.Mock).mockReturnValue({
      generateContent: mockGenerateContent,
    });
  });

  it("calls extractionModel.generateContent with a prompt containing [CONVERSATION HISTORY] and [LATEST ACTOR INPUT]", async () => {
    jest.isolateModules(() => {
      const { runCoachTriggeredExtraction } = require("./run-extraction");

      const history: ChatHistoryMessage[] = [
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "Hi there" }] },
        { role: "user", parts: [{ text: "I've been feeling stuck lately" }] },
      ];
      const content = "I think I know what my core wound is";

      mockGenerateContent.mockResolvedValue({
        response: {
          functionCalls: () => [],
        },
      });

      runCoachTriggeredExtraction({ content, history });

      expect(mockGenerateContent).toHaveBeenCalled();
      const [promptArg] = mockGenerateContent.mock.calls[0];
      expect(promptArg).toContain("[CONVERSATION HISTORY]");
      expect(promptArg).toContain("[LATEST ACTOR INPUT]");
    });
  });

  it("returns extracted data when function call exists", async () => {
    let result: ExtractedPsychData | null | undefined = undefined;
    await jest.isolateModulesAsync(async () => {
      const { runCoachTriggeredExtraction } = require("./run-extraction");

      const history: ChatHistoryMessage[] = [
        { role: "user", parts: [{ text: "Hello" }] },
      ];
      const content = "I think I know what my core wound is";

      const extractedData: ExtractedPsychData = {
        is_valuable_extraction: true,
        new_traits: ["introspective"],
        progress_assessment: {
          has_actionable_pattern: true,
          depth_score: 7,
        },
      };

      mockGenerateContent.mockResolvedValue({
        response: {
          functionCalls: () => [
            { name: "update_master_profile", args: extractedData },
          ],
        },
      });

      result = await runCoachTriggeredExtraction({ content, history });
    });

    expect(result).toEqual({
      is_valuable_extraction: true,
      new_traits: ["introspective"],
      progress_assessment: {
        has_actionable_pattern: true,
        depth_score: 7,
      },
    });
  });

  it("returns null when no function call (empty functionCalls)", async () => {
    let result: ExtractedPsychData | null | undefined = undefined;
    await jest.isolateModulesAsync(async () => {
      const { runCoachTriggeredExtraction } = require("./run-extraction");

      const history: ChatHistoryMessage[] = [
        { role: "user", parts: [{ text: "Hello" }] },
      ];
      const content = "just small talk";

      mockGenerateContent.mockResolvedValue({
        response: {
          functionCalls: () => [],
        },
      });

      result = await runCoachTriggeredExtraction({ content, history });
    });

    expect(result).toBeNull();
  });

  it("returns null when functionCalls is undefined", async () => {
    let result: ExtractedPsychData | null | undefined = undefined;
    await jest.isolateModulesAsync(async () => {
      const { runCoachTriggeredExtraction } = require("./run-extraction");

      const history: ChatHistoryMessage[] = [
        { role: "user", parts: [{ text: "Hello" }] },
      ];
      const content = "just small talk";

      mockGenerateContent.mockResolvedValue({
        response: {
          functionCalls: () => undefined,
        },
      });

      result = await runCoachTriggeredExtraction({ content, history });
    });

    expect(result).toBeNull();
  });

  it("slices history to last 7 messages in prompt", async () => {
    await jest.isolateModulesAsync(async () => {
      const { runCoachTriggeredExtraction } = require("./run-extraction");

      const history: ChatHistoryMessage[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "model",
        parts: [{ text: `Message ${i}` }],
      }));
      const content = "Recent thought";

      mockGenerateContent.mockResolvedValue({
        response: {
          functionCalls: () => [],
        },
      });

      runCoachTriggeredExtraction({ content, history });

      expect(mockGenerateContent).toHaveBeenCalled();
      const [promptArg] = mockGenerateContent.mock.calls[0];
      expect(promptArg).toContain("Message 8");
      expect(promptArg).toContain("Message 14");
      expect(promptArg).not.toContain("Message 0");
      expect(promptArg).not.toContain("Message 6");
    });
  });

  it("uses gemini-2.5-pro model and temperature 0.1", async () => {
    await jest.isolateModulesAsync(async () => {
      const { runCoachTriggeredExtraction } = require("./run-extraction");

      const history: ChatHistoryMessage[] = [
        { role: "user", parts: [{ text: "Hello" }] },
      ];
      const content = "test";

      mockGenerateContent.mockResolvedValue({
        response: {
          functionCalls: () => [],
        },
      });

      await runCoachTriggeredExtraction({ content, history });

      expect(getGenerativeModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          model: "gemini-2.5-pro",
          generationConfig: { temperature: 0.1 },
        })
      );
    });
  });
});
