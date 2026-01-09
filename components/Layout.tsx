import React, { useState, useRef, useEffect } from 'react';
import { ViewState, SearchResult } from '../types';
import { LayoutDashboard, Database, FolderOpen, LogOut, User as UserIcon, Search, File as FileIcon, Folder, Loader2, Shield, Users } from 'lucide-react';
import { useMsal } from "@azure/msal-react";
import { GraphService } from '../services/graphService';

interface LayoutProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  children: React.ReactNode;
  userEmail?: string;
  graphService: GraphService | null;
  onSelectSearchResult: (result: SearchResult) => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  currentView, 
  onChangeView, 
  children, 
  userEmail,
  graphService,
  onSelectSearchResult
}) => {
  const { instance } = useMsal();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [roleLabel, setRoleLabel] = useState<string>("Checking...");
  const searchRef = useRef<HTMLDivElement>(null);

  // Check roles once for display
  useEffect(() => {
    const loadRole = async () => {
        if(graphService) {
            try {
                const roles = await graphService.checkUserRoles();
                if (roles.isAdmin) setRoleLabel("Administrator");
                else if (roles.isReader) setRoleLabel("Reader");
                else setRoleLabel("No Access");
            } catch(e) {
                setRoleLabel("Unknown");
            }
        }
    };
    loadRole();
  }, [graphService]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // Allow searching with even 1 char for container lists
      if (searchQuery.length > 0 && graphService) {
        setIsSearching(true);
        setShowResults(true);
        try {
          // Use searchContainers for global top bar (searches cache)
          const results = await graphService.searchContainers(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error("Search error", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        if (searchQuery.length === 0) setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, graphService]);

  const handleLogout = () => {
    instance.logoutPopup().catch(e => console.error(e));
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return "";
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
  };

  const isPermissionView = currentView === ViewState.PERMISSIONS;

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 hidden md:flex">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-900 font-bold text-xl">
            <Database className="w-6 h-6 text-brand-600" />
            <span>SPE Admin</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">SharePoint Embedded</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => onChangeView(ViewState.DASHBOARD)}
            className={`flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentView === ViewState.DASHBOARD
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mr-3" />
            Dashboard
          </button>
          
          <button
            onClick={() => onChangeView(ViewState.ALL_CONTAINERS)}
            className={`flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentView === ViewState.ALL_CONTAINERS || currentView === ViewState.CONTAINER_DETAILS
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FolderOpen className="w-4 h-4 mr-3" />
            All Containers
          </button>

           {/* New Access Control Link */}
           <button
            onClick={() => onChangeView(ViewState.PERMISSIONS)}
            className={`flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isPermissionView
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-4 h-4 mr-3" />
            Access Control
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
            {/* Debug Info for Role */}
           <div className="mb-4 px-3 py-2 bg-gray-50 rounded text-xs border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Shield className="w-3 h-3"/>
                    <span className="font-semibold uppercase">Current Access</span>
                </div>
                <p className={`font-medium ${roleLabel === 'Administrator' ? 'text-green-600' : 'text-blue-600'}`}>
                    {roleLabel}
                </p>
           </div>

           <button onClick={handleLogout} className="flex items-center w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 transition-colors">
             <LogOut className="w-4 h-4 mr-3" />
             Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 transition-all">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-20 px-6 flex items-center justify-between shadow-sm">
            
            {/* Search Bar Area */}
            <div className="flex-1 max-w-2xl mx-auto relative" ref={searchRef}>
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input 
                   type="text"
                   className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-transparent focus:border-brand-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 placeholder-gray-500 transition-all focus:outline-none focus:ring-4 focus:ring-brand-50"
                   placeholder="Search Containers..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   onFocus={() => { if(searchResults.length > 0) setShowResults(true); }}
                 />
                 {isSearching && (
                   <div className="absolute right-3 top-1/2 -translate-y-1/2">
                     <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                   </div>
                 )}
               </div>

               {/* Recommendation Dropdown */}
               {showResults && (
                 <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                   <div className="max-h-[400px] overflow-y-auto">
                     {searchResults.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No containers found.
                        </div>
                     ) : (
                         <div className="p-2">
                             <h4 className="text-xs font-semibold text-gray-400 uppercase px-3 py-2">Containers</h4>
                             {searchResults.map(result => (
                               <div 
                                  key={result.id} 
                                  onClick={() => {
                                    onSelectSearchResult(result);
                                    setShowResults(false);
                                    setSearchQuery("");
                                  }}
                                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer group"
                                >
                                 <div className="flex items-center gap-3">
                                   <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                                     <Folder className="w-4 h-4" />
                                   </div>
                                   <div>
                                     <p className="text-sm font-medium text-gray-900 group-hover:text-brand-600">{result.title}</p>
                                     <p className="text-xs text-gray-500">{result.subTitle}</p>
                                   </div>
                                 </div>
                                 <span className="text-xs text-gray-400 font-medium">{formatSize(result.size)}</span>
                               </div>
                             ))}
                         </div>
                     )}
                   </div>
                 </div>
               )}
            </div>

            <div className="flex items-center gap-4 ml-6">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">{roleLabel === 'Administrator' ? 'Admin User' : 'Employee'}</p>
                    <p className="text-xs text-gray-500">{userEmail || 'User'}</p>
                </div>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${roleLabel === 'Administrator' ? 'bg-brand-100 text-brand-700' : 'bg-green-100 text-green-700'}`}>
                    <UserIcon className="w-5 h-5" />
                </div>
            </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
            {children}
        </main>
      </div>
    </div>
  );
};
