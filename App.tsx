import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, UserProfile, ViewState, Folder } from './types';
import { HomeIcon, PlusIcon, BrainIcon, TrophyIcon, FolderIcon, TagIcon, EditIcon, ShuffleIcon, CloudIcon, SparklesIcon, LoaderIcon, FilterIcon } from './components/Icons';
import FlashcardView from './components/FlashcardView';
import Creator from './components/Creator';
import { suggestSmartSorting, SmartSortSuggestion } from './services/geminiService';
import { simpleHash, normalizeFrequency, getFrequencyWeight } from './utils/helpers';
import { INITIAL_USER, DEFAULT_FOLDER } from './constants';
import WordListModal from './components/WordListModal';
import StudyConfigModal from './components/StudyConfigModal';
import StatsWidget from './components/StatsWidget';
import SyncModal from './components/SyncModal';
import SmartSortModal from './components/SmartSortModal';
import FolderEditModal from './components/FolderEditModal';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.Dashboard);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [folders, setFolders] = useState<Folder[]>([DEFAULT_FOLDER]);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [loading, setLoading] = useState(true);

  // Filters & Session
  const [activeFolderId, setActiveFolderId] = useState<string>(folders[0].id);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0); // Seed for stable shuffle

  const [sessionReviewedIds, setSessionReviewedIds] = useState<Set<string>>(new Set());
  const [listModalConfig, setListModalConfig] = useState<{ title: string; filter: 'learned' | 'learning' } | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Smart Sort State
  const [showSortModal, setShowSortModal] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [sortSuggestions, setSortSuggestions] = useState<SmartSortSuggestion[]>([]);
  const [selectedSortItems, setSelectedSortItems] = useState<Set<string>>(new Set());

  // Management
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [specificStudyCardId, setSpecificStudyCardId] = useState<string | null>(null);

  // Study Config
  const [showStudyConfig, setShowStudyConfig] = useState(false);
  const [studyMode, setStudyMode] = useState<'srs' | 'frequency'>('srs');
  const [frequencyFilters, setFrequencyFilters] = useState<Set<string>>(new Set());

  // Persistence
  useEffect(() => {
    const savedCards = localStorage.getItem('luso_cards');
    const savedUser = localStorage.getItem('luso_user');
    const savedFolders = localStorage.getItem('luso_folders');

    if (savedCards) {
        try {
            const parsedCards = JSON.parse(savedCards).map((c: any) => ({
                ...c,
                folderIds: c.folderIds || (c.folderId ? [c.folderId] : ['default']),
                interval: c.interval ?? 0,
                easeFactor: c.easeFactor ?? 2.5
            }));
            setCards(parsedCards);
        } catch (e) {
            console.error("Failed to parse cards", e);
        }
    }
    if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch(e) { console.error(e); }
    }
    if (savedFolders) {
        try { setFolders(JSON.parse(savedFolders)); } catch(e) { console.error(e); }
    } else {
        setFolders([DEFAULT_FOLDER]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('luso_cards', JSON.stringify(cards));
      localStorage.setItem('luso_user', JSON.stringify(user));
      localStorage.setItem('luso_folders', JSON.stringify(folders));
    }
  }, [cards, user, folders, loading]);

  const navigateToDashboard = () => {
      setSessionReviewedIds(new Set()); // Clear session history so all cards are available again
      setSpecificStudyCardId(null);
      setView(ViewState.Dashboard);
  };

  const toggleShuffle = () => {
      const newState = !isShuffled;
      setIsShuffled(newState);
      if (newState) {
          setShuffleSeed(Math.random()); // New seed = new order
      }
  };

  const handleStudySingleCard = (cardId: string) => {
      setSpecificStudyCardId(cardId);
      const newSession = new Set(sessionReviewedIds);
      newSession.delete(cardId);
      setSessionReviewedIds(newSession);
      setView(ViewState.Study);
  };

  const handleStartStudy = (mode: 'srs' | 'frequency', filters: Set<string>) => {
      setStudyMode(mode);
      setFrequencyFilters(filters);
      setSessionReviewedIds(new Set());
      setSpecificStudyCardId(null);
      setShowStudyConfig(false);
      setView(ViewState.Study);
  };

  const handleAutoSort = async () => {
      if (activeFolderId !== 'default') return;
      
      setIsSorting(true);
      try {
          const cardsToSort = cards.filter(c => c.folderIds.includes('default'));
          const suggestions = await suggestSmartSorting(cardsToSort, folders);
          
          if (suggestions.length > 0) {
              setSortSuggestions(suggestions);
              const allIds = new Set<string>();
              suggestions.forEach(grp => grp.cardIds.forEach(id => allIds.add(id)));
              setSelectedSortItems(allIds);
              setShowSortModal(true);
          } else {
              alert('Не удалось найти подходящие папки для слов. Попробуйте создать больше тематических папок.');
          }
      } catch (err) {
          console.error("Sorting error", err);
          alert('Ошибка при сортировке. Проверьте соединение.');
      } finally {
          setIsSorting(false);
      }
  };

  const confirmAutoSort = () => {
      const updates = new Map<string, string[]>();
      const newFoldersList = [...folders];
      let foldersCreatedCount = 0;
      
      sortSuggestions.forEach(grp => {
          let targetId = grp.targetFolderId;
          if (grp.action === 'create' && targetId === 'NEW_FOLDER' && grp.suggestedFolderName) {
              const existingNew = newFoldersList.find(f => f.name === grp.suggestedFolderName);
              if (existingNew) {
                  targetId = existingNew.id;
              } else {
                  const newId = Math.random().toString(36).substr(2,9);
                  newFoldersList.push({ id: newId, name: grp.suggestedFolderName });
                  targetId = newId;
                  foldersCreatedCount++;
              }
          }
          grp.cardIds.forEach(cardId => {
              if (selectedSortItems.has(cardId)) {
                   updates.set(cardId, [targetId]); 
              }
          });
      });

      if (foldersCreatedCount > 0) {
          setFolders(newFoldersList);
      }

      if (updates.size > 0) {
          setCards(prev => prev.map(c => {
              if (updates.has(c.id)) {
                  return { ...c, folderIds: updates.get(c.id)! };
              }
              return c;
          }));
          alert(`Перемещено ${updates.size} слов. Создано папок: ${foldersCreatedCount}.`);
      }
      setShowSortModal(false);
  };

  const toggleSortSelection = (id: string) => {
      const newSet = new Set(selectedSortItems);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedSortItems(newSet);
  };

  const handleExportData = () => {
      const data = {
          cards,
          user,
          folders,
          version: 1,
          date: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lusolearn_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportData = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = JSON.parse(e.target?.result as string);
              if (data.cards && data.user && data.folders) {
                  if (confirm('Это действие заменит текущие данные. Вы уверены?')) {
                      setCards(data.cards);
                      setUser(data.user);
                      setFolders(data.folders);
                      alert('Данные успешно восстановлены!');
                      setShowSyncModal(false);
                      window.location.reload();
                  }
              } else {
                  alert('Неверный формат файла резервной копии.');
              }
          } catch (err) {
              console.error(err);
              alert('Ошибка при чтении файла.');
          }
      };
      reader.readAsText(file);
  };

  const dueCards = useMemo(() => {
    // 1. Single card study override
    if (specificStudyCardId) {
        const card = cards.find(c => c.id === specificStudyCardId);
        return card ? [card] : [];
    }

    // 2. Frequency Mode
    if (studyMode === 'frequency') {
        let pool = cards.filter(c => !sessionReviewedIds.has(c.id));
        
        // Filter by Folder (Consistency with dashboard)
        if (activeFolderId !== 'all') {
            pool = pool.filter(c => c.folderIds.includes(activeFolderId));
        }

        // Filter by selected buckets with normalization
        pool = pool.filter(c => {
             const norm = normalizeFrequency(c.frequency);
             return frequencyFilters.has(norm);
        });

        // Sort by frequency weight (Ascending: 1 -> 5)
        return pool.sort((a, b) => {
            const wA = getFrequencyWeight(normalizeFrequency(a.frequency));
            const wB = getFrequencyWeight(normalizeFrequency(b.frequency));
            return wA - wB;
        });
    }

    // 3. Default SRS Mode
    let filtered = cards.filter(c => !sessionReviewedIds.has(c.id));
    
    // Filter by folder
    if (activeFolderId !== 'all') {
        filtered = filtered.filter(c => c.folderIds.includes(activeFolderId));
    }

    if (isShuffled) {
        return filtered.sort((a, b) => simpleHash(a.id + shuffleSeed) - simpleHash(b.id + shuffleSeed));
    } else {
        return filtered.sort((a, b) => {
            const dateDiff = (a.nextReviewDate || 0) - (b.nextReviewDate || 0);
            if (dateDiff !== 0) return dateDiff;
            return a.id.localeCompare(b.id);
        });
    }
  }, [cards, activeFolderId, sessionReviewedIds, isShuffled, shuffleSeed, specificStudyCardId, studyMode, frequencyFilters]);

  const filteredAllCards = useMemo(() => {
      if (activeFolderId === 'all') return cards;
      return cards.filter(c => c.folderIds.includes(activeFolderId));
  }, [cards, activeFolderId]);

  const handleCardResult = (success: boolean) => {
    const currentCard = dueCards[0];
    if (!currentCard) return;

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    let nextInterval = currentCard.interval || 0;
    let nextEase = currentCard.easeFactor || 2.5;
    let nextReviewDate = now;
    let newUserState = { ...user };

    if (success) {
        if (nextInterval === 0) {
            nextInterval = 1;
        } else if (nextInterval === 1) {
            nextInterval = 6;
        } else {
            nextInterval = Math.round(nextInterval * nextEase);
        }
        nextEase = Math.min(nextEase + 0.1, 2.5); 
        nextReviewDate = now + (nextInterval * oneDay);
        newUserState.xp = (newUserState.xp || 0) + 10;
        newUserState.cardsLearned = (newUserState.cardsLearned || 0) + 1;
        
        const today = new Date().toISOString().split('T')[0];
        newUserState.learningHistory = {
            ...(newUserState.learningHistory || {}),
            [today]: ((newUserState.learningHistory || {})[today] || 0) + 1
        };

        const calculatedLevel = Math.floor(newUserState.xp / 500) + 1;
        if (calculatedLevel > newUserState.level) {
            newUserState.level = calculatedLevel;
        }
        setUser(newUserState);
    } else {
        nextInterval = 0; 
        nextEase = Math.max(nextEase - 0.2, 1.3); 
        nextReviewDate = now + (1 * 60 * 1000); 
        setUser(prev => ({ ...prev, xp: (prev.xp || 0) + 2 }));
    }

    const updatedCard = { 
        ...currentCard, 
        nextReviewDate: nextReviewDate,
        interval: nextInterval,
        easeFactor: nextEase
    };

    setCards(prev => prev.map(c => c.id === currentCard.id ? updatedCard : c));

    if (specificStudyCardId) {
        setSpecificStudyCardId(null);
        setView(ViewState.Dashboard);
        return;
    }
    setSessionReviewedIds(prev => new Set(prev).add(currentCard.id));
  };

  const handleUpdateCard = (updatedCard: Flashcard) => {
      setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
  };

  const handleNewCards = (newCards: Flashcard[]) => {
    setCards(prev => [...newCards, ...prev]);
    setUser(prev => ({ ...prev, xp: (prev.xp || 0) + (newCards.length * 20) })); 
    navigateToDashboard();
  };

  const handleCreateFolder = () => {
      if (newFolderName.trim()) {
          setFolders(prev => [...prev, { id: Math.random().toString(36).substr(2,9), name: newFolderName }]);
          setNewFolderName('');
          setShowNewFolderInput(false);
      }
  };

  const handleToggleFolder = (folderId: string) => {
      if (editingCardId) {
          setCards(prev => prev.map(c => {
              if (c.id !== editingCardId) return c;
              const newIds = new Set(c.folderIds);
              if (newIds.has(folderId)) {
                  newIds.delete(folderId);
              } else {
                  newIds.add(folderId);
              }
              return { ...c, folderIds: Array.from(newIds) };
          }));
      }
  };

  const handleDeleteCard = () => {
      if (editingCardId) {
          if(confirm('Вы уверены, что хотите удалить эту карточку?')) {
            setCards(prev => prev.filter(c => c.id !== editingCardId));
          }
          setEditingCardId(null);
      }
  };

  const getFilteredListForModal = () => {
      if (!listModalConfig) return [];
      if (listModalConfig.filter === 'learned') {
          return cards.filter(c => c.interval > 0);
      } else {
          return cards.filter(c => c.interval === 0);
      }
  };

  // Render Helper for Frequency Badge
  const renderFrequencyBadge = (card: Flashcard) => {
      // Use normalizeFrequency to ensure consistent display
      const normalizedFreq = normalizeFrequency(card.frequency);

      const badges: Record<string, { color: string; label: string }> = {
          "Top 500": { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "🔥 Топ 500" },
          "Top 1000": { color: "bg-teal-50 text-teal-700 border-teal-100", label: "⚡ Топ 1000" },
          "Top 3000": { color: "bg-blue-50 text-blue-700 border-blue-100", label: "🔹 Топ 3000" },
          "Top 5000": { color: "bg-indigo-50 text-indigo-700 border-indigo-100", label: "📚 Топ 5000" },
          "10000+":   { color: "bg-slate-100 text-slate-500 border-slate-200", label: "🎓 10000+" }
      };

      const badge = badges[normalizedFreq] || badges["10000+"];
      return (
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${badge.color} font-bold`}>
              {badge.label}
          </span>
      );
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="text-emerald-600 font-bold text-xl">Загрузка LusoLearn...</div></div>;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 z-30 flex-shrink-0">
        <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <BrainIcon className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight serif">LusoLearn</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
            <button 
                onClick={() => navigateToDashboard()}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === ViewState.Dashboard ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <HomeIcon className="w-5 h-5" />
                Главная
            </button>
            <button 
                onClick={() => setView(ViewState.Create)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === ViewState.Create ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <PlusIcon className="w-5 h-5" />
                Создать
            </button>
            <button 
                onClick={() => handleStartStudy('srs', new Set())} // Default quick start
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === ViewState.Study ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <TrophyIcon className="w-5 h-5" />
                Учить
            </button>
            <button 
                onClick={() => setShowSyncModal(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 transition-all"
            >
                <CloudIcon className="w-5 h-5" />
                Синхронизация
            </button>
        </nav>
        <div className="p-6 border-t border-slate-100">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Ваш уровень</p>
                <p className="text-sm font-bold text-slate-800">Уровень {user.level}</p>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(((user.xp % 500) / 500) * 100, 100)}%` }}></div>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {view === ViewState.Dashboard && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8 flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 serif mb-1">Привет, Студент</h1>
                            <p className="text-slate-500">Готовы учить португальский?</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setShowSyncModal(true)} className="md:hidden p-2 bg-slate-100 rounded-xl text-slate-600">
                                 <CloudIcon className="w-6 h-6" />
                             </button>
                             <button 
                                 onClick={() => setView(ViewState.Create)}
                                 className="hidden md:flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Добавить слова
                            </button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 space-y-6">
                            <StatsWidget 
                                cards={cards} 
                                user={user} 
                                onOpenList={(type) => setListModalConfig({ 
                                    title: type === 'learned' ? 'Выучено' : 'На изучении', 
                                    filter: type 
                                })} 
                            />

                            <div className="hidden md:grid grid-cols-2 gap-4">
                                <div 
                                    onClick={() => handleStartStudy('srs', new Set())}
                                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group relative"
                                >
                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
                                        <BrainIcon className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-slate-800">Учить</h3>
                                    <p className="text-sm text-slate-500">{dueCards.length} доступно</p>
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowStudyConfig(true); }}
                                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                    >
                                        <FilterIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div 
                                    onClick={() => setView(ViewState.Create)}
                                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-3 group-hover:scale-110 transition-transform">
                                        <PlusIcon className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-slate-800">Добавить</h3>
                                    <p className="text-sm text-slate-500">Текст или Фото</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <FolderIcon className="w-5 h-5 text-emerald-600"/>
                                        Папки
                                    </h3>
                                    <button 
                                        onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                {showNewFolderInput && (
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            value={newFolderName}
                                            onChange={e => setNewFolderName(e.target.value)}
                                            placeholder="Имя папки..."
                                            className="flex-1 p-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                        <button onClick={handleCreateFolder} className="px-3 bg-emerald-600 text-white rounded-lg text-sm font-bold">OK</button>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => setActiveFolderId('all')}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${activeFolderId === 'all' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                                    >
                                        Все
                                    </button>
                                    {folders.map(f => (
                                         <button 
                                            key={f.id}
                                            onClick={() => setActiveFolderId(f.id)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all max-w-full truncate ${activeFolderId === f.id ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                                        >
                                            {f.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-8">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-140px)] md:h-auto md:min-h-[600px]">
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
                                     <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <span>Мои слова ({filteredAllCards.length})</span>
                                        {activeFolderId !== 'all' && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded hidden sm:inline-block">{folders.find(f => f.id === activeFolderId)?.name}</span>}
                                    </h3>
                                    <div className="flex gap-2">
                                        {activeFolderId === 'default' && folders.length > 0 && (
                                            <button
                                                onClick={handleAutoSort}
                                                disabled={isSorting}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                                            >
                                                {isSorting ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                                                Сортировать
                                            </button>
                                        )}
                                        <button 
                                            onClick={toggleShuffle}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${isShuffled ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}
                                        >
                                            <ShuffleIcon className="w-3 h-3" />
                                            {isShuffled ? 'Случайно' : 'По дате'}
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 overflow-y-auto flex-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {filteredAllCards.slice(0, 50).map(card => {
                                             const cardFolders = folders.filter(f => card.folderIds.includes(f.id));
                                             const term = card.originalTerm || 'Без названия';

                                             return (
                                                <div 
                                                    key={card.id} 
                                                    onClick={() => handleStudySingleCard(card.id)}
                                                    className="flex flex-col p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all relative cursor-pointer group h-full"
                                                >
                                                    <div className="flex items-start gap-3 mb-2 pr-6">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                                                            {card.imageUrl ? (
                                                                <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400 bg-slate-200">
                                                                    {term.slice(0,2).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <p className="font-semibold text-slate-800 truncate text-sm leading-tight mb-0.5">{term}</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                                {renderFrequencyBadge(card)}
                                                            </div>
                                                            <p className="text-xs text-slate-500 line-clamp-1 mt-1">{card.translation}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-auto flex items-center gap-1 overflow-hidden pt-2 border-t border-slate-50">
                                                         {cardFolders.length > 0 && (
                                                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-1 max-w-[45%] truncate">
                                                                <FolderIcon className="w-2.5 h-2.5"/>
                                                                {cardFolders[0].name}
                                                                {cardFolders.length > 1 && ` +${cardFolders.length - 1}`}
                                                            </span>
                                                         )}
                                                         {card.tags && card.tags.length > 0 && (
                                                            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded flex items-center gap-1 max-w-[45%] truncate border border-emerald-100">
                                                                <TagIcon className="w-2.5 h-2.5" />
                                                                {card.tags[0]}
                                                            </span>
                                                         )}
                                                    </div>

                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setEditingCardId(card.id); }}
                                                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded opacity-0 group-hover:opacity-100 transition-opacity md:block hidden"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setEditingCardId(card.id); }}
                                                        className="absolute top-2 right-2 p-1 text-slate-300 md:hidden"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {filteredAllCards.length === 0 && (
                                        <div className="text-center py-10">
                                            <p className="text-slate-400 mb-2">В этой папке пока нет карточек.</p>
                                            <button onClick={() => setView(ViewState.Create)} className="text-emerald-600 font-bold text-sm hover:underline">Добавить первое слово</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                     <div className="md:hidden grid grid-cols-2 gap-4 mt-6 mb-20">
                        <div 
                            onClick={() => handleStartStudy('srs', new Set())}
                            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer relative"
                        >
                            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-3">
                                <BrainIcon />
                            </div>
                            <h3 className="font-bold text-slate-800">Учить</h3>
                            <p className="text-sm text-slate-500">{dueCards.length} доступно</p>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowStudyConfig(true); }}
                                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-blue-600"
                            >
                                <FilterIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div 
                            onClick={() => setView(ViewState.Create)}
                            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer"
                        >
                             <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mb-3">
                                <PlusIcon />
                            </div>
                            <h3 className="font-bold text-slate-800">Добавить</h3>
                            <p className="text-sm text-slate-500">Текст или Фото</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {view === ViewState.Study && (
            <div className="h-full flex items-center justify-center p-4 bg-slate-100/50">
                <div className="w-full max-w-md md:max-w-lg lg:max-w-xl h-full md:h-auto md:aspect-[3/4] md:max-h-[85vh]">
                    {dueCards.length > 0 ? (
                        <FlashcardView 
                            card={dueCards[0]} 
                            onResult={handleCardResult} 
                            onBack={navigateToDashboard}
                            onUpdate={handleUpdateCard}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center relative bg-white rounded-3xl shadow-xl border border-slate-200 md:h-96 md:w-96 md:mx-auto">
                            <button 
                                onClick={navigateToDashboard}
                                className="absolute top-6 left-6 text-slate-400 hover:text-slate-600"
                            >
                                <HomeIcon className="w-6 h-6" />
                            </button>
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
                                <TrophyIcon className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Сессия завершена!</h2>
                            <p className="text-slate-500 mb-8 max-w-xs">
                                Вы повторили все карты в этой сессии. Отдохните или начните заново.
                            </p>
                            <button onClick={navigateToDashboard} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors">На главную</button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === ViewState.Create && (
            <div className="h-full overflow-y-auto bg-slate-50 p-0 md:p-8 flex items-center justify-center">
                 <div className="w-full h-full md:h-[80vh] md:max-w-3xl bg-white md:rounded-2xl md:shadow-2xl md:border border-slate-200 overflow-hidden flex flex-col">
                    <Creator 
                        onCardsCreated={handleNewCards} 
                        onCancel={() => setView(ViewState.Dashboard)} 
                        folders={folders}
                    />
                 </div>
            </div>
        )}

        {view === ViewState.Dashboard && (
            <nav className="md:hidden absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur border-t border-slate-200 px-6 py-4 flex justify-between items-center z-50">
                <button onClick={navigateToDashboard} className="flex flex-col items-center text-emerald-600">
                    <HomeIcon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Главная</span>
                </button>
                <button onClick={() => setView(ViewState.Create)} className="flex flex-col items-center text-slate-400 hover:text-emerald-600 transition-colors">
                    <div className="w-12 h-12 -mt-8 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-200 flex items-center justify-center transform transition-transform active:scale-95 border-4 border-slate-50">
                        <PlusIcon className="w-6 h-6" />
                    </div>
                </button>
                <button className="flex flex-col items-center text-slate-400 hover:text-emerald-600 transition-colors">
                    <TrophyIcon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Профиль</span>
                </button>
            </nav>
        )}

      </main>

      {listModalConfig && view !== ViewState.Study && (
          <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm">
               <WordListModal 
                 title={listModalConfig.title} 
                 cards={getFilteredListForModal()} 
                 onClose={() => setListModalConfig(null)} 
                 onCardClick={handleStudySingleCard}
               />
          </div>
      )}

      {showSyncModal && (
          <SyncModal 
            onClose={() => setShowSyncModal(false)}
            onExport={handleExportData}
            onImport={handleImportData}
          />
      )}

      {showStudyConfig && (
          <StudyConfigModal 
            onClose={() => setShowStudyConfig(false)}
            onStart={handleStartStudy}
          />
      )}

      {showSortModal && (
        <SmartSortModal
            onClose={() => setShowSortModal(false)}
            onConfirm={confirmAutoSort}
            suggestions={sortSuggestions}
            folders={folders}
            cards={cards}
            selectedItems={selectedSortItems}
            onToggleItem={toggleSortSelection}
        />
      )}

      {editingCardId && (
          <FolderEditModal 
            cardId={editingCardId}
            cards={cards}
            folders={folders}
            onToggleFolder={handleToggleFolder}
            onDelete={handleDeleteCard}
            onClose={() => setEditingCardId(null)}
          />
      )}

    </div>
  );
};

export default App;
