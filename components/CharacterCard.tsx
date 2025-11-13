import React from 'react';
import { Character } from '../types';

interface CharacterCardProps {
  character: Character;
  onNameChange: (id: number, newName: string) => void;
  onPromptChange: (id: number, newPrompt: string) => void;
  onGenerateImage: (id: number) => void;
  onDownloadImage: (id: number) => void;
}

const CopyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>);
const DownloadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>);
const RegenerateIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm10.707 9.293a1 1 0 01.08.08A7.002 7.002 0 013.4 17.071a1 1 0 111.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a1 1 0 01-.293-.707z" clipRule="evenodd" /></svg>);
const ImageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>);


const CharacterCard: React.FC<CharacterCardProps> = ({ character, onNameChange, onPromptChange, onGenerateImage, onDownloadImage }) => {

    const handleCopy = () => {
        navigator.clipboard.writeText(character.prompt);
    }
    
    const renderError = () => {
        if (!character.error) return null;

        const billingRegex = /\[(.*?)\]\((.*?)\)/;
        const match = character.error.match(billingRegex);

        if (match) {
            const text = character.error.replace(billingRegex, '').trim();
            const linkText = match[1];
            const url = match[2];
            return (
                <div className="text-center text-red-400">
                    {text} <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-amber-400 hover:text-amber-300">{linkText}</a>
                </div>
            );
        }
        return <p className="text-center text-red-400">{character.error}</p>;
    }

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg space-y-4 flex flex-col">
            <div className="aspect-square bg-slate-700 rounded-md flex justify-center items-center relative overflow-hidden">
                {character.isLoadingImage && (
                     <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col justify-center items-center z-10">
                        <div className="w-12 h-12 border-4 border-slate-400 border-t-amber-400 rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-amber-400">Đang tạo ảnh...</p>
                    </div>
                )}
                {character.error && !character.isLoadingImage && (
                    <div className="p-4">{renderError()}</div>
                )}
                {character.imageUrl && !character.isLoadingImage && (
                    <img src={character.imageUrl} alt={character.name} className="w-full h-full object-cover" />
                )}
                {!character.imageUrl && !character.isLoadingImage && !character.error && (
                     <button onClick={() => onGenerateImage(character.id)} className="bg-amber-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-amber-400 transition-transform transform hover:scale-105 flex items-center">
                        <ImageIcon />
                        Tạo ảnh
                    </button>
                )}
                 {character.imageUrl && !character.isLoadingImage && (
                    <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-2">
                        <button onClick={() => onGenerateImage(character.id)} className="bg-slate-900 bg-opacity-70 text-white py-1 px-3 text-sm rounded-md hover:bg-opacity-90 transition flex items-center"><RegenerateIcon /> Tạo lại</button>
                        <button onClick={() => onDownloadImage(character.id)} className="bg-teal-600 bg-opacity-80 text-white py-1 px-3 text-sm rounded-md hover:bg-opacity-100 transition flex items-center"><DownloadIcon /> Tải xuống</button>
                    </div>
                 )}
            </div>

            <div className="flex-grow flex flex-col justify-between">
                <div>
                    <label htmlFor={`char-name-${character.id}`} className="block text-sm font-medium text-slate-300 mb-1">Tên nhân vật {character.id}</label>
                    <input
                        id={`char-name-${character.id}`}
                        type="text"
                        value={character.name}
                        onChange={(e) => onNameChange(character.id, e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
                    />
                </div>
                <div className="mt-4">
                    <label htmlFor={`char-prompt-${character.id}`} className="block text-sm font-medium text-slate-300 mb-1">Mô tả nhân vật {character.id}</label>
                    <div className="relative">
                       <textarea
                            id={`char-prompt-${character.id}`}
                            rows={6}
                            value={character.prompt}
                            onChange={(e) => onPromptChange(character.id, e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500 resize-none"
                        />
                         <button onClick={handleCopy} title="Sao chép prompt" className="absolute top-2 right-2 p-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 transition flex items-center">
                            <CopyIcon />
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterCard;
