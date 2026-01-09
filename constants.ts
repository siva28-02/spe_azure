
export const AZURE_CONFIG = {
  clientId: "c582b3a3-178c-4c61-a74a-7dc573048d8e",
  authority: "https://login.microsoftonline.com/1e18978e-9472-41a9-8192-832569049427",
  redirectUri: window.location.origin, // Assumes SPA is running on root
};

export const SHAREPOINT_CONFIG = {
  containerTypeId: "ef6a5119-74cd-49f9-8b05-e14b31985152",
  rootSiteUrl: "https://datacloud32.sharepoint.com/",
};

// Security Group Configuration (RBAC)
export const ROLES = {
  ADMIN_GROUP_ID: "52f9d067-1e01-479f-b7a8-09c66e53fdc3",
  READER_GROUP_ID: "4db54d1a-5328-4f4a-8128-c058d3ea8621"
};

export const SCOPES = [
  "User.Read",
  "Files.ReadWrite.All",
  "FileStorageContainer.Selected",
  "GroupMember.Read.All",
  "User.ReadBasic.All"
];

// --- OPTION B CONFIGURATION ---
// 1. Run your Azure Function locally (usually runs on port 7071).
// 2. The Client Secret ("123") goes in the Azure Function's 'local.settings.json', NOT here.
export const API_SERVER_URL = "http://localhost:7071/api/listContainers";

// Set to false to ensure we hit the real API
export const ENABLE_MOCK_FALLBACK = false;
