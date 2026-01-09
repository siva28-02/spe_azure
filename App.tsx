import React, { useState, useEffect } from 'react';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ContainerList } from './components/ContainerList';
import { ContainerDetails } from './components/ContainerDetails';
import { PermissionManager } from './components/PermissionManager'; // Import New Component
import { GraphService } from './services/graphService';
import { SPEContainer, ViewState, SearchResult } from './types';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { instance, accounts } = useMsal();
  const [graphService, setGraphService] = useState<GraphService | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedContainer, setSelectedContainer] = useState<SPEContainer | null>(null);
  const [containers, setContainers] = useState<SPEContainer[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Security State
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReader, setIsReader] = useState(false);
  const [isCheckingRoles, setIsCheckingRoles] = useState(true);

  useEffect(() => {
    if (accounts.length > 0) {
      const service = new GraphService(instance, accounts[0]);
      setGraphService(service);
    }
  }, [instance, accounts]);

  useEffect(() => {
    if (graphService) {
      initApp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphService]);

  const initApp = async () => {
    if(!graphService) return;
    setIsCheckingRoles(true);
    try {
        // 1. Check Roles
        const roles = await graphService.checkUserRoles();
        setIsAdmin(roles.isAdmin);
        setIsReader(roles.isReader);
        
        // 2. Load Containers (if authorized)
        if (roles.isAdmin || roles.isReader) {
            await fetchContainers();
        } else {
            alert("Access Denied: You are not a member of DMS_Admin or DMS_Readers.");
        }
    } catch (e) {
        console.error("Initialization Failed", e);
    } finally {
        setIsCheckingRoles(false);
    }
  };

  const fetchContainers = async () => {
    if (!graphService) return;
    setLoading(true);
    try {
      const data = await graphService.listContainers();
      setContainers(data);
    } catch (error) {
      console.error("Error fetching containers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContainer = async (name: string, description: string) => {
    if (!graphService || !isAdmin) return;
    try {
      await graphService.createContainer(name, description);
      await fetchContainers(); // Refresh list to see permissions applied
    } catch (error) {
      console.error("Error creating container:", error);
      alert("Failed to create container.");
    }
  };

  const handleDeleteContainer = async (id: string) => {
    if (!graphService || !isAdmin) return;
    await graphService.deleteContainer(id);
    await fetchContainers();
  };

  const handleSelectContainer = (container: SPEContainer) => {
    setSelectedContainer(container);
    setCurrentView(ViewState.CONTAINER_DETAILS);
  };

  const handleSearchResult = (result: SearchResult) => {
    if (result.type === 'container') {
      handleSelectContainer(result.data as SPEContainer);
    } else {
      alert(`Selected ${result.type}: ${result.title}. (Navigation to specific files requires parent container context).`);
    }
  };

  if (isCheckingRoles) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Verifying Security Access...</p>
          </div>
      );
  }

  // If user is logged in but not in any group
  if (!isAdmin && !isReader) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-red-50 p-4 text-center">
              <div className="bg-white p-8 rounded-xl shadow-lg max-w-md">
                <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">You are authenticated, but your account is not a member of the required Security Groups (DMS_Admin or DMS_Readers).</p>
                <button onClick={() => instance.logoutPopup()} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md font-medium">Sign Out</button>
              </div>
          </div>
      );
  }

  return (
    <Layout 
        currentView={currentView} 
        onChangeView={(view) => {
            setCurrentView(view);
            if(view !== ViewState.CONTAINER_DETAILS) setSelectedContainer(null);
        }}
        userEmail={accounts[0]?.username}
        graphService={graphService}
        onSelectSearchResult={handleSearchResult}
    >
      {currentView === ViewState.DASHBOARD && (
        <Dashboard 
            containers={containers} 
            onViewAll={() => setCurrentView(ViewState.ALL_CONTAINERS)} 
            onSelectContainer={handleSelectContainer}
        />
      )}
      
      {currentView === ViewState.ALL_CONTAINERS && (
        <ContainerList 
          containers={containers} 
          onCreateContainer={handleCreateContainer}
          onDeleteContainer={handleDeleteContainer}
          onSelectContainer={handleSelectContainer}
          isLoading={loading}
          isAdmin={isAdmin}
        />
      )}

      {currentView === ViewState.CONTAINER_DETAILS && selectedContainer && graphService && (
        <ContainerDetails 
          container={selectedContainer} 
          graphService={graphService}
          onBack={() => {
              setCurrentView(ViewState.ALL_CONTAINERS);
              setSelectedContainer(null);
          }}
          isAdmin={isAdmin}
        />
      )}

      {currentView === ViewState.PERMISSIONS && graphService && (
        <PermissionManager 
            containers={containers}
            graphService={graphService}
            isAdmin={isAdmin}
        />
      )}
    </Layout>
  );
};

export default function App() {
  return (
    <>
      <AuthenticatedTemplate>
        <AppContent />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </>
  );
}
