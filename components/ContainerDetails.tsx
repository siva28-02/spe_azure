import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { SPEContainer, DriveItem } from '../types';
import { GraphService } from '../services/graphService';
import { Button } from './Button';
import { InputModal, Modal, ConfirmationModal, AlertModal } from './Modal';
import { 
  ChevronLeft, Folder, File as FileIcon, Upload, Loader2, 
  Search, Info, X, Trash2, Edit2, Share2, Plus, ExternalLink, FileText, Image as ImageIcon, MoreVertical, Copy, Check, ChevronRight, Home,
  Download, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

interface ContainerDetailsProps {
  container: SPEContainer;
  graphService: GraphService;
  onBack: () => void;
  isAdmin: boolean;
}

type SortField = 'name' | 'size' | 'lastModifiedDateTime';
type SortDirection = 'asc' | 'desc';

export const ContainerDetails: React.FC<ContainerDetailsProps> = ({ container, graphService, onBack, isAdmin }) => {
  // Data State
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Navigation State
  const [driveId, setDriveId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>([]);

  // Selection & UI State
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null);
  const [showProperties, setShowProperties] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [serverSearchResults, setServerSearchResults] = useState<DriveItem[]>([]);

  // Sort State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Modal State
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState<DriveItem | null>(null);
  
  // Delete Modal State
  const [itemToDelete, setItemToDelete] = useState<DriveItem | null>(null);
  
  // Alert Modal State
  const [alertState, setAlertState] = useState<{isOpen: boolean, title: string, message: string}>({
      isOpen: false, title: "", message: ""
  });
  
  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [itemToShare, setItemToShare] = useState<DriveItem | null>(null);
  const [generatedLink, setGeneratedLink] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- Initialization ---

  const initContainer = useCallback(async () => {
    setLoading(true);
    try {
      const dId = await graphService.getContainerDriveId(container.id);
      console.log(`Initialized Drive ID: ${dId}`);
      setDriveId(dId);
      
      const data = await graphService.getDriveItems(dId, "root");
      setItems(data);
    } catch (err: any) {
      console.error("Failed to init container", err);
      showAlert("Error", `Error loading container: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [container.id, graphService]);

  useEffect(() => {
    initContainer();
  }, [initContainer]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = () => {
        setActiveMenuId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // --- Search Logic ---

  useEffect(() => {
    if (!searchTerm.trim()) {
      setServerSearchResults([]);
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      if (driveId) {
        setIsSearching(true);
        try {
          const results = await graphService.searchDriveItems(driveId, searchTerm);
          setServerSearchResults(results);
        } catch (error) {
          console.error("Search error", error);
        } finally {
          setIsSearching(false);
        }
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, driveId, graphService]);

  // --- Sorting & Display Logic ---

  const displayItems = useMemo(() => {
    let result: DriveItem[] = [];
    if (!searchTerm.trim()) {
        result = [...items];
    } else {
        const localMatches = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        result = [...localMatches];
        const existingIds = new Set(localMatches.map(i => i.id));
        serverSearchResults.forEach(serverItem => {
            if (!existingIds.has(serverItem.id)) {
                result.push(serverItem);
                existingIds.add(serverItem.id);
            }
        });
    }

    result.sort((a, b) => {
        if (a.folder && !b.folder) return -1;
        if (!a.folder && b.folder) return 1;

        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'name') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (sortField === 'lastModifiedDateTime') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
  }, [items, serverSearchResults, searchTerm, sortField, sortDirection]);

  // --- Actions ---

  const showAlert = (title: string, message: string) => {
      setAlertState({ isOpen: true, title, message });
  };

  const ensureDriveId = async (): Promise<string | null> => {
      if (driveId) return driveId;
      try {
          const dId = await graphService.getContainerDriveId(container.id);
          setDriveId(dId);
          return dId;
      } catch (e) {
          showAlert("Connection Error", "Connection Lost. Please refresh.");
          return null;
      }
  };

  const handleNavigateToFolder = async (folderId: string, index: number) => {
    const validDriveId = await ensureDriveId();
    if (!validDriveId) return;

    const newHistory = index === -1 ? [] : folderHistory.slice(0, index + 1);
    
    setLoading(true);
    try {
        const data = await graphService.getDriveItems(validDriveId, folderId);
        setCurrentFolderId(folderId);
        setFolderHistory(newHistory);
        setItems(data);
        setSelectedItem(null);
        setSearchTerm("");
    } catch (err: any) {
        showAlert("Navigation Error", err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    const validDriveId = await ensureDriveId();
    if (!validDriveId) return;

    try {
      const newFolder = await graphService.createFolder(validDriveId, currentFolderId, folderName);
      setItems(prev => [newFolder, ...prev]);
    } catch (err: any) {
        showAlert("Create Error", `Failed to create folder: ${err.message}`);
    }
  };

  // --- FIXED RENAME LOGIC ---
  const handleRename = async (newName: string) => {
    if (!itemToRename) return;
    const validDriveId = await ensureDriveId();
    if (!validDriveId) return;

    let finalName = newName.trim();
    
    // Auto-append extension if missing
    const originalName = itemToRename.name;
    const lastDotIndex = originalName.lastIndexOf('.');
    
    // Only apply if original had an extension and it wasn't a folder
    if (!itemToRename.folder && lastDotIndex !== -1) {
        const extension = originalName.substring(lastDotIndex); // e.g., ".jpg"
        // Check if new name already ends with that extension (case insensitive)
        if (!finalName.toLowerCase().endsWith(extension.toLowerCase())) {
            finalName += extension;
        }
    }

    if (finalName === itemToRename.name) return;

    try {
      const updated = await graphService.renameItem(validDriveId, itemToRename.id, finalName);
      
      const updateList = (list: DriveItem[]) => list.map(i => i.id === itemToRename.id ? updated : i);
      setItems(updateList);
      setServerSearchResults(updateList); 
      
      if (selectedItem?.id === itemToRename.id) setSelectedItem(updated);
      setItemToRename(null);
    } catch (err: any) {
      showAlert("Rename Error", `Rename failed: ${err.message}`);
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const validDriveId = await ensureDriveId();
    if (!validDriveId) return;
    
    try {
      if (itemToDelete.folder) {
          const childCount = await graphService.getFolderChildrenCount(validDriveId, itemToDelete.id);
          if (childCount > 0) {
              setItemToDelete(null); 
              setTimeout(() => {
                showAlert("Cannot Delete Folder", `The folder "${itemToDelete.name}" is NOT empty.`);
              }, 200); 
              return; 
          }
      }
      await graphService.deleteItem(validDriveId, itemToDelete.id);
      
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      setServerSearchResults(prev => prev.filter(i => i.id !== itemToDelete.id));
      
      if (selectedItem?.id === itemToDelete.id) {
          setSelectedItem(null);
          setShowProperties(false);
      }
      setItemToDelete(null); 

    } catch (err: any) {
      console.error(err);
      setItemToDelete(null); 
      setTimeout(() => showAlert("Delete Error", `Failed to delete: ${err.message}`), 200);
    }
  };

  const openShareModal = async (item: DriveItem) => {
      setItemToShare(item);
      setGeneratedLink("");
      setCopySuccess(false);
      setShowShareModal(true);
      setIsGeneratingLink(true);

      const validDriveId = await ensureDriveId();
      if (!validDriveId) return;

      try {
        // STRICT: We only use the link returned by this API call
        const link = await graphService.createSharingLink(validDriveId, item.id, 'view');
        setGeneratedLink(link);
      } catch (err: any) {
        setGeneratedLink("Error generating link: " + err.message);
      } finally {
        setIsGeneratingLink(false);
      }
  };

  const handleCopyLink = () => {
      navigator.clipboard.writeText(generatedLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const validDriveId = await ensureDriveId();
    if (!validDriveId) return;

    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      try {
        const file = e.target.files[0];
        const newItem = await graphService.uploadFile(validDriveId, currentFolderId, file);
        setItems(prev => [...prev, newItem]);
        showAlert("Success", "Upload Successful!");
      } catch (err: any) {
        showAlert("Upload Error", `Upload failed: ${err.message}`);
      } finally {
        setUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = (item: DriveItem) => {
    const downloadUrl = item['@microsoft.graph.downloadUrl'];
    if (downloadUrl) {
        window.open(downloadUrl, "_blank");
    } else {
        showAlert("Download Error", "Download link not available for this item.");
    }
  };

  const handleOpenFile = async (item: DriveItem) => {
    if (item.folder) {
        handleOpenFolder(item);
        return;
    }

    const name = item.name.toLowerCase();
    // Office Files: Continue using Office Online Viewer (webUrl)
    const isOffice = name.endsWith('.docx') || name.endsWith('.doc') || 
                     name.endsWith('.xlsx') || name.endsWith('.xls') || 
                     name.endsWith('.pptx') || name.endsWith('.ppt');

    if (isOffice && item.webUrl) {
        window.open(item.webUrl, "_blank");
        return;
    }

    // Non-Office Files (PDF, Images, Text, etc.)
    // Challenge: API sends 'Content-Disposition: attachment' which forces download.
    // Fix: We fetch the blob manually and display it in a new window using ObjectURL.
    if (item['@microsoft.graph.downloadUrl']) {
        const loadingWindow = window.open("", "_blank");
        if (loadingWindow) {
            loadingWindow.document.write("<html><body><div style='display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;'>Loading document preview...</div></body></html>");
            
            try {
                const blob = await graphService.fetchFileBlob(item['@microsoft.graph.downloadUrl']);
                const blobUrl = URL.createObjectURL(blob);
                loadingWindow.location.href = blobUrl;
            } catch (error) {
                loadingWindow.close();
                showAlert("View Error", "Could not load file preview. Please try downloading.");
            }
        } else {
            showAlert("Popup Blocked", "Please allow popups to view this file.");
        }
        return;
    }

    // Fallback
    if (item.webUrl) {
        window.open(item.webUrl, "_blank");
    } else {
        showAlert("Open Error", "File link not available.");
    }
  };

  const handleOpenFolder = async (folder: DriveItem) => {
    const validDriveId = await ensureDriveId();
    if (!validDriveId) return;

    setLoading(true);
    setSearchTerm("");
    try {
        const data = await graphService.getDriveItems(validDriveId, folder.id);
        setFolderHistory(prev => [...prev, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
        setItems(data);
        setSelectedItem(null);
    } catch (err: any) {
        showAlert("Navigation Error", `Failed to open folder: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const formatSize = (size: number) => {
    if (size === 0) return "-";
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
  };

  const getIcon = (item: DriveItem) => {
    if (item.folder) return <Folder className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
    const n = item.name.toLowerCase();
    if (n.endsWith('.pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (n.endsWith('.docx') || n.endsWith('.doc')) return <FileIcon className="w-5 h-5 text-blue-700" />;
    if (n.endsWith('.xlsx') || n.endsWith('.xls')) return <FileIcon className="w-5 h-5 text-green-600" />;
    if (/\.(jpg|jpeg|png)$/.test(n)) return <ImageIcon className="w-5 h-5 text-purple-600" />;
    return <FileIcon className="w-5 h-5 text-gray-500" />;
  };

  return (
    <>
    <div className="relative flex gap-6 items-start h-[calc(100vh-140px)]">
      
      <div className="flex flex-col flex-1 h-full space-y-4 overflow-hidden">
          
          {/* Header & Toolbar */}
          <div className="flex-shrink-0">
            <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Containers
            </button>
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{container.displayName}</h2>
                    
                    {/* Dynamic Breadcrumbs */}
                    <nav className="flex items-center text-sm mt-2 text-gray-500 overflow-hidden">
                        <button 
                            className="hover:text-brand-600 hover:bg-brand-50 rounded px-1 flex items-center transition-colors"
                            onClick={() => handleNavigateToFolder("root", -1)}
                        >
                            <Home className="w-3 h-3 mr-1" /> Root
                        </button>
                        
                        {folderHistory.map((folder, idx) => (
                            <React.Fragment key={folder.id}>
                                <ChevronRight className="w-3 h-3 mx-1 text-gray-300" />
                                <button
                                    className={`px-1 rounded transition-colors truncate max-w-[150px] ${
                                        idx === folderHistory.length - 1 
                                        ? "font-semibold text-gray-900 cursor-default" 
                                        : "hover:text-brand-600 hover:bg-brand-50"
                                    }`}
                                    onClick={() => idx !== folderHistory.length - 1 && handleNavigateToFolder(folder.id, idx)}
                                    disabled={idx === folderHistory.length - 1}
                                >
                                    {folder.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </nav>
                </div>
                <div className="flex gap-2">
                     <Button variant="secondary" onClick={() => setShowNewFolderModal(true)}>
                        <Plus className="w-4 h-4 mr-2" /> New Folder
                     </Button>
                     <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
                     <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Upload className="w-4 h-4 mr-2" />}
                        Upload File
                     </Button>
                </div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 overflow-hidden">
            
            {/* Search & Actions Bar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4 items-center justify-between flex-shrink-0">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" 
                        placeholder="Search files..." 
                    />
                     {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-brand-600"/>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                     {/* Sort Menu */}
                    <div className="relative">
                        <Button 
                            variant="secondary" 
                            size="md"
                            className="h-9" 
                            onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}
                        >
                            <ArrowUpDown className="w-4 h-4 mr-2" />
                            Sort
                        </Button>
                        
                        {showSortMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100" onClick={(e) => e.stopPropagation()}>
                                <div className="p-2 border-b border-gray-100">
                                    <p className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase">Sort By</p>
                                    <button onClick={() => { setSortField('name'); setShowSortMenu(false); }} className={`w-full text-left px-2 py-1.5 text-sm rounded flex justify-between items-center ${sortField === 'name' ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                        Name {sortField === 'name' && <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>}
                                    </button>
                                    <button onClick={() => { setSortField('size'); setShowSortMenu(false); }} className={`w-full text-left px-2 py-1.5 text-sm rounded flex justify-between items-center ${sortField === 'size' ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                        Size {sortField === 'size' && <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>}
                                    </button>
                                    <button onClick={() => { setSortField('lastModifiedDateTime'); setShowSortMenu(false); }} className={`w-full text-left px-2 py-1.5 text-sm rounded flex justify-between items-center ${sortField === 'lastModifiedDateTime' ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                        Date {sortField === 'lastModifiedDateTime' && <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>}
                                    </button>
                                </div>
                                <div className="p-2">
                                    <p className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase">Order</p>
                                    <div className="flex gap-1">
                                            <button onClick={() => { setSortDirection('asc'); setShowSortMenu(false); }} className={`flex-1 flex justify-center items-center px-2 py-1.5 rounded border ${sortDirection === 'asc' ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                <ArrowUp className="w-3 h-3 mr-1" /> Asc
                                            </button>
                                            <button onClick={() => { setSortDirection('desc'); setShowSortMenu(false); }} className={`flex-1 flex justify-center items-center px-2 py-1.5 rounded border ${sortDirection === 'desc' ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                <ArrowDown className="w-3 h-3 mr-1" /> Desc
                                            </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bulk Actions */}
                    {selectedItem && (
                        <>
                            <div className="h-6 w-px bg-gray-300 mx-1"></div>
                            <Button variant="secondary" size="sm" onClick={() => handleDownload(selectedItem)}>
                                <Download className="w-4 h-4 text-gray-700" />
                            </Button>
                            
                            {/* Rename - ADMIN ONLY */}
                            {isAdmin && (
                                <Button variant="secondary" size="sm" onClick={() => { setItemToRename(selectedItem); setShowRenameModal(true); }}>
                                    <Edit2 className="w-4 h-4 text-gray-700" />
                                </Button>
                            )}
                            
                            <Button variant="secondary" size="sm" onClick={() => openShareModal(selectedItem)}>
                                <Share2 className="w-4 h-4 text-gray-700" />
                            </Button>

                             {/* Delete - ADMIN ONLY */}
                            {isAdmin && (
                                <Button variant="danger" size="sm" onClick={() => setItemToDelete(selectedItem)} className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700 hover:border-red-300 border">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* File Table */}
            <div className="flex-1 overflow-auto" onClick={() => { setActiveMenuId(null); setShowSortMenu(false); }}>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white text-gray-500 text-xs font-semibold border-b border-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortField('name'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                                Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortField('size'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                                Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortField('lastModifiedDateTime'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                                Modified {sortField === 'lastModifiedDateTime' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && !isSearching ? (
                            <tr><td colSpan={4} className="text-center py-20 text-gray-500"><Loader2 className="w-8 h-8 mx-auto animate-spin mb-2 text-brand-500"/>Loading...</td></tr>
                        ) : displayItems.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-20 text-gray-500">
                                {searchTerm ? "No results found." : "This folder is empty."}
                            </td></tr>
                        ) : (
                            displayItems.map(item => (
                                <tr 
                                    key={item.id} 
                                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedItem?.id === item.id ? 'bg-blue-50/50' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setActiveMenuId(null); }}
                                    onDoubleClick={(e) => { e.stopPropagation(); handleOpenFile(item); }}
                                >
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-3">
                                            {getIcon(item)}
                                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-500">
                                        {item.folder ? "-" : formatSize(item.size)}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-500">
                                        {new Date(item.lastModifiedDateTime).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-3 text-right relative">
                                        <div className="flex justify-end items-center gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setShowProperties(true); }}
                                                className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700"
                                            >
                                                <Info className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setSelectedItem(item);
                                                    setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                                }}
                                                className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {activeMenuId === item.id && (
                                            <div className="absolute right-8 top-8 w-40 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenFile(item); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                    <ExternalLink className="w-3 h-3"/> Open
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(item); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                    <Download className="w-3 h-3"/> Download
                                                </button>
                                                
                                                {isAdmin && (
                                                    <button onClick={(e) => { e.stopPropagation(); setItemToRename(item); setShowRenameModal(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        <Edit2 className="w-3 h-3"/> Rename
                                                    </button>
                                                )}
                                                
                                                <button onClick={(e) => { e.stopPropagation(); openShareModal(item); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                    <Share2 className="w-3 h-3"/> Share
                                                </button>
                                                
                                                {isAdmin && (
                                                    <>
                                                        <div className="h-px bg-gray-100 my-1"></div>
                                                        <button onClick={(e) => { e.stopPropagation(); setItemToDelete(item); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                                            <Trash2 className="w-3 h-3"/> Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
          </div>
      </div>

      {/* Properties Panel */}
      {(showProperties && selectedItem) && (
        <div className="w-80 bg-white border border-gray-200 rounded-xl shadow-lg flex-shrink-0 h-full overflow-y-auto">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
             <h3 className="font-semibold text-gray-800">Item Properties</h3>
             <button onClick={() => setShowProperties(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-6">
             <div className="flex flex-col items-center py-4 border-b border-gray-100">
                <div className={`h-16 w-16 rounded-xl flex items-center justify-center mb-3 bg-gray-100`}>
                    {getIcon(selectedItem)}
                </div>
                <h4 className="font-bold text-gray-900 text-center px-2 break-words">{selectedItem.name}</h4>
             </div>
             
             {/* Strict ID Hierarchy Display */}
             <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                    <h5 className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-1 mb-2">Hierarchy Identifiers</h5>
                    
                    <div>
                        <label className="text-xs font-semibold text-gray-500 block">
                            {selectedItem.folder ? "Folder ID" : "File ID"}
                        </label>
                        <p className="text-xs font-mono text-gray-900 break-all select-all bg-white p-1 rounded border border-gray-100">
                            {selectedItem.id}
                        </p>
                    </div>

                    {selectedItem.parentReference && selectedItem.parentReference.id && (
                        <div>
                            <label className="text-xs font-semibold text-gray-500 block">Parent ID</label>
                            <p className="text-xs font-mono text-gray-900 break-all select-all bg-white p-1 rounded border border-gray-100">
                                {selectedItem.parentReference.id}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-gray-500 block">Container ID</label>
                        <p className="text-xs font-mono text-gray-900 break-all select-all bg-white p-1 rounded border border-gray-100">
                            {container.id}
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 block">Container Type ID</label>
                        <p className="text-xs font-mono text-gray-900 break-all select-all bg-white p-1 rounded border border-gray-100">
                            {container.containerTypeId}
                        </p>
                    </div>
                </div>

                {/* Other Metadata */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                    <h5 className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-1 mb-2">Metadata</h5>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 block">Created</label>
                            <p className="text-xs text-gray-900">{new Date(selectedItem.createdDateTime).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 block">Size</label>
                            <p className="text-xs text-gray-900">{selectedItem.folder ? "-" : formatSize(selectedItem.size)}</p>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 block">Modified By</label>
                        <p className="text-xs text-gray-900">{selectedItem.lastModifiedBy?.user?.displayName || 'Unknown'}</p>
                    </div>
                </div>
             </div>
             
             <div className="pt-4 border-t border-gray-100 flex gap-2">
                 <Button className="flex-1" onClick={() => handleOpenFile(selectedItem)}>Open</Button>
                 <Button className="flex-1" variant="secondary" onClick={() => handleDownload(selectedItem)}>Download</Button>
             </div>
          </div>
        </div>
      )}

    </div>

    {/* Modals */}
    <InputModal 
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onSubmit={handleCreateFolder}
        title="Create New Folder"
        placeholder="Enter folder name..."
        submitLabel="Create"
    />

    <InputModal 
        isOpen={showRenameModal && !!itemToRename}
        onClose={() => { setShowRenameModal(false); setItemToRename(null); }}
        onSubmit={handleRename}
        title={`Rename "${itemToRename?.name || ''}"`}
        initialValue={itemToRename?.name}
        placeholder="Enter new name..."
        submitLabel="Rename"
    />

    <ConfirmationModal 
      isOpen={!!itemToDelete}
      onClose={() => setItemToDelete(null)}
      onConfirm={handleConfirmDelete}
      title="Delete Item"
      message={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
      confirmLabel="Delete"
      isDestructive={true}
    />

    <AlertModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
    />

    <Modal
      isOpen={showShareModal}
      onClose={() => setShowShareModal(false)}
      title="Share Item"
      footer={
          <Button onClick={() => setShowShareModal(false)}>Close</Button>
      }
    >
        <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg text-blue-900">
                <div className="bg-blue-100 p-2 rounded-full">
                   <Share2 className="w-5 h-5 text-blue-600"/>
                </div>
                <div>
                   <p className="text-sm font-semibold">Share "{itemToShare?.name}"</p>
                   <p className="text-xs opacity-80">Anyone in your organization with this link can view.</p>
                </div>
            </div>

            {isGeneratingLink ? (
                <div className="py-8 flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-2 text-brand-600"/>
                    <p className="text-sm">Generating secure link...</p>
                </div>
            ) : (
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Sharing Link</label>
                    <div className="flex gap-2">
                        <input 
                            readOnly
                            value={generatedLink}
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 focus:outline-none select-all"
                        />
                        <Button variant="secondary" onClick={handleCopyLink} title="Copy to Clipboard">
                            {copySuccess ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4"/>}
                        </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                       <span className="font-semibold text-gray-600">Important:</span> This is an <strong>Organization Link</strong>. 
                       Recipients must log in with their corporate account to view this file. 
                       It will not work for public anonymous users.
                    </p>
                </div>
            )}
        </div>
    </Modal>
    </>
  );
};