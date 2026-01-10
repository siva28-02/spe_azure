const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const jwt = require("jsonwebtoken");

// Matches constants.ts IDs
const ROLES = {
    ADMIN_GROUP_ID: "52f9d067-1e01-479f-b7a8-09c66e53fdc3",
    READER_GROUP_ID: "4db54d1a-5328-4f4a-8128-c058d3ea8621"
};

module.exports = async function (context, req) {
    const containerTypeId = req.query.containerTypeId;
    const authHeader = req.headers.authorization;

    if (!containerTypeId || !authHeader) {
        context.res = { status: 400, body: "Missing containerTypeId or Authorization header" };
        return;
    }

    try {
        // 1. Decode User Token to know WHO is asking
        const token = authHeader.split(" ")[1];
        const decoded = jwt.decode(token); 
        const userEmail = (decoded.upn || decoded.unique_name || decoded.email || "").toLowerCase();
        let userId = decoded.oid; 

        context.log(`[Option B] ----------------------------------------------------------------`);
        context.log(`[Option B] INCOMING REQUEST: ${userEmail} (OID: ${userId})`);

        // 2. Authenticate as the BACKEND APP (Service Principal)
        const credential = new ClientSecretCredential(
            process.env.TENANT_ID,
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET 
        );

        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ["https://graph.microsoft.com/.default"],
        });

        const graphClient = Client.initWithMiddleware({ authProvider });

        // 3. Fetch User's Group Memberships (Transitive)
        const userGroupIds = new Set();
        if (userId) {
            try {
                const groupsRes = await graphClient.api(`/users/${userId}/transitiveMemberOf`)
                    .select('id')
                    .top(999)
                    .get();
                (groupsRes.value || []).forEach(g => userGroupIds.add(g.id));
                context.log(`[Option B] User is in ${userGroupIds.size} security groups.`);
            } catch (e) {
                context.log.error(`[Option B] Group Fetch Error: ${e.message}`);
            }
        }

        // 4. Determine Global Roles
        const isGlobalReader = userGroupIds.has(ROLES.READER_GROUP_ID);
        const isGlobalAdmin = userGroupIds.has(ROLES.ADMIN_GROUP_ID);
        
        if (isGlobalAdmin) context.log(`[Option B] Role: DMS_Admin`);
        else if (isGlobalReader) context.log(`[Option B] Role: DMS_Reader`);
        else context.log(`[Option B] Role: Standard User (Checking specific permissions)`);

        // 5. Fetch All Containers the APP can see
        // NOTE: With 'FileStorageContainer.Selected', this ONLY returns containers where the App is a Manager/Owner.
        const response = await graphClient
            .api(`/storage/fileStorage/containers`)
            .version('beta')
            .filter(`containerTypeId eq ${containerTypeId}`)
            // Removed .expand('permissions') as per instruction
            .get();

        const containersAppCanSee = response.value || [];
        context.log(`[Option B] The Backend App has visibility of ${containersAppCanSee.length} containers.`);
        
        if (containersAppCanSee.length === 0) {
            context.log.warn(`[Option B] WARNING: App sees 0 containers. Ensure the App is added as a 'Manager' via servicePrincipal.id`);
        }

        // 6. Fetch Permissions for each container individually and Filter
        let accessibleContainers = [];

        if (isGlobalReader || isGlobalAdmin) {
            // If user is a global reader, they can see everything the App can see
            context.log(`[Option B] User has Global Access. Returning all visible containers.`);
            accessibleContainers = containersAppCanSee;
        } else {
            // Granular Permission Check
            for (const container of containersAppCanSee) {
                let permissions = [];
                try {
                     const permsRes = await graphClient
                        .api(`/storage/fileStorage/containers/${container.id}/permissions`)
                        .version('beta')
                        .get();
                     permissions = permsRes.value || [];
                } catch (permError) {
                     context.log.warn(`[Option B] Failed to get perms for ${container.id}: ${permError.message}`);
                }

                // Check access
                const hasAccess = permissions.some(p => {
                    const grantedUser = p.grantedToV2?.user;
                    const grantedGroup = p.grantedToV2?.group;

                    // 1. Direct User Assignment
                    if (grantedUser) {
                        if (grantedUser.id === userId) return true;
                        
                        // Fallback UPN Match (User ID is sometimes missing in permission response)
                        const pUpn = (grantedUser.userPrincipalName || grantedUser.email || "").toLowerCase();
                        if (pUpn && pUpn === userEmail) return true;
                    }

                    // 2. Group Assignment
                    if (grantedGroup && grantedGroup.id && userGroupIds.has(grantedGroup.id)) return true;

                    return false;
                });

                if (hasAccess) {
                    accessibleContainers.push(container);
                    context.log(`[Option B] MATCH: User has specific access to '${container.displayName}'`);
                }
            }
        }

        context.log(`[Option B] Returning ${accessibleContainers.length} containers to client.`);
        context.log(`[Option B] ----------------------------------------------------------------`);

        context.res = {
            status: 200,
            body: { containers: accessibleContainers }
        };

    } catch (error) {
        context.log.error(`[Option B] CRITICAL ERROR: ${error.message}`);
        context.res = {
            status: 500,
            body: { 
                error: error.message,
                details: "Check function logs for details." 
            }
        };
    }
};