import { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { SPEContainer, DriveItem, SearchResult, SPEPermission } from "../types";
import { SHAREPOINT_CONFIG, SCOPES, ROLES, API_SERVER_URL, AZURE_CONFIG } from "../constants";
import { loginRequest } from "../authConfig";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_BETA_URL = "https://graph.microsoft.com/beta";

export class GraphService {
  private msalInstance: IPublicClientApplication;
  private account: AccountInfo;
  private containersCache: SPEContainer[] = [];

  constructor(msalInstance: IPublicClientApplication, account: AccountInfo) {
    this.msalInstance = msalInstance;
    this.account = account;
  }

  private async getAccessToken(): Promise<string> {
    try {
      const response = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: this.account,
      });
      return response.accessToken;
    } catch (error) {
      const response = await this.msalInstance.acquireTokenPopup({
        ...loginRequest,
        account: this.account,
      });
      return response.accessToken;
    }
  }

  private async callApi(url: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");

    if (options.body) {
      headers.set("Content-Type", "application/json");
    }

    try {
      console.log(`[API CALL] ${options.method || 'GET'} ${url}`);
      const response = await fetch(url, { ...options, headers });
      
      if (response.status === 204) return null;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        try {
            const errorJson = JSON.parse(errorText);
            if(errorJson.error && errorJson.error.message) {
                errorMessage = errorJson.error.message;
            }
        } catch(e) { /* ignore json parse error */ }
        
        if (response.status === 409) {
            console.warn("Graph API Conflict (Handled):", errorMessage);
        } else {
            console.error("Graph API Error:", errorMessage);
        }
        
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Conflict")) {
          console.error("Network/API execution failed:", error);
      }
      throw error;
    }
  }

  // --- Security / RBAC ---

  async checkUserRoles(): Promise<{ isAdmin: boolean; isReader: boolean }> {
    const endpoint = `${GRAPH_BASE_URL}/me/transitiveMemberOf?$select=id,displayName`;
    const result = await this.callApi(endpoint);
    
    const groups = result.value || [];
    const groupIds = new Set(groups.map((g: any) => g.id));
    
    return {
      isAdmin: groupIds.has(ROLES.ADMIN_GROUP_ID),
      isReader: groupIds.has(ROLES.READER_GROUP_ID)
    };
  }

  async getUserDetails(userId: string): Promise<any> {
      return await this.callApi(`${GRAPH_BASE_URL}/users/${userId}?$select=id,displayName,userPrincipalName,mail`);
  }

  async getGroupMembers(groupId: string): Promise<any[]> {
    const endpoint = `${GRAPH_BASE_URL}/groups/${groupId}/transitiveMembers`;
    try {
        const result = await this.callApi(endpoint);
        const allMembers = result.value || [];
        const users = allMembers.filter((m: any) => m['@odata.type'] === '#microsoft.graph.user');

        const hydratedMembers = await Promise.all(users.map(async (m: any) => {
            if (!m.userPrincipalName && !m.mail) {
                try {
                    const details = await this.getUserDetails(m.id);
                    return { ...m, ...details };
                } catch (e) {
                    return m;
                }
            }
            return m;
        }));
        return hydratedMembers;
    } catch (e) {
        console.error(`Failed to fetch members for group ${groupId}`, e);
        return [];
    }
  }

  // --- Backend App Access Helpers ---

  async getServicePrincipal(): Promise<{id: string, displayName: string}> {
    // We need to find the Service Principal (Enterprise App) Object ID
    const clientId = AZURE_CONFIG.clientId;
    const endpoint = `${GRAPH_BASE_URL}/servicePrincipals?$filter=appId eq '${clientId}'&$select=id,displayName`;
    try {
        const result = await this.callApi(endpoint);
        if (result.value && result.value.length > 0) {
            return {
                id: result.value[0].id,
                displayName: result.value[0].displayName
            };
        }
        throw new Error("Service Principal not found. Ensure the App is registered in Enterprise Applications.");
    } catch (e: any) {
        throw new Error(`Could not find Service Principal for App ID ${clientId}. Ensure 'Application.Read.All' is granted. ${e.message}`);
    }
  }

  async grantAppAccess(containerId: string): Promise<void> {
      try {
          const sp = await this.getServicePrincipal();
          const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers/${containerId}/permissions`;
          
          // UPDATED: Using 'servicePrincipal' property as explicitly requested.
          // This grants the App Registration's Service Principal access to the container.
          const body = {
              roles: ["manager"],
              grantedToV2: {
                  servicePrincipal: {
                      id: sp.id
                  }
              }
          };
          
          console.log("Granting App Access Payload:", JSON.stringify(body));
          await this.callApi(endpoint, { method: "POST", body: JSON.stringify(body) });
          console.log("App Access Granted successfully.");
      } catch (e: any) {
          if (e.message.includes("Conflict")) {
              console.log("App already has access (Conflict).");
          } else {
              console.error("Failed to grant App access", e);
              throw e;
          }
      }
  }

  // --- Container Operations ---

  async listContainers(): Promise<SPEContainer[]> {
    const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers?$filter=containerTypeId eq ${SHAREPOINT_CONFIG.containerTypeId}`;
    
    try {
        // STRATEGY 1: Direct Graph Access (Works for Admins/Owners)
        const result = await this.callApi(endpoint);
        let containers = result.value || [];
        this.containersCache = containers;
        return containers;

    } catch (error: any) {
        // STRATEGY 2: Fallback for Readers (Access Denied / 403)
        if (error.message.includes("Access denied") || 
            error.message.includes("403") || 
            error.message.includes("permissions") ||
            error.message.includes("Authorization_RequestDenied")) {
            
            console.warn("Direct Access Denied (Expected for Readers). Attempting Backend Proxy (Option B)...");
            
            try {
                // Call Azure Function
                const backendContainers = await this.listContainersViaBackend();
                console.log(`[Option B] Backend returned ${backendContainers.length} containers.`);
                this.containersCache = backendContainers;
                return backendContainers;

            } catch (backendError: any) {
                // STRATEGY 3: Fallback to Search if Backend is down/fails
                console.warn(`[Option B] Backend failed (${backendError.message}). Falling back to Search (Option C).`);
                console.warn("Ensure your Azure Function is running on localhost:7071");
                
                try {
                    const searchResults = await this.searchContainersForUser();
                    this.containersCache = searchResults;
                    return searchResults;
                } catch (searchError) {
                    console.error("All fetch methods failed.", searchError);
                    return [];
                }
            }
        }
        throw error;
    }
  }

  // OPTION B: Server-Side Filtering Implementation
  async listContainersViaBackend(): Promise<SPEContainer[]> {
      const token = await this.getAccessToken();
      const headers = new Headers();
      // We pass the user's token so the Backend knows WHO to filter for
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");

      const url = `${API_SERVER_URL}?containerTypeId=${SHAREPOINT_CONFIG.containerTypeId}`;
      console.log(`[Option B] Requesting Backend: ${url}`);

      const response = await fetch(url, {
          method: "GET",
          headers: headers
      });

      if (!response.ok) {
          const txt = await response.text();
          throw new Error(`Backend Status ${response.status}: ${txt}`);
      }
      
      const data = await response.json();
      return data.containers || [];
  }

  // Option C: Search Fallback
  async searchContainersForUser(): Promise<SPEContainer[]> {
    const endpoint = `${GRAPH_BASE_URL}/search/query`;
    const body = {
        requests: [
            {
                entityTypes: ["drive"],
                query: {
                    queryString: `ContainerTypeId:"${SHAREPOINT_CONFIG.containerTypeId}"`
                },
                fields: ["id", "name", "description", "createdDateTime", "lastModifiedDateTime", "webUrl", "driveId"]
            }
        ]
    };

    const result = await this.callApi(endpoint, { method: "POST", body: JSON.stringify(body) });
    const hits = result.value?.[0]?.hitsContainers?.[0]?.hits || [];
    
    console.log(`[Search Fallback] Found ${hits.length} containers via search.`);

    return hits.map((hit: any) => {
        const resource = hit.resource;
        return {
            id: hit.hitId || resource.id,
            displayName: resource.name,
            description: resource.description || "",
            containerTypeId: SHAREPOINT_CONFIG.containerTypeId,
            createdDateTime: resource.createdDateTime || new Date().toISOString(),
            size: resource.quota ? resource.quota.used : 0,
            driveId: resource.id,
            customProperties: {}
        } as SPEContainer;
    });
  }

  async searchContainers(query: string): Promise<SearchResult[]> {
    if (!query) return [];
    if (this.containersCache.length === 0) {
        try { await this.listContainers(); } catch (e) { return []; }
    }
    const lowerQuery = query.toLowerCase();
    const matches = this.containersCache.filter(c => 
      c.displayName.toLowerCase().includes(lowerQuery) || 
      (c.description && c.description.toLowerCase().includes(lowerQuery))
    );
    return matches.map(c => ({
      id: c.id,
      title: c.displayName,
      subTitle: c.description || "Container",
      type: 'container',
      size: c.size,
      data: c
    }));
  }

  async createContainer(displayName: string, description: string = ""): Promise<SPEContainer> {
    const body = {
      displayName,
      description,
      containerTypeId: SHAREPOINT_CONFIG.containerTypeId,
    };
    const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers`;
    
    console.log("Creating Container...");
    const newContainer = await this.callApi(endpoint, { method: "POST", body: JSON.stringify(body) });
    
    // Auto-assign creator as manager
    try {
        if (this.account?.username) {
            await this.addContainerPermissionUser(newContainer.id, this.account.username, "manager");
        }
    } catch (selfAssignError) { console.warn("Self-assign failed", selfAssignError); }

    // Wait for propagation then Provision Groups
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.provisionContainerAccess(newContainer.id, (msg) => console.log(msg));

    return newContainer;
  }

  async provisionContainerAccess(containerId: string, onLog?: (msg: string) => void): Promise<void> {
    const log = (msg: string) => { if(onLog) onLog(msg); else console.log(msg); };

    try {
        log("Ensuring Backend App Access...");
        try {
            await this.grantAppAccess(containerId);
            log("Backend App granted Manager access.");
        } catch (appErr: any) {
            log(`Warning: Could not grant App access. Backend filtering will fail. ${appErr.message}`);
        }

        log("Fetching Security Groups...");
        const adminUsers = await this.getGroupMembers(ROLES.ADMIN_GROUP_ID);
        const readerUsers = await this.getGroupMembers(ROLES.READER_GROUP_ID);

        const validAdmins = adminUsers.filter(u => u.userPrincipalName || u.mail);
        const validReaders = readerUsers.filter(u => u.userPrincipalName || u.mail);

        if (validAdmins.length > 0) {
            log(`Provisioning ${validAdmins.length} Admins...`);
            for(const user of validAdmins) {
                try {
                    await this.addContainerPermissionUser(containerId, user.userPrincipalName || user.mail, "manager");
                } catch(e) { /* ignore conflict */ }
            }
        }

        if (validReaders.length > 0) {
            log(`Provisioning ${validReaders.length} Readers...`);
            for(const user of validReaders) {
                try {
                    await this.addContainerPermissionUser(containerId, user.userPrincipalName || user.mail, "reader");
                } catch(e) { /* ignore conflict */ }
            }
        }
        log("Provisioning Complete.");
    } catch (permError: any) {
        log(`Provisioning Error: ${permError.message}`);
    }
  }

  async listContainerPermissions(containerId: string): Promise<SPEPermission[]> {
    const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers/${containerId}/permissions`;
    const result = await this.callApi(endpoint);
    return result.value || [];
  }

  async updateContainerPermission(containerId: string, permissionId: string, newRole: 'reader' | 'writer' | 'manager' | 'owner'): Promise<void> {
    const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers/${containerId}/permissions/${permissionId}`;
    const body = { roles: [newRole] };
    await this.callApi(endpoint, { method: "PATCH", body: JSON.stringify(body) });
  }

  async deleteContainerPermission(containerId: string, permissionId: string): Promise<void> {
    const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers/${containerId}/permissions/${permissionId}`;
    await this.callApi(endpoint, { method: "DELETE" });
  }

  async addContainerPermissionUser(containerId: string, userPrincipalName: string, role: 'reader' | 'writer' | 'manager' | 'owner'): Promise<void> {
    const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers/${containerId}/permissions`;
    const body = {
        roles: [role],
        grantedToV2: { user: { userPrincipalName: userPrincipalName } }
    };
    await this.callApi(endpoint, { method: "POST", body: JSON.stringify(body) });
  }

  async deleteContainer(containerId: string): Promise<void> {
    const endpoint = `${GRAPH_BASE_URL}/storage/fileStorage/containers/${containerId}`;
    await this.callApi(endpoint, { method: "DELETE" });
  }

  async getContainerDriveId(containerId: string): Promise<string> {
    const endpoint = `${GRAPH_BETA_URL}/storage/fileStorage/containers/${containerId}/drive`;
    const result = await this.callApi(endpoint);
    return result.id;
  }

  async getDriveItems(driveId: string, folderId: string = "root"): Promise<DriveItem[]> {
    const endpointUrl = folderId === "root" 
      ? `${GRAPH_BASE_URL}/drives/${driveId}/root/children`
      : `${GRAPH_BASE_URL}/drives/${driveId}/items/${folderId}/children`;
    const result = await this.callApi(endpointUrl);
    return result.value || [];
  }

  async searchDriveItems(driveId: string, query: string): Promise<DriveItem[]> {
    const sanitizedQuery = query.replace(/'/g, "''");
    const selectFields = "id,name,webUrl,size,createdDateTime,lastModifiedDateTime,file,folder,parentReference,createdBy";
    const endpointUrl = `${GRAPH_BASE_URL}/drives/${driveId}/root/search(q='${sanitizedQuery}')?select=${selectFields}`;
    const result = await this.callApi(endpointUrl);
    return result.value || [];
  }

  async createFolder(driveId: string, parentId: string, folderName: string): Promise<DriveItem> {
    const endpointUrl = parentId === "root"
      ? `${GRAPH_BASE_URL}/drives/${driveId}/root/children`
      : `${GRAPH_BASE_URL}/drives/${driveId}/items/${parentId}/children`;
    const body = {
      name: folderName,
      folder: {}, 
      "@microsoft.graph.conflictBehavior": "rename"
    };
    return await this.callApi(endpointUrl, { method: "POST", body: JSON.stringify(body) });
  }

  async uploadFile(driveId: string, parentId: string = "root", file: File): Promise<DriveItem> {
    const token = await this.getAccessToken();
    const endpointUrl = parentId === "root"
      ? `${GRAPH_BASE_URL}/drives/${driveId}/root:/${file.name}:/content`
      : `${GRAPH_BASE_URL}/drives/${driveId}/items/${parentId}:/${file.name}:/content`;
    
    const response = await fetch(endpointUrl, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": file.type },
      body: file,
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
    return await response.json();
  }

  async fetchFileBlob(downloadUrl: string): Promise<Blob> {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Failed to download file data");
      return await response.blob();
  }

  async getFolderChildrenCount(driveId: string, itemId: string): Promise<number> {
      const endpoint = `${GRAPH_BASE_URL}/drives/${driveId}/items/${itemId}/children?$select=id`;
      const result = await this.callApi(endpoint);
      return result.value ? result.value.length : 0;
  }

  async deleteItem(driveId: string, itemId: string): Promise<void> {
    const endpoint = `${GRAPH_BASE_URL}/drives/${driveId}/items/${itemId}`;
    await this.callApi(endpoint, { method: "DELETE" });
  }

  async renameItem(driveId: string, itemId: string, newName: string): Promise<DriveItem> {
    const endpoint = `${GRAPH_BASE_URL}/drives/${driveId}/items/${itemId}`;
    const body = { name: newName };
    return await this.callApi(endpoint, { method: "PATCH", body: JSON.stringify(body) });
  }

  async createSharingLink(driveId: string, itemId: string, type: 'view' | 'edit' | 'embed' = 'view'): Promise<string> {
    const endpoint = `${GRAPH_BASE_URL}/drives/${driveId}/items/${itemId}/createLink`;
    const body = { type: type, scope: "organization" }; 
    const result = await this.callApi(endpoint, { method: "POST", body: JSON.stringify(body) });
    return result.link.webUrl;
  }

  async getFilePreviewUrl(driveId: string, itemId: string): Promise<string> {
    const endpoint = `${GRAPH_BASE_URL}/drives/${driveId}/items/${itemId}/preview`;
    const result = await this.callApi(endpoint, { method: "POST" });
    return result.getUrl;
  }
}