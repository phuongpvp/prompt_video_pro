export interface Story {
  id: number;
  title: string;
  summary: string;
}

export interface Character {
  id: number;
  name: string;
  prompt: string;
  imageUrl: string | null;
  imageMimeType: string | null;
  isLoadingImage: boolean;
  error: string | null;
}

export interface Scene {
  id: number;
  description: string;
  narration: string;
  veo_prompt: string;
  characters_present: string[];
}

export interface Script {
  summary: string;
  scenes: Scene[];
}

export enum AppStep {
  STORY_IDEAS = 1,
  CHARACTER_CREATION = 2,
  SCRIPT_DISPLAY = 3,
}