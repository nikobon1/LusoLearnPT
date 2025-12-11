import React, { useRef } from 'react';
import { CloudIcon, DownloadIcon, UploadIcon, XIcon } from './Icons';

interface SyncModalProps {
    onClose: () => void;
    onExport: () => void;
    onImport: (file: File) => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ onClose, onExport, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onImport(file);
    };

    return (
        <div className="absolute inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200 relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CloudIcon className="w-5 h-5 text-emerald-600" />
                        Синхронизация
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XIcon className="w-5 h-5" /></button>
                </div>
                
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    Ваши данные хранятся только в этом браузере. Чтобы перенести прогресс на другое устройство, скачайте резервную копию и загрузите её там.
                </p>

                <div className="space-y-3">
                    <button 
                        onClick={onExport}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                    >
                        <DownloadIcon className="w-5 h-5 text-emerald-600" />
                        Скачать резервную копию
                    </button>

                    <div className="relative">
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
                        >
                            <UploadIcon className="w-5 h-5" />
                            Восстановить из копии
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept=".json" 
                            className="hidden" 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyncModal;
