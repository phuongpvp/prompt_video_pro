import React, { useState, useEffect } from 'react';
import { AppStep, Story, Character, Script } from './types';
import { VISUAL_STYLES, NARRATION_LANGUAGES } from './constants';
import * as geminiService from './services/geminiService';
import Loader from './components/Loader';
import CharacterCard from './components/CharacterCard';

const BackIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>);
const DownloadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>);
const CreateNewIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110 2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>);

function App() {
    const [hasApiKey, setHasApiKey] = useState(false);
    const [step, setStep] = useState<AppStep>(AppStep.STORY_IDEAS);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Đang xử lý...');

    // Step 1 State
    const [storyIdea, setStoryIdea] = useState('');
    const [style, setStyle] = useState(VISUAL_STYLES[0]);
    const [narrationLanguage, setNarrationLanguage] = useState(NARRATION_LANGUAGES[0]);
    const [numStories, setNumStories] = useState(3);
    const [generatedStories, setGeneratedStories] = useState<Story[]>([]);
    
    // Step 2 State
    const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
    const [numCharacters, setNumCharacters] = useState(2);
    
    // Step 3 State
    const [characters, setCharacters] = useState<Character[]>([]);
    const [videoDuration, setVideoDuration] = useState(150);

    // Step 4 State
    const [script, setScript] = useState<Script | null>(null);

    useEffect(() => {
        const checkApiKey = async () => {
            const keyStatus = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(keyStatus);
        };
        checkApiKey();
    }, []);

    const handleSelectKey = async () => {
        await window.aistudio.openSelectKey();
        setHasApiKey(true); // Assume success to avoid race condition
    };


    const handleGenerateStories = async () => {
        setIsLoading(true);
        setLoadingMessage('Đang tạo ý tưởng...');
        try {
            const storiesData = await geminiService.generateStoryIdeas(storyIdea, style, numStories);
            setGeneratedStories(storiesData.map((s, i) => ({ ...s, id: i + 1 })));
        } catch (error) {
            alert(error instanceof Error ? error.message : "Lỗi không xác định");
        }
        setIsLoading(false);
    };

    const handleCreateCharacter = async () => {
        const selectedStory = generatedStories.find(s => s.id === selectedStoryId);
        if (!selectedStory) {
            alert("Vui lòng chọn một câu chuyện");
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Đang tạo mô tả nhân vật...');
        try {
            const characterDetails = await geminiService.generateCharacterDetails(selectedStory, numCharacters, style);
            const initialCharacters = characterDetails.map((cd, i) => ({
                id: i + 1,
                name: cd.name,
                prompt: cd.prompt,
                imageUrl: null,
                imageMimeType: null,
                isLoadingImage: false,
                error: null,
            }));
            setCharacters(initialCharacters);
            setStep(AppStep.CHARACTER_CREATION);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Lỗi không xác định");
        }
        setIsLoading(false);
    };

    const handleGenerateImage = async (characterId: number) => {
        setCharacters(prev => prev.map(c => c.id === characterId ? { ...c, isLoadingImage: true, error: null } : c));
        const character = characters.find(c => c.id === characterId);
        if (!character) return;
    
        try {
            const { imageBytes, mimeType } = await geminiService.generateCharacterImage(character.prompt);
            const imageUrl = `data:${mimeType};base64,${imageBytes}`;
            setCharacters(prev => prev.map(c => c.id === characterId ? { ...c, imageUrl, imageMimeType: mimeType, isLoadingImage: false } : c));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định khi tạo ảnh";
            setCharacters(prev => prev.map(c => c.id === characterId ? { ...c, error: errorMessage, isLoadingImage: false } : c));
        }
    };

    const handleDownloadImage = (characterId: number) => {
        const character = characters.find(c => c.id === characterId);
        if (!character || !character.imageUrl) return;
        const a = document.createElement('a');
        a.href = character.imageUrl;
        a.download = `${character.name.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleCharacterChange = (id: number, field: 'name' | 'prompt', value: string) => {
        setCharacters(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleGenerateScript = async () => {
        const selectedStory = generatedStories.find(s => s.id === selectedStoryId);
        if (!selectedStory) return;

        setIsLoading(true);
        setLoadingMessage('Đang viết kịch bản và kiểm tra...');
        try {
            const result = await geminiService.generateScript(selectedStory, characters, videoDuration, narrationLanguage);
            setScript(result);
            setStep(AppStep.SCRIPT_DISPLAY);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Lỗi không xác định");
        }
        setIsLoading(false);
    };

    const downloadPrompts = () => {
        if (!script) return;
        const content = script.scenes.map(scene => scene.veo_prompt.trim()).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prompts.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const languageToCode: { [key: string]: string } = {
        'Tiếng Việt': 'vi',
        'English': 'en',
        'Français': 'fr',
        'Español': 'es',
        '日本語': 'ja',
        '한국어': 'ko',
        '中文': 'zh',
    };

    const downloadNarration = () => {
        if (!script) return;
        const content = script.scenes.map(scene => scene.narration.trim()).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const langCode = languageToCode[narrationLanguage] || 'txt';
        a.download = `narration_${langCode}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const createProjectJson = (story: Story, characters: Character[], script: Script, style: string, duration: number, language: string) => {
        const createId = (name: string) => `char_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)}`;
    
        const characterMap = new Map(characters.map(c => [c.name, createId(c.name)]));
    
        const languageToCodeMap: { [key: string]: string } = {
            'Tiếng Việt': 'vi-VN',
            'English': 'en-US',
            'Français': 'fr-FR',
            'Español': 'es-ES',
            '日本語': 'ja-JP',
            '한국어': 'ko-KR',
            '中文': 'zh-CN',
        };
    
        const project = {
            version: "3.0.0",
            type: "project",
            projectId: `project_${story.title.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}`,
            metadata: {
                title: story.title,
                genre: "adventure",
                style: style,
                mood: ["epic", "emotional"],
                audience: "Teen+",
                aspectRatio: "16:9",
                language: languageToCodeMap[language] || 'en-US',
            },
            continuity: {
                styleFingerprint: "generated_style_v1",
                globalSeed: Math.floor(Math.random() * 100000),
                locks: { characterLock: true, lightingLock: true, paletteLock: true, assetLock: true, scaleLock: true },
                characterSeeds: Object.fromEntries(characters.map(c => [createId(c.name), Math.floor(Math.random() * 100000)])),
            },
            defaults: {
                lighting: "Natural",
                colorPalette: ["cold", "desaturated", "warm_firelight_accents"],
                pace: "normal",
                seedStrategy: "inherit_per_scene_then_offset_per_shot",
                styleStrength: 0.9,
                denoiseStrength: 0.35,
                negativePrompts: ["flicker", "model drift", "face/hand deformation"],
                cameraRules: { moveSpeed: "slow_to_medium", noHandheld: true, avoid: ["whip pans", "unmotivated angle flips"] }
            },
            characterDescriptions: characters.map(c => ({
                id: createId(c.name),
                name: c.name,
                physicalAppearance: c.prompt,
                clothing: "Described in physical appearance prompt.",
                characterTraits: "Described in physical appearance prompt.",
                voiceType: "N/A",
                seed: Math.floor(Math.random() * 100000),
            })),
            assets: { props: {}, locations: {} },
            shotTemplates: {
                establishing_wide: { lens: "35mm eq.", move: "slow pan or slow dolly-in", durationHint: 4 },
                medium: { lens: "50mm eq.", move: "gentle static with micro parallax", durationHint: 4 },
                close_up: { lens: "75mm eq.", move: "subtle push-in", durationHint: 3 }
            },
            veo3Settings: { resolution: "1080p", fps: 24, motion: "medium", continuityPriority: true, seedRespect: "strict" },
            globalContext: {
                logline: story.summary,
                themes: ["survival", "friendship", "adventure"],
                visualPalette: { lighting: "Natural", colorPalette: ["cold_blues", "white_snow", "warm_orange_firelight"] }
            },
            audioVoSettings: {
                voiceGender: "male",
                language: languageToCodeMap[language] || 'en-US',
                paceBpm: 80,
                style: "dramatic narration",
                microphone: "studio condenser cinematic",
                fx: ["slight reverb 12%", "EQ warm low-mids"],
                musicDucking: "-10dB during narration",
                exportFormat: "wav, mono 48kHz"
            },
            scenes: script.scenes.map((scene) => ({
                type: "scene",
                inherit: "project",
                sceneId: `scene_${String(scene.id).padStart(3, '0')}`,
                sceneNumber: scene.id,
                sceneTitle: scene.description.slice(0, 70) + '...',
                durationSec: Math.round(duration / script.scenes.length),
                setting: { place: "Varies", timeOfDay: "day", locationId: "loc_generic" },
                participatingCharacters: scene.characters_present.map(name => characterMap.get(name) || name),
                prompt: scene.veo_prompt,
                visual: {
                    lighting: "Natural cold daylight",
                    colorPalette: ["cold_blues", "white_snow", "desaturated_neutrals"],
                    pace: "normal",
                    shots: [{
                        id: `s${String(scene.id).padStart(3, '0')}`,
                        template: "medium",
                        camera: scene.description.slice(0, 70) + '...',
                        durationHint: 4,
                        seed: Math.floor(Math.random() * 100000),
                        shotPrompt: scene.veo_prompt,
                    }]
                },
                audio: {
                    dialogues: [{ character: "Narrator", line: scene.narration }],
                    music: { style: "orchestral", mood: "epic and emotional" },
                    sfx: ["howling winter wind", "footsteps in snow"]
                },
                meta: {
                    order: scene.id,
                    notes: "Generated from video script generator app.",
                    generatedAt: new Date().toISOString()
                }
            })),
            export: {
                container: "mp4",
                codec: "h264",
                bitrateTarget: "12Mbps",
                generatedAt: new Date().toISOString()
            }
        };
        return project;
    }

    const downloadJson = () => {
        if (!script || !selectedStoryId) return;
        const selectedStory = generatedStories.find(s => s.id === selectedStoryId);
        if (!selectedStory) return;
    
        const projectJson = createProjectJson( selectedStory, characters, script, style, videoDuration, narrationLanguage );
        const content = JSON.stringify(projectJson, null, 2);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedStory.title.replace(/\s+/g, '_')}_project.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const resetApp = () => {
        setStep(AppStep.STORY_IDEAS);
        setGeneratedStories([]);
        setSelectedStoryId(null);
        setCharacters([]);
        setScript(null);
    }
    
    if (!hasApiKey) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-center p-4">
                <h1 className="text-3xl font-bold text-amber-400 mb-4">Chào mừng đến với Trình tạo kịch bản video</h1>
                <p className="text-slate-300 max-w-xl mb-8">
                    Ứng dụng này sử dụng các mô hình AI tiên tiến của Google. Để bắt đầu, bạn cần chọn một API key từ dự án Google AI Studio của mình.
                </p>
                <button
                    onClick={handleSelectKey}
                    className="bg-amber-500 text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-amber-400 transition-transform transform hover:scale-105"
                >
                    Chọn API Key để bắt đầu
                </button>
                 <p className="text-xs text-slate-500 mt-6 max-w-xl">
                    Việc sử dụng API tạo ảnh (Imagen) có thể yêu cầu tài khoản của bạn phải được bật tính năng thanh toán.
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline text-amber-500 hover:text-amber-400 ml-1">
                        Tìm hiểu thêm
                    </a>
                </p>
            </div>
        );
    }

    const renderStep = () => {
        switch (step) {
            case AppStep.STORY_IDEAS:
                return (
                    <div>
                        <div className="bg-slate-800 p-8 rounded-lg shadow-2xl space-y-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Bước 1: Tạo ý tưởng câu chuyện</h2>
                            <div className="space-y-2">
                                <label htmlFor="story-idea" className="block text-sm font-medium text-slate-300">Nhập thể loại hoặc ý tưởng câu chuyện</label>
                                <textarea id="story-idea" value={storyIdea} onChange={(e) => setStoryIdea(e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500 placeholder-slate-400" placeholder="Ví dụ: một con quái vật khổng lồ tấn công thành phố, một bộ phim tài liệu về động vật hoang dã..." />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="style" className="block text-sm font-medium text-slate-300">Phong cách hình ảnh</label>
                                    <select id="style" value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500">
                                        {VISUAL_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="narration-language" className="block text-sm font-medium text-slate-300">Ngôn ngữ lời dẫn</label>
                                    <select id="narration-language" value={narrationLanguage} onChange={(e) => setNarrationLanguage(e.target.value)} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500">
                                        {NARRATION_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="num-stories" className="block text-sm font-medium text-slate-300">Số lượng ý tưởng</label>
                                    <input type="number" id="num-stories" value={numStories} onChange={(e) => setNumStories(parseInt(e.target.value, 10))} min="1" max="5" className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500" />
                                </div>
                            </div>
                            <button onClick={handleGenerateStories} disabled={!storyIdea} className="w-full bg-amber-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-amber-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition">Tạo ý tưởng</button>
                        </div>

                        {generatedStories.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-xl font-bold mb-4">Chọn một câu chuyện để tiếp tục:</h3>
                                <div className="space-y-4">
                                    {generatedStories.map(story => (
                                        <div key={story.id} onClick={() => setSelectedStoryId(story.id)} className={`bg-slate-800 p-4 rounded-lg cursor-pointer border-2 transition ${selectedStoryId === story.id ? 'border-amber-500 bg-slate-700' : 'border-transparent hover:border-slate-600'}`}>
                                            <h4 className="font-bold text-amber-400">{story.title}</h4>
                                            <p className="text-sm text-slate-300 mt-1">{story.summary}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 bg-slate-800 p-6 rounded-lg shadow-lg flex items-center gap-6">
                                    <div>
                                        <label htmlFor="num-characters" className="block text-sm font-medium text-slate-300">Số lượng nhân vật chính</label>
                                        <input type="number" id="num-characters" value={numCharacters} onChange={(e) => setNumCharacters(parseInt(e.target.value, 10))} min="1" max="4" className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500" />
                                    </div>
                                    <button onClick={handleCreateCharacter} disabled={selectedStoryId === null} className="self-end w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition">Tiếp tục: Tạo nhân vật</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case AppStep.CHARACTER_CREATION:
                 return (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-6">Bước 2: Tinh chỉnh nhân vật</h2>
                        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${numCharacters > 2 ? numCharacters : 2} gap-6 mb-6`}>
                           {characters.map(character => (
                                <CharacterCard 
                                    key={character.id} 
                                    character={character} 
                                    onNameChange={(id, value) => handleCharacterChange(id, 'name', value)}
                                    onPromptChange={(id, value) => handleCharacterChange(id, 'prompt', value)}
                                    onGenerateImage={handleGenerateImage}
                                    onDownloadImage={handleDownloadImage}
                                />
                            ))}
                        </div>
                        <div className="bg-slate-800 p-6 rounded-lg shadow-lg flex items-center gap-6">
                            <div>
                                <label htmlFor="video-duration" className="block text-sm font-medium text-slate-300">Thời lượng video (giây)</label>
                                <input type="number" id="video-duration" value={videoDuration} onChange={(e) => setVideoDuration(parseInt(e.target.value, 10))} step="10" min="10" className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500" />
                            </div>
                            <button onClick={handleGenerateScript} className="self-end w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-500 transition">Tiếp tục: Viết kịch bản</button>
                        </div>
                        <button onClick={() => setStep(AppStep.STORY_IDEAS)} className="mt-6 flex items-center text-slate-400 hover:text-white transition"><BackIcon /> Quay lại</button>
                    </div>
                );
            case AppStep.SCRIPT_DISPLAY:
                 const CopyButton = ({ textToCopy }: { textToCopy: string }) => {
                    const [copied, setCopied] = useState(false);
                    const handleCopy = () => {
                        navigator.clipboard.writeText(textToCopy);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    };
                    return (
                        <button onClick={handleCopy} className="text-slate-400 hover:text-white transition" title="Sao chép">
                            {copied ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                            )}
                        </button>
                    );
                };

                return (
                    <div>
                        <h2 className="text-3xl font-bold text-amber-400 mb-2">{generatedStories.find(s => s.id === selectedStoryId)?.title}</h2>
                        <p className="text-slate-300 mb-6 italic">{script?.summary}</p>
                        
                        <div className="flex flex-wrap gap-4 mb-8 p-4 bg-slate-800/80 backdrop-blur-sm rounded-lg sticky top-4 z-10 border border-slate-700">
                            <button onClick={downloadPrompts} className="bg-amber-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-amber-400 transition flex items-center"><DownloadIcon /> Tải Prompts</button>
                            <button onClick={downloadNarration} className="bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 transition flex items-center"><DownloadIcon /> Tải lời dẫn</button>
                            <button onClick={downloadJson} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-500 transition flex items-center"><DownloadIcon /> Tải JSON</button>
                            <button onClick={resetApp} className="ml-auto bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition flex items-center"><CreateNewIcon /> Tạo kịch bản mới</button>
                        </div>

                        <div className="space-y-6">
                            {script?.scenes.map(scene => (
                                <div key={scene.id} className="bg-slate-800 p-6 rounded-lg shadow-lg">
                                    <h3 className="font-bold text-xl text-amber-400 mb-4 border-b border-slate-700 pb-2">Cảnh {scene.id}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                        <div className="md:col-span-3 space-y-4">
                                            <div>
                                                <h4 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">Mô tả</h4>
                                                <p className="text-slate-200 mt-1">{scene.description}</p>
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">Lời dẫn</h4>
                                                    <CopyButton textToCopy={scene.narration} />
                                                </div>
                                                <p className="text-slate-200 mt-1 italic">"{scene.narration}"</p>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 bg-slate-900 p-4 rounded-md">
                                             <div className="flex justify-between items-center mb-2">
                                                 <h4 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">Prompt Video</h4>
                                                 <CopyButton textToCopy={scene.veo_prompt} />
                                             </div>
                                            <p className="text-sm font-mono text-amber-300 break-words">{scene.veo_prompt}</p>
                                            <div className="mt-4 border-t border-slate-700 pt-3">
                                                <h4 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">Nhân vật</h4>
                                                <p className="text-sm text-slate-300 mt-1">{scene.characters_present.join(', ') || 'Không có'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
        }
    };
    
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8">
            {isLoading && <Loader message={loadingMessage} />}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-amber-400">Trình tạo kịch bản video. Liên hệ: 0916590161</h1>
                { hasApiKey && <button onClick={handleSelectKey} className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg transition">
                    Quản lý API Key
                </button>}
            </header>
            <main>
                {renderStep()}
            </main>
        </div>
    );
}

export default App;
