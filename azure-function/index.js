// This file is no longer used.
// The logic has moved to: listContainers/index.js
module.exports = async function (context, req) {
    context.res = {
        status: 404,
        body: "Please use /api/listContainers"
    };
};