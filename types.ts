
export interface User {
  displayName: string;
  email: string;
  id?: string;
}

export interface SPEContainer {
  id: string;
  displayName: string;
  description?: string;
  containerTypeId: string;
  createdDateTime: string;
  status?: string;
  customProperties?: Record<string, any>;
  driveId?: string; // Often implied or fetched separately
  size?: number; // Size in bytes
  createdBy?: { user: { displayName: string; email: string } };
}

export interface DriveItem {
  id: string;
  name: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: { id: string; path: string; driveId: string };
  createdBy: { user: { displayName: string; email: string } };
  lastModifiedBy: { user: { displayName: string; email: string } };
  '@microsoft.graph.downloadUrl'?: string; // Critical for downloading and viewing non-office files
}

export interface SPEPermission {
  id: string;
  roles: ('reader' | 'writer' | 'manager' | 'owner')[];
  grantedToV2?: {
    user?: { displayName: string; email?: string; id: string };
    group?: { displayName: string; id: string };
    application?: { displayName: string; id: string };
  };
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  ALL_CONTAINERS = 'ALL_CONTAINERS',
  CONTAINER_DETAILS = 'CONTAINER_DETAILS',
  PERMISSIONS = 'PERMISSIONS',
}

export interface SearchResult {
  id: string;
  title: string;
  type: 'container' | 'file' | 'folder';
  subTitle?: string;
  size?: number;
  data: any; // The original object
}
