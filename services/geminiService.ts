import { GoogleGenAI, Type } from "@google/genai";
import { Story, Character, Script } from '../types';

// --- CẤU HÌNH XOAY VÒNG API KEY ---
const getAvailableApiKeys = (): string[] => {
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
        import.meta.env.VITE_GEMINI_API_KEY,
        import.meta.env.GEMINI_API_KEY
    ];
    return allKeys.filter((key): key is string => typeof key === 'string' && key.length > 10);
};

const API_KEYS = getAvailableApiKeys();
let currentKeyIndex = 0;

// Hàm lấy key tiếp theo
const getNextApiKey = (): string => {
    if (API_KEYS.length === 0) throw new Error("Chưa cấu hình API Key.");
    const key = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length; // Xoay vòng index
    return key;
};

// --- HÀM XỬ LÝ LỖI & TỰ ĐỘNG THỬ LẠI (RETRY) ---
const callWithRetry = async <T>(apiCall: (apiKey: string) => Promise<T>, context: string): Promise<T> => {
    let lastError: any;
    
    // Thử qua tất cả các key có trong danh sách
    for (let i = 0; i < API_KEYS.length; i++) {
        try {
            const apiKey = getNextApiKey();
            return await apiCall(apiKey); // Gọi hàm API với key hiện tại
        } catch (error: any) {
            lastError = error;
            const errMsg = String(error).toLowerCase();
            
            // Nếu lỗi do Key chết (403), Hết hạn mức (429), hoặc Suspended -> Thử key tiếp theo ngay
            if (errMsg.includes('permission denied') || errMsg.includes('suspended') || errMsg.includes('resource_exhausted') || errMsg.includes('429') || errMsg.includes('403')) {
                console.warn(`[Auto-Retry] Key bị lỗi (${errMsg}). Đang chuyển sang key khác...`);
                continue; // Bỏ qua lỗi này, chạy vòng lặp tiếp theo để lấy key mới
            }
            
            // Nếu lỗi khác (ví dụ sai prompt, server sập) thì ném lỗi ra luôn
            throw handleGeminiError(error, context);
        }
    }
    
    // Nếu thử hết key mà vẫn lỗi
    throw handleGeminiError(lastError, context);
};

// Centralized error handler
const handleGeminiError = (error: unknown, context: string): Error => {
    console.error(`Error during ${context}:`, error);
    const errorMessage = String(error).toLowerCase();

    if (errorMessage.includes('billed users')) return new Error('Lỗi: API tạo ảnh yêu cầu tài khoản có thanh toán.');
    if (errorMessage.includes('overloaded')) return new Error("Lỗi: Server Google quá tải, vui lòng thử lại.");
    if (errorMessage.includes('suspended')) return new Error("Lỗi: Tất cả API Key đều bị khóa.");
    
    return new Error(`Đã xảy ra lỗi khi ${context}. Chi tiết: ${errorMessage}`);
};


// --- CÁC HÀM CHÍNH (Đã bọc trong callWithRetry) ---

export const generateStoryIdeas = async (idea: string, style: string, count: number): Promise<Omit<Story, 'id'>[]> => {
  return callWithRetry(async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Nhiệm vụ: Tạo CHÍNH XÁC ${count} ý tưởng câu chuyện.
        Thông tin: Ý tưởng "${idea}", phong cách "${style}".
        Yêu cầu: 
        1. BẮT BUỘC 100% TIẾNG VIỆT.
        2. Số lượng đúng ${count}.
        Output JSON: [{"title": "Tên", "summary": "Tóm tắt"}]`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
              },
              required: ["title", "summary"],
            },
          },
        },
      });
      return JSON.parse(response.text.trim()).slice(0, count);
  }, 'tạo ý tưởng');
};

export const generateCharacterDetails = async (story: Story, numCharacters: number, style: string): Promise<Omit<Character, 'id' | 'imageUrl' | 'imageMimeType' | 'isLoadingImage' | 'error'>[]> => {
    return callWithRetry(async (apiKey) => {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Dựa trên truyện "${story.title}" (${story.summary}), tạo ${numCharacters} nhân vật chính.
            Output JSON: [{"name": "Tên (Tiếng Việt)", "prompt": "Mô tả ngoại hình tính cách (Tiếng Anh để vẽ ảnh)"}]`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            prompt: { type: Type.STRING },
                        },
                         required: ["name", "prompt"],
                    },
                },
            },
        });
        return JSON.parse(response.text.trim());
    }, 'tạo nhân vật');
};

export const generateCharacterImage = async (prompt: string): Promise<{ imageBytes: string, mimeType: string }> => {
    return callWithRetry(async (apiKey) => {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '1:1' },
        });
        const image = response.generatedImages[0].image;
        return { imageBytes: image.imageBytes, mimeType: image.mimeType };
    }, 'tạo ảnh');
};

export const generateScript = async (story: Story, characters: Character[], duration: number, narrationLanguage: string): Promise<Script> => {
    return callWithRetry(async (apiKey) => {
        const ai = new GoogleGenAI({ apiKey });
        const charDesc = characters.map(c => `- ${c.name}: ${c.prompt}`).join('\n');
        const expectedScenes = Math.ceil(duration / 8);

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Viết kịch bản video ${duration} giây (${expectedScenes} cảnh).
            Truyện: ${story.title}. Tóm tắt: ${story.summary}.
            Nhân vật: ${charDesc}.
            Yêu cầu:
            1. Output JSON format.
            2. "narration" ngôn ngữ: ${narrationLanguage}.
            3. "veo_prompt": Tiếng Anh, chứa tên nhân vật.
            4. "description": Tiếng Việt.`,
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
        return JSON.parse(response.text.trim());
    }, 'tạo kịch bản');
};
