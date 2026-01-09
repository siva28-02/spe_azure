import React, { useState, useMemo } from 'react';
import { SPEContainer } from '../types';
import { Button } from './Button';
import { ConfirmationModal, AlertModal } from './Modal';
import { Folder, Plus, Trash2, Info, Search, X, CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown, ShieldAlert, Loader2 } from 'lucide-react';

interface ContainerListProps {
  containers: SPEContainer[];
  onCreateContainer: (name: string, description: string) => Promise<void>;
  onDeleteContainer: (id: string) => Promise<void>;
  onSelectContainer: (container: SPEContainer) => void;
  isLoading?: boolean;
  isAdmin: boolean;
}

type SortField = 'displayName' | 'size' | 'createdDateTime';
type SortDirection = 'asc' | 'desc';

export const ContainerList: React.FC<ContainerListProps> = ({ 
  containers, 
  onCreateContainer, 
  onDeleteContainer,
  onSelectContainer,
  isLoading,
  isAdmin
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('createdDateTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoContainer, setInfoContainer] = useState<SPEContainer | null>(null);
  
  // Delete Modal State
  const [containerToDelete, setContainerToDelete] = useState<SPEContainer | null>(null);

  // Alert Modal State
  const [alertState, setAlertState] = useState<{isOpen: boolean, title: string, message: string}>({
      isOpen: false, title: "", message: ""
  });

  const showAlert = (title: string, message: string) => {
    setAlertState({ isOpen: true, title, message });
  };

  // Filter & Sort Logic
  const processedContainers = useMemo(() => {
    // 1. Filter
    let result = containers.filter(c => 
        c.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. Sort
    result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        // Handle undefined sizes
        if (sortField === 'size') {
            valA = valA || 0;
            valB = valB || 0;
        }

        // String comparison for names
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        // Date comparison
        if (sortField === 'createdDateTime') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
  }, [containers, searchTerm, sortField, sortDirection]);

  const handleCreate = async () => {
    if(!newName) {
        showAlert("Input Error", "Please enter a container name");
        return;
    }
    setIsSubmitting(true);
    try {
        await onCreateContainer(newName, newDesc);
        setIsCreating(false);
        setNewName("");
        setNewDesc("");
    } catch(e) {
        // Error handled in parent, but we stop loading here
    } finally {
        setIsSubmitting(false);
    }
  };

  const toggleSelection = (id: string) => {
    if (selectedId === id) setSelectedId(null);
    else setSelectedId(id);
  };

  const requestDelete = (explicitContainer?: SPEContainer) => {
    const target = explicitContainer || containers.find(c => c.id === selectedId) || infoContainer;
    if (target) {
        setContainerToDelete(target);
    } else {
        showAlert("Selection Error", "No container selected.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!containerToDelete) return;
    
    try {
        console.log(`Calling delete on container: ${containerToDelete.id}`);
        await onDeleteContainer(containerToDelete.id);
        
        if (containerToDelete.id === selectedId) setSelectedId(null);
        if (containerToDelete.id === infoContainer?.id) setInfoContainer(null);
        setContainerToDelete(null); 
        
        showAlert("Success", "Container deleted successfully.");
    } catch (error: any) {
        console.error("Delete operation failed:", error);
        setContainerToDelete(null); 

        const errorMessage = error.message || "Unknown error";
        if (errorMessage.includes("not empty") || errorMessage.includes("Conflict") || errorMessage.includes("notAllowed")) {
            setTimeout(() => {
                showAlert(
                    "Cannot Delete Container", 
                    `Unable to delete "${containerToDelete.displayName}".\n\nReason: The container is likely not empty.\n\nPlease open the container and delete all files and folders inside it first.`
                );
            }, 200);
        } else {
            setTimeout(() => {
                showAlert("Delete Failed", `Failed to delete container.\n\nError: ${errorMessage}`);
            }, 200);
        }
    }
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return "-";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  };

  const hasSelection = selectedId !== null || infoContainer !== null;

  return (
    <div className="relative flex gap-6 items-start h-[calc(100vh-140px)]">
      {/* Main List Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 h-full overflow-hidden">
        <div className="p-5 border-b border-gray-100 space-y-4 flex-shrink-0">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                  <h2 className="text-xl font-semibold text-gray-900">All Containers</h2>
                  <p className="text-sm text-gray-500">Manage your SharePoint Embedded containers</p>
              </div>
              <div className="flex gap-2">
                   {isAdmin && (
                       <Button 
                          variant="danger" 
                          onClick={() => requestDelete()}
                          disabled={!hasSelection}
                       >
                         <Trash2 className="w-4 h-4 mr-2" />
                         Delete Container
                       </Button>
                   )}

                   {isAdmin && (
                       <Button onClick={() => setIsCreating(true)} disabled={isSubmitting}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Container
                      </Button>
                   )}
                   
                   {!isAdmin && (
                       <div className="flex items-center text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                           <ShieldAlert className="w-4 h-4 mr-2 text-blue-600"/>
                           Reader Access Only
                       </div>
                   )}
              </div>
          </div>

          {isCreating && isAdmin && (
               <div className="bg-brand-50 p-4 rounded-lg border border-brand-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-brand-900">New Container</h3>
                      {isSubmitting && <span className="text-xs text-brand-600 animate-pulse font-medium">Provisioning Access...</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <input 
                          type="text" 
                          placeholder="Container Name" 
                          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          disabled={isSubmitting}
                      />
                      <input 
                          type="text" 
                          placeholder="Description (Optional)" 
                          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900"
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                          disabled={isSubmitting}
                      />
                  </div>
                  <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)} disabled={isSubmitting}>Cancel</Button>
                      <Button size="sm" onClick={handleCreate} disabled={isSubmitting}>
                          {isSubmitting ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                Provisioning...
                              </>
                          ) : "Save Container"}
                      </Button>
                  </div>
               </div>
          )}

          <div className="flex gap-2">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                      type="text" 
                      placeholder="Search containers..." 
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              
              {/* Sort Menu */}
              <div className="relative">
                  <Button 
                    variant="secondary" 
                    className="h-full" 
                    onClick={() => setShowSortMenu(!showSortMenu)}
                  >
                     <ArrowUpDown className="w-4 h-4 mr-2" />
                     Sort
                  </Button>
                  
                  {showSortMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                           <div className="p-2 border-b border-gray-100">
                               <p className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase">Sort By</p>
                               <button onClick={() => setSortField('displayName')} className={`w-full text-left px-2 py-1.5 text-sm rounded flex justify-between items-center ${sortField === 'displayName' ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                   Name {sortField === 'displayName' && <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>}
                               </button>
                               <button onClick={() => setSortField('size')} className={`w-full text-left px-2 py-1.5 text-sm rounded flex justify-between items-center ${sortField === 'size' ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                   Size {sortField === 'size' && <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>}
                               </button>
                               <button onClick={() => setSortField('createdDateTime')} className={`w-full text-left px-2 py-1.5 text-sm rounded flex justify-between items-center ${sortField === 'createdDateTime' ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                   Date {sortField === 'createdDateTime' && <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>}
                               </button>
                           </div>
                           <div className="p-2">
                               <p className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase">Order</p>
                               <div className="flex gap-1">
                                    <button onClick={() => setSortDirection('asc')} className={`flex-1 flex justify-center items-center px-2 py-1.5 rounded border ${sortDirection === 'asc' ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                        <ArrowUp className="w-3 h-3 mr-1" /> Asc
                                    </button>
                                    <button onClick={() => setSortDirection('desc')} className={`flex-1 flex justify-center items-center px-2 py-1.5 rounded border ${sortDirection === 'desc' ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                        <ArrowDown className="w-3 h-3 mr-1" /> Desc
                                    </button>
                               </div>
                           </div>
                           
                           {/* Click blocker for outside clicks */}
                           <div className="fixed inset-0 z-[-1]" onClick={() => setShowSortMenu(false)}></div>
                      </div>
                  )}
              </div>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold sticky top-0 z-10">
                  <tr>
                      <th className="px-4 py-4 w-12 text-center bg-gray-50"></th>
                      <th className="px-6 py-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortField('displayName'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                          Container Name {sortField === 'displayName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortField('createdDateTime'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                          Created Date {sortField === 'createdDateTime' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setSortField('size'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                          Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-4 bg-gray-50 text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading containers...</td></tr>
                  ) : processedContainers.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">No containers match your search.</td></tr>
                  ) : (
                      processedContainers.map(container => {
                          const isSelected = selectedId === container.id;
                          const isDisabled = selectedId !== null && !isSelected;

                          return (
                            <tr key={container.id} className={`hover:bg-gray-50 transition-colors group ${isSelected ? 'bg-blue-50/50' : ''} ${isDisabled ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-4 text-center">
                                    <button 
                                      onClick={(e) => { 
                                          e.stopPropagation(); 
                                          if (!isDisabled) toggleSelection(container.id); 
                                      }}
                                      disabled={isDisabled}
                                      className={`flex items-center justify-center transition-colors ${
                                          isDisabled 
                                            ? 'text-gray-200 cursor-not-allowed' 
                                            : 'text-gray-400 hover:text-brand-600'
                                      }`}
                                    >
                                       {isSelected ? (
                                         <CheckSquare className="w-5 h-5 text-brand-600" />
                                       ) : (
                                         <Square className="w-5 h-5" />
                                       )}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <div 
                                        className="flex items-center gap-3 cursor-pointer"
                                        onClick={() => onSelectContainer(container)}
                                    >
                                        <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded flex items-center justify-center">
                                            <Folder className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors">{container.displayName}</p>
                                            {container.description && <p className="text-xs text-gray-500">{container.description}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {new Date(container.createdDateTime).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {formatSize(container.size)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setInfoContainer(container); }}
                                          className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-brand-600 transition-colors"
                                        >
                                            <Info className="w-4 h-4" />
                                        </button>
                                        {isAdmin && (
                                            <button 
                                              onClick={(e) => { 
                                                  e.stopPropagation(); 
                                                  requestDelete(container); 
                                              }}
                                              className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-600 transition-colors"
                                              title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                      })
                  )}
              </tbody>
          </table>
        </div>
      </div>

      {/* Properties Panel (Right Side) */}
      {infoContainer && (
        <div className="w-80 bg-white border border-gray-200 rounded-xl shadow-lg flex-shrink-0 h-full overflow-y-auto animate-in slide-in-from-right-10 duration-200">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0">
             <h3 className="font-semibold text-gray-800">Container Properties</h3>
             <button onClick={() => setInfoContainer(null)} className="text-gray-400 hover:text-gray-600">
               <X className="w-4 h-4" />
             </button>
          </div>
          <div className="p-4 space-y-6">
             <div className="flex flex-col items-center py-4 border-b border-gray-100">
                <div className="h-16 w-16 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center mb-3">
                   <Folder className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-gray-900 text-center px-2">{infoContainer.displayName}</h4>
                <span className="text-xs text-brand-600 bg-brand-50 px-2 py-1 rounded mt-1">Active</span>
             </div>

             <div className="space-y-4">
               <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                   <h5 className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-1 mb-2">Identification</h5>
                   <div>
                       <label className="text-xs font-semibold text-gray-500 block">Container ID</label>
                       <p className="text-xs font-mono text-gray-900 break-all select-all">{infoContainer.id}</p>
                   </div>
                   <div>
                       <label className="text-xs font-semibold text-gray-500 block">Container Type ID</label>
                       <p className="text-xs font-mono text-gray-900 break-all select-all">{infoContainer.containerTypeId}</p>
                   </div>
               </div>

               <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                   <h5 className="text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-1 mb-2">Details</h5>
                   <div>
                        <label className="text-xs font-semibold text-gray-500 block">Created By</label>
                        <p className="text-sm text-gray-900 mt-0.5">{infoContainer.createdBy?.user?.displayName || 'System'}</p>
                   </div>
                   <div>
                        <label className="text-xs font-semibold text-gray-500 block">Created On</label>
                        <p className="text-sm text-gray-900 mt-0.5">{new Date(infoContainer.createdDateTime).toLocaleDateString()}</p>
                   </div>
                   <div>
                        <label className="text-xs font-semibold text-gray-500 block">Size</label>
                        <p className="text-sm text-gray-900 mt-0.5">{formatSize(infoContainer.size)}</p>
                   </div>
               </div>
             </div>

             <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
                <Button variant="secondary" className="w-full" onClick={() => onSelectContainer(infoContainer)}>
                  Open Container
                </Button>
                {isAdmin && (
                    <Button 
                      variant="danger" 
                      className="w-full bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300" 
                      onClick={() => requestDelete(infoContainer)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Container
                    </Button>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={!!containerToDelete}
        onClose={() => setContainerToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Container"
        message={`Are you sure you want to delete "${containerToDelete?.displayName}"? This action cannot be undone.`}
        confirmLabel="Delete Container"
        isDestructive={true}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
      />
    </div>
  );
};
