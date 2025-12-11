import React from 'react';
import { Flashcard, Folder } from '../types';
import { FolderIcon, TrashIcon } from './Icons';

interface FolderEditModalProps {
    cardId: string | null;
    cards: Flashcard[];
    folders: Folder[];
    onToggleFolder: (folderId: string) => void;
    onDelete: () => void;
    onClose: () => void;
}

const FolderEditModal: React.FC<FolderEditModalProps> = ({ 
    cardId, 
    cards, 
    folders, 
    onToggleFolder, 
    onDelete, 
    onClose 
}) => {
    if (!cardId) return null;

    return (
          <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Редактирование папок</h3>
                  <p className="text-sm text-slate-500 mb-4">Выберите папки для карточки:</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-6 max-h-60 overflow-y-auto">
                      {folders.map(f => {
                          const card = cards.find(c => c.id === cardId);
                          const isSelected = card?.folderIds.includes(f.id);
                          return (
                              <button 
                                key={f.id}
                                onClick={() => onToggleFolder(f.id)}
                                className={`p-3 rounded-xl border text-sm font-medium text-left flex items-center gap-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                              >
                                  <FolderIcon className={`w-4 h-4 ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
                                  <span className="truncate">{f.name}</span>
                              </button>
                          );
                      })}
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                      <button 
                        onClick={onDelete}
                        className="text-rose-500 text-sm font-bold flex items-center gap-1 hover:text-rose-700"
                      >
                          <TrashIcon className="w-4 h-4" />
                          Удалить
                      </button>
                      <button 
                        onClick={onClose}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                      >
                          Готово
                      </button>
                  </div>
              </div>
          </div>
    );
};

export default FolderEditModal;
