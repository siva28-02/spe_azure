const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
    const containerTypeId = req.query.containerTypeId;
    const authHeader = req.headers.authorization;

    // 1. Validate Request
    if (!containerTypeId || !authHeader) {
        context.res = { status: 400, body: "Missing containerTypeId or Authorization header" };
        return;
    }

    try {
        // 2. Decode User Token (from Frontend) to get their Email
        const token = authHeader.split(" ")[1];
        // Note: In production, verify the signature. For prototype, decoding is okay.
        const decoded = jwt.decode(token); 
        const userEmail = decoded.upn || decoded.unique_name || decoded.email;

        if (!userEmail) {
            context.res = { status: 401, body: "Could not identify user email from token." };
            return;
        }

        context.log(`[Option B] Processing request for: ${userEmail}`);

        // 3. Authenticate as APP (Using Client Secret from local.settings.json)
        // This gives us the high-level permission to see ALL containers.
        const credential = new ClientSecretCredential(
            process.env.TENANT_ID,
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET // Reads "123" from local.settings.json
        );

        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ["https://graph.microsoft.com/.default"],
        });

        const graphClient = Client.initWithMiddleware({ authProvider });

        // 4. List ALL Containers (App-Only Access)
        const response = await graphClient
            .api(`/storage/fileStorage/containers`)
            .version('beta')
            .filter(`containerTypeId eq ${containerTypeId}`)
            .expand('permissions') 
            .get();

        const allContainers = response.value || [];
        const accessibleContainers = [];

        // 5. Server-Side Filtering
        // Check if the calling user (userEmail) exists in the container's permissions
        for (const container of allContainers) {
            const perms = container.permissions || [];
            
            const hasAccess = perms.some(p => {
                const user = p.grantedToV2?.user;
                if (!user) return false;
                
                const upn = user.userPrincipalName || "";
                const email = user.email || "";
                
                return upn.toLowerCase() === userEmail.toLowerCase() || 
                       email.toLowerCase() === userEmail.toLowerCase();
            });

            if (hasAccess) {
                delete container.permissions; // Remove sensitive permission data before returning
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
                details: "Check your local.settings.json for correct Client ID/Secret." 
            }
        };
    }
};