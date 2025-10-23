#!/usr/bin/env node
// MCP server to introspect Express routes (method, path, handlers)

import { Server, StdioServerTransport } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";

const server = new Server(
    { name: "mcp-express-inspector", version: "0.1.0" },
    { capabilities: { tools: {} } }
);

// === Adjust this to your compiled app entry ===
// If you use TS, point to dist/app.js or similar:
const APP_ENTRY = process.env.EXPRESS_APP_ENTRY || "dist/app.js";

function loadApp(cwd) {
    const full = path.join(cwd, APP_ENTRY);
    if (!fs.existsSync(full)) throw new Error("Express app entry not found: " + full);
    // eslint-disable-next-line import/no-dynamic-require
    const mod = require(full);
    const app = mod.default || mod.app || mod;
    if (!app || !app._router) throw new Error("Unable to find Express app with _router");
    return app;
}

function serializeRoutes(app) {
    const stack = app._router?.stack || [];
    const routes = [];
    const visit = (layer, prefix = "") => {
        if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods).filter(Boolean);
            routes.push({
                method: methods.join(",").toUpperCase(),
                path: prefix + layer.route.path,
                handlers: (layer.route.stack || []).map(s => s.name || "anonymous")
            });
        } else if (layer.name === "router" && layer.handle?.stack) {
            const path = layer.regexp?.fast_star ? "" : (layer.regexp?.fast_slash ? "" : (layer.path || ""));
            for (const l of layer.handle.stack) visit(l, prefix + (path || ""));
        }
    };
    for (const l of stack) visit(l, "");
    return routes;
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = req.params.name;
    const cwd = process.cwd();

    if (tool === "list-express-routes") {
        const app = loadApp(cwd);
        const routes = serializeRoutes(app);
        // Optional: sort for readability
        routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
        return { content: [{ type: "json", json: { entry: path.join(cwd, APP_ENTRY), routes } }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${tool}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);