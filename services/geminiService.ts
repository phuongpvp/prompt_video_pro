import { GoogleGenAI, Type } from "@google/genai";
import { Story, Character, Script } from '../types';

// --- CẤU HÌNH XOAY VÒNG API KEY ---
const getAvailableApiKeys = (): string[] => {
    // VITE YÊU CẦU KHAI BÁO TƯỜNG MINH, KHÔNG DÙNG VÒNG LẶP ĐỘNG ĐƯỢC
    const allKeys = [
        import.meta.env.VITE_GEMINI_API_KEY_1,
        import.meta.env.VITE_GEMINI_API_KEY_2,
        import.meta.env.VITE_GEMINI_API_KEY_3,
        import.meta.env.VITE_GEMINI_API_KEY_4,
        import.meta.env.VITE_GEMINI_API_KEY_5,
        import.meta.env.VITE_GEMINI_API_KEY_6,
        import.meta.env.VITE_GEMINI_API_KEY_7,
        import.meta.env.VITE_GEMINI_API_KEY_8,
        import.meta.env.VITE_GEMINI_API_KEY_9,
        import.meta.env.VITE_GEMINI_API_KEY_10,
        // Fallback cho key gốc nếu có
        import.meta.env.VITE_GEMINI_API_KEY,
        import.meta.env.GEMINI_API_KEY
    ];

    // Lọc bỏ các giá trị undefined hoặc rỗng
    const validKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.length > 10);
    
    return validKeys;
};

const API_KEYS = getAvailableApiKeys();
let currentKeyIndex = 0;

const getNextApiKey = (): string => {
    if (API_KEYS.length === 0) {
        console.error("CRITICAL: Không tìm thấy API Key nào hợp lệ.");
        throw new Error("Chưa cấu hình API Key trong file .env.local hoặc Vite không đọc được biến môi trường.");
    }
    
    // Lấy key hiện tại
    const key = API_KEYS[currentKeyIndex];
    
    // Log để kiểm tra xem có xoay không (F12 để xem console)
    console.log(`[System] Đang dùng Key index: ${currentKeyIndex} (Tổng: ${API_KEYS.length} keys) - Key đuôi: ...${key.slice(-4)}`);

    // Tăng index cho lần sau (Xoay vòng)
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    
    return key;
};
// ------------------------------------

// Centralized error handler
const handleGeminiError = (error: unknown, context: string): Error => {
    console.error(`Error during ${context}:`, error);
    const errorMessage = String(error).toLowerCase();

    if (errorMessage.includes('imagen api is only accessible to billed users')) {
        return new Error('Lỗi: API tạo ảnh (Imagen) yêu cầu tài khoản Google AI Studio của bạn phải được bật tính năng thanh toán.');
    }
    if (errorMessage.includes('overloaded') || errorMessage.includes('unavailable')) {
        return new Error("Lỗi: Model AI hiện đang quá tải. Vui lòng đợi một lát rồi thử lại.");
    }
    if (errorMessage.includes('resource_exhausted') || errorMessage.includes('quota')) {
        return new Error("Lỗi: Key hiện tại đã hết dung lượng (Quota). Hãy thử nhấn nút Tạo lại, hệ thống sẽ tự đổi sang key khác.");
    }
    
    // Default messages based on context
    switch (context) {
        case 'story generation':
            return new Error("Không thể tạo ý tưởng câu chuyện. " + errorMessage);
        case 'character generation':
            return new Error("Không thể tạo chi tiết nhân vật. " + errorMessage);
        case 'image generation':
            return new Error("Không thể tạo ảnh. " + errorMessage);
        case 'script generation':
            return new Error("Không thể tạo kịch bản. " + errorMessage);
        default:
            return new Error("Đã xảy ra lỗi không xác định. " + errorMessage);
    }
};


export const generateStoryIdeas = async (idea: string, style: string, count: number): Promise<Omit<Story, 'id'>[]> => {
  const currentKey = getNextApiKey();
  const ai = new GoogleGenAI({ apiKey: currentKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      // SỬA Ở ĐÂY: Thêm khẩu lệnh ép số lượng
      contents: `Nhiệm vụ: Tạo CHÍNH XÁC ${count} ý tưởng câu chuyện (TUYỆT ĐỐI KHÔNG ĐƯỢC TẠO NHIỀU HƠN ${count} Ý TƯỞNG).
      
      Thông tin đầu vào:
      - Ý tưởng gốc: "${idea}"
      - Phong cách: "${style}"
      
      Yêu cầu đầu ra:
      Với mỗi ý tưởng, hãy cung cấp:
      - "title": Tên câu chuyện (Tiếng Anh hoặc Việt tùy ngữ cảnh)
      - "summary": Tóm tắt ngắn gọn.`,
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
    // Cắt bớt mảng nếu AI vẫn cố tình trả về dư (phòng hờ)
    const data = JSON.parse(jsonString);
    return data.slice(0, count); 
  } catch (error) {
    throw handleGeminiError(error, 'story generation');
  }
};

export const generateCharacterDetails = async (story: Story, numCharacters: number, style: string): Promise<Omit<Character, 'id' | 'imageUrl' | 'imageMimeType' | 'isLoadingImage' | 'error'>[]> => {
    const currentKey = getNextApiKey();
    const ai = new GoogleGenAI({ apiKey: currentKey });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash", // Dùng 2.0 Flash
            contents: `Dựa trên câu chuyện có tên "${story.title}" với tóm tắt "${story.summary}", hãy xác định và tạo ra ${numCharacters} nhân vật CHÍNH của câu chuyện.
            
**QUAN TRỌNG:** Hãy tập trung vào các nhân vật trung tâm. Nếu câu chuyện về các sinh vật như quái vật hoặc động vật, thì chính chúng là nhân vật cần được tạo ra.

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
    const currentKey = getNextApiKey();
    const ai = new GoogleGenAI({ apiKey: currentKey });

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001', // Imagen 3 ổn định hơn 4 lúc này
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
    const currentKey = getNextApiKey();
    const ai = new GoogleGenAI({ apiKey: currentKey });
    
    const characterDescriptions = characters.map(c => `- ${c.name}: ${c.prompt}`).join('\n');
    const expectedScenes = Math.ceil(duration / 8);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash", // Dùng 2.0 Flash
            contents: `Với vai trò là một nhà biên kịch, hãy viết kịch bản video dài ${duration} giây.
            
            **Thông tin:**
            - Tên: ${story.title}
            - Tóm tắt: ${story.summary}
            - Nhân vật: \n${characterDescriptions}

            **Yêu cầu:**
            1. Viết "summary" (tóm tắt kịch bản).
            2. Chia thành đúng ${expectedScenes} "scenes".
            3. Mỗi cảnh gồm: "id", "description" (tiếng Việt), "narration" (lời dẫn ${narrationLanguage}), "veo_prompt" (tiếng Anh, phải chứa tên ít nhất 1 nhân vật), "characters_present" (danh sách nhân vật trong cảnh).
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.NUMBER },
                                    description: { type: Type.STRING },
                                    narration: { type: Type.STRING },
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
