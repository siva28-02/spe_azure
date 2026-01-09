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

    // 1. Validate Request
    if (!containerTypeId || !authHeader) {
        context.res = { status: 400, body: "Missing containerTypeId or Authorization header" };
        return;
    }

    try {
        // 2. Decode User Token
        const token = authHeader.split(" ")[1];
        const decoded = jwt.decode(token); 
        const userEmail = decoded.upn || decoded.unique_name || decoded.email;
        let userId = decoded.oid; // Object ID is preferred for Group lookups

        if (!userEmail) {
            context.res = { status: 401, body: "Could not identify user email from token." };
            return;
        }

        context.log(`[Option B] Processing request for: ${userEmail} (OID: ${userId})`);

        // 3. Authenticate as APP
        const credential = new ClientSecretCredential(
            process.env.TENANT_ID,
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET 
        );

        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ["https://graph.microsoft.com/.default"],
        });

        const graphClient = Client.initWithMiddleware({ authProvider });

        // 4. Fetch User's Group Memberships (CRITICAL FOR RBAC)
        // If we don't have an OID, fetch ID by email first
        if (!userId) {
            try {
                const userRes = await graphClient.api(`/users/${userEmail}`).select('id').get();
                userId = userRes.id;
            } catch (e) {
                context.log.error(`Could not find user ID for email ${userEmail}`);
            }
        }

        const userGroupIds = new Set();
        if (userId) {
            try {
                // transitiveMemberOf gets nested groups too
                const groupsRes = await graphClient.api(`/users/${userId}/transitiveMemberOf`)
                    .select('id')
                    .top(999)
                    .get();
                
                (groupsRes.value || []).forEach(g => userGroupIds.add(g.id));
                context.log(`[Option B] User belongs to ${userGroupIds.size} groups.`);
            } catch (e) {
                context.log.error("Failed to fetch user groups", e.message);
            }
        }

        // 5. DEMO RULE: 
        // If user is in the READER_GROUP or ADMIN_GROUP, they get access to ALL containers.
        // This solves the issue where permissions weren't explicitly stamped on the container.
        const isGlobalReader = userGroupIds.has(ROLES.READER_GROUP_ID);
        const isGlobalAdmin = userGroupIds.has(ROLES.ADMIN_GROUP_ID);
        
        const response = await graphClient
            .api(`/storage/fileStorage/containers`)
            .version('beta')
            .filter(`containerTypeId eq ${containerTypeId}`)
            .expand('permissions') 
            .get();

        const allContainers = response.value || [];

        // If Global Reader/Admin, return everything immediately
        if (isGlobalReader || isGlobalAdmin) {
            context.log(`[Option B] User is Global Reader/Admin. Returning all ${allContainers.length} containers.`);
            // Strip permissions before returning to client for cleanliness
            allContainers.forEach(c => delete c.permissions);
            
            context.res = {
                status: 200,
                body: { containers: allContainers }
            };
            return;
        }

        // 6. Standard Filtering (Fall back to checking specific container permissions)
        const accessibleContainers = [];
        
        for (const container of allContainers) {
            const perms = container.permissions || [];
            
            const hasAccess = perms.some(p => {
                // Check User
                const user = p.grantedToV2?.user;
                if (user) {
                    const upn = user.userPrincipalName || "";
                    const email = user.email || "";
                    if (upn.toLowerCase() === userEmail.toLowerCase() || 
                        email.toLowerCase() === userEmail.toLowerCase()) {
                        return true;
                    }
                }
                // Check Group
                const group = p.grantedToV2?.group;
                if (group && group.id && userGroupIds.has(group.id)) {
                    return true;
                }
                return false;
            });

            if (hasAccess) {
                delete container.permissions; 
                accessibleContainers.push(container);
            }
        }

        context.log(`[Option B] Filtered ${allContainers.length} containers down to ${accessibleContainers.length} for ${userEmail}.`);

        context.res = {
            status: 200,
            body: { containers: accessibleContainers }
        };

    } catch (error) {
        context.log.error(error);
        context.res = {
            status: 500,
            body: { 
                error: error.message,
                details: "Check function logs." 
            }
        };
    }
};