#!/usr/bin/env node
// Lightweight MCP server for Angular Material introspection
// - Lists installed @angular/material components
// - Reads schematics collections to show generator options
// - Can invoke `ng generate` with safe args preview

import { Server, StdioServerTransport } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";

const server = new Server(
    { name: "mcp-angular-material", version: "0.1.0" },
    { capabilities: { tools: {} } }
);

function findWorkspaceRoot(cwd) {
    let dir = cwd;
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, "angular.json"))) return dir;
        dir = path.dirname(dir);
    }
    throw new Error("No angular.json found upwards from " + cwd);
}

function listMaterialPackages(root) {
    const base = path.join(root, "node_modules", "@angular", "material");
    if (!fs.existsSync(base)) return [];
    const entries = fs.readdirSync(base, { withFileTypes: true });
    return entries
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .filter(n => !n.startsWith("."));
}

function readSchematicsCollections(root) {
    // Try Angular CLI & Material schematics
    const candidates = [
        path.join(root, "node_modules", "@angular", "material", "schematics", "collection.json"),
        path.join(root, "node_modules", "@angular", "cli", "lib", "schematics", "collection.json"),
    ];
    const result = {};
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try { result[p] = JSON.parse(fs.readFileSync(p, "utf8")); } catch { }
        }
    }
    return result;
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = req.params.name;
    const args = req.params.arguments || {};
    const cwd = process.cwd();
    const root = findWorkspaceRoot(cwd);

    if (tool === "list-material-components") {
        const comps = listMaterialPackages(root);
        return { content: [{ type: "json", json: { root, components: comps } }] };
    }

    if (tool === "list-schematics") {
        const colls = readSchematicsCollections(root);
        return { content: [{ type: "json", json: { root, collections: colls } }] };
    }

    if (tool === "preview-ng-generate") {
        // Dry-run `ng g` to get a plan, no writes
        const { schematic = "", name = "", extraArgs = [] } = args;
        const cp = await execa("npx", ["-y", "@angular/cli", "g", schematic, name, "--dry-run", ...extraArgs], { cwd: root });
        return { content: [{ type: "text", text: cp.stdout }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${tool}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);