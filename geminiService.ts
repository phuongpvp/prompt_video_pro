import { GoogleGenAI, Type } from "@google/genai";
import { Story, Character, Script } from '../types';

// Centralized error handler
const handleGeminiError = (error: unknown, context: string): Error => {
    console.error(`Error during ${context}:`, error);
    const errorMessage = String(error).toLowerCase();

    if (errorMessage.includes('imagen api is only accessible to billed users')) {
        return new Error('Lỗi: API tạo ảnh (Imagen) yêu cầu tài khoản Google AI Studio của bạn phải được bật tính năng thanh toán. [Nhấn vào đây để kiểm tra cài đặt thanh toán](https://ai.google.dev/gemini-api/docs/billing)');
    }
    if (errorMessage.includes('overloaded') || errorMessage.includes('unavailable')) {
        return new Error("Lỗi: Model AI hiện đang quá tải. Vui lòng đợi một lát rồi thử lại.");
    }
    if (errorMessage.includes('resource_exhausted') || errorMessage.includes('quota')) {
        return new Error("Lỗi: Đã hết dung lượng (quota) cho API key hiện tại. Vui lòng nhấn nút 'Quản lý API Key' ở góc trên để chọn một key khác hoặc kiểm tra gói cước của bạn trên Google AI Studio.");
    }
    
    // Default messages based on context
    switch (context) {
        case 'story generation':
            return new Error("Không thể tạo ý tưởng câu chuyện. Vui lòng thử lại.");
        case 'character generation':
            return new Error("Không thể tạo chi tiết nhân vật. Vui lòng thử lại.");
        case 'image generation':
            return new Error("Không thể tạo ảnh. Vui lòng thử lại.");
        case 'script generation':
            return new Error("Không thể tạo kịch bản. Vui lòng thử lại.");
        default:
            return new Error("Đã xảy ra lỗi không xác định. Vui lòng thử lại.");
    }
};


export const generateStoryIdeas = async (idea: string, style: string, count: number): Promise<Omit<Story, 'id'>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Tạo ${count} ý tưởng câu chuyện dựa trên ý tưởng gốc: "${idea}" theo phong cách "${style}". Với mỗi ý tưởng, hãy cung cấp một "title" (tên câu chuyện) và một "summary" (tóm tắt ngắn).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Tên câu chuyện" },
              summary: { type: Type.STRING, description: "Tóm tắt câu chuyện" },
            },
            required: ["title", "summary"],
          },
        },
      },
    });
    const jsonString = response.text.trim();
    return JSON.parse(jsonString);
  } catch (error) {
    throw handleGeminiError(error, 'story generation');
  }
};

export const generateCharacterDetails = async (story: Story, numCharacters: number, style: string): Promise<Omit<Character, 'id' | 'imageUrl' | 'imageMimeType' | 'isLoadingImage' | 'error'>[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Dựa trên câu chuyện có tên "${story.title}" với tóm tắt "${story.summary}", hãy xác định và tạo ra ${numCharacters} nhân vật CHÍNH của câu chuyện.
            
**QUAN TRỌNG:** Hãy tập trung vào các nhân vật trung tâm. Nếu câu chuyện về các sinh vật như quái vật hoặc động vật (ví dụ: King Kong, Godzilla), thì chính chúng là nhân vật cần được tạo ra, chứ không phải các nhân vật con người phụ.

Với mỗi nhân vật, cung cấp một "name" (tên) và một "prompt" (mô tả chi tiết ngoại hình và tính cách bằng tiếng Anh theo phong cách ${style} để tạo ảnh AI).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Tên nhân vật" },
                            prompt: { type: Type.STRING, description: "Prompt tạo ảnh cho nhân vật bằng tiếng Anh" },
                        },
                         required: ["name", "prompt"],
                    },
                },
            },
        });
        const jsonString = response.text.trim();
        return JSON.parse(jsonString);
    } catch (error) {
        throw handleGeminiError(error, 'character generation');
    }
};

export const generateCharacterImage = async (prompt: string): Promise<{ imageBytes: string, mimeType: string }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });
        const image = response.generatedImages[0].image;
        return { imageBytes: image.imageBytes, mimeType: image.mimeType };
    } catch (error) {
        throw handleGeminiError(error, 'image generation');
    }
};


export const generateScript = async (story: Story, characters: Character[], duration: number, narrationLanguage: string): Promise<Script> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const characterDescriptions = characters.map(c => `- ${c.name}: ${c.prompt}`).join('\n');
    const expectedScenes = Math.ceil(duration / 8);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Với vai trò là một nhà biên kịch chuyên nghiệp, hãy viết một kịch bản video dạng kể chuyện dài ${duration} giây.
            
            **Thông tin câu chuyện:**
            - Tên: ${story.title}
            - Tóm tắt: ${story.summary}

            **Các nhân vật:**
            ${characterDescriptions}

            **Yêu cầu:**
            1. Viết một "summary" (tóm tắt kịch bản) ngắn gọn, hấp dẫn.
            2. Chia kịch bản thành chính xác ${expectedScenes} "scenes" (cảnh quay) để đảm bảo tổng thời lượng là ${duration} giây (mỗi cảnh khoảng 8 giây).
            3. Với mỗi cảnh, cung cấp các thông tin sau:
               - "id": Số thứ tự cảnh.
               - "description": Mô tả chi tiết bối cảnh và hành động bằng tiếng Việt.
               - "narration": Lời dẫn/lời tường thuật cho cảnh quay bằng ngôn ngữ "${narrationLanguage}". Đây là phần sẽ được thu âm thành voice-over.
               - "veo_prompt": Một câu lệnh (prompt) bằng tiếng Anh, súc tích và giàu hình ảnh, dùng để tạo video cho cảnh này bằng AI.
               - "characters_present": Một mảng chứa tên các nhân vật có mặt trong cảnh.
            4. **QUY TẮC BẮT BUỘC (TUYỆT ĐỐI KHÔNG VI PHẠM):**
               - **QUAN TRỌNG NHẤT:** Kịch bản này dùng để tạo video bằng AI (Veo). Để AI có thể tạo ra các nhân vật một cách nhất quán, mỗi cảnh ("scene") BẮT BUỘC phải có ít nhất một nhân vật trong danh sách "characters_present". **TUYỆT ĐỐI không tạo cảnh không có nhân vật.** Nếu là cảnh rộng hoặc cảnh thiết lập, hãy chọn nhân vật phù hợp nhất để đưa vào cảnh đó.
               - Từ quy tắc trên, "veo_prompt" của mỗi cảnh BẮT BUỘC PHẢI chứa tên của ÍT NHẤT MỘT nhân vật được liệt kê trong "characters_present". Đây là yêu cầu kỹ thuật bắt buộc, không phải là gợi ý. Hãy kiểm tra kỹ từng "veo_prompt" trước khi trả lời. Ví dụ: nếu "characters_present" là ["Godzilla", "Tướng Quân"], thì "veo_prompt" phải chứa "Godzilla" hoặc "Tướng Quân" hoặc cả hai.
               - Mỗi cảnh ("scene") BẮT BUỘC phải có lời dẫn ("narration"). Tuyệt đối không được để trống trường này.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "Tóm tắt kịch bản" },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.NUMBER },
                                    description: { type: Type.STRING },
                                    narration: { type: Type.STRING, description: "Lời dẫn/tường thuật cho cảnh quay" },
                                    veo_prompt: { type: Type.STRING },
                                    characters_present: { type: Type.ARRAY, items: { type: Type.STRING } },
                                },
                                required: ["id", "description", "narration", "veo_prompt", "characters_present"],
                            },
                        },
                    },
                    required: ["summary", "scenes"],
                },
            },
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);
    } catch (error) {
        throw handleGeminiError(error, 'script generation');
    }
};