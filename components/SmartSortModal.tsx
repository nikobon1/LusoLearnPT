import React from 'react';
import { SmartSortSuggestion } from '../services/geminiService';
import { Flashcard, Folder } from '../types';
import { SparklesIcon, XIcon, PlusIcon, FolderIcon } from './Icons';

interface SmartSortModalProps {
    onClose: () => void;
    onConfirm: () => void;
    suggestions: SmartSortSuggestion[];
    folders: Folder[];
    cards: Flashcard[];
    selectedItems: Set<string>;
    onToggleItem: (id: string) => void;
}

const SmartSortModal: React.FC<SmartSortModalProps> = ({ 
    onClose, 
    onConfirm, 
    suggestions, 
    folders, 
    cards, 
    selectedItems, 
    onToggleItem 
}) => {
    return (
        <div className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                   <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-indigo-600" />
                            Умная сортировка
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XIcon className="w-5 h-5" /></button>
                    </div>
                    
                    <p className="text-sm text-slate-500 mb-4">
                        ИИ предлагает переместить следующие слова из папки "Общее". Снимите галочки со слов, которые хотите оставить.
                    </p>

                    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                        {suggestions.map((group, idx) => {
                            const isNewFolder = group.action === 'create';
                            const folderName = isNewFolder ? (group.suggestedFolderName || 'Новая папка') : (folders.find(f => f.id === group.targetFolderId)?.name || 'Unknown');
                            const groupCards = cards.filter(c => group.cardIds.includes(c.id));
                            
                            if (groupCards.length === 0) return null;

                            return (
                                <div key={group.targetFolderId === 'NEW_FOLDER' ? `new-${idx}` : group.targetFolderId}>
                                    <div className={`flex items-center gap-2 mb-2 font-bold px-3 py-1.5 rounded-lg w-fit ${isNewFolder ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700'}`}>
                                        {isNewFolder ? <PlusIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />}
                                        {folderName}
                                        {isNewFolder && <span className="text-[9px] uppercase bg-emerald-600 text-white px-1.5 rounded ml-2">Новая</span>}
                                    </div>
                                    <div className={`space-y-1 pl-2 border-l-2 ${isNewFolder ? 'border-emerald-100' : 'border-indigo-100'}`}>
                                        {groupCards.map(card => (
                                            <div 
                                                key={card.id} 
                                                onClick={() => onToggleItem(card.id)}
                                                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer"
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedItems.has(card.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                                    {selectedItems.has(card.id) && <PlusIcon className="w-3 h-3 rotate-45" />}
                                                </div>
                                                <span className="text-slate-800 font-medium">{card.originalTerm}</span>
                                                <span className="text-slate-400 text-xs truncate max-w-[100px]">{card.translation}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
                        <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">
                            Отмена
                        </button>
                        <button 
                            onClick={onConfirm}
                            className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                        >
                            Применить
                        </button>
                    </div>
               </div>
          </div>
    );
};

export default SmartSortModal;
