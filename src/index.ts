import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.TRELLO_API_KEY!;
const TOKEN = process.env.TRELLO_TOKEN!;

function log(...args: unknown[]): void {
  console.error("[mcp-trello]", ...args);
}

async function trelloFetch(path: string, method = "GET", body?: Record<string, unknown>): Promise<unknown> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `https://api.trello.com/1${path}${separator}key=${API_KEY}&token=${TOKEN}`;

  const options: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Trello API ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

const server = new McpServer({ name: "trello", version: "1.0.0" });

// ── List boards ──
server.tool(
  "list_boards",
  "List all Trello boards for the authenticated user",
  {},
  async () => {
    const boards = (await trelloFetch("/members/me/boards?fields=name,url,closed")) as any[];
    const open = boards.filter((b) => !b.closed);
    const lines = open.map((b) => `- ${b.name}  (id: ${b.id})\n  ${b.url}`);
    return textResult(lines.join("\n") || "No boards found.");
  }
);

// ── List lists ──
server.tool(
  "list_lists",
  "List all lists in a Trello board",
  { board_id: z.string().describe("The board ID") },
  async ({ board_id }) => {
    const lists = (await trelloFetch(`/boards/${board_id}/lists?fields=name,pos`)) as any[];
    const lines = lists.map((l) => `- ${l.name}  (id: ${l.id})`);
    return textResult(lines.join("\n") || "No lists found.");
  }
);

// ── List cards ──
server.tool(
  "list_cards",
  "List all cards in a Trello list",
  { list_id: z.string().describe("The list ID") },
  async ({ list_id }) => {
    const cards = (await trelloFetch(`/lists/${list_id}/cards?fields=name,desc,due,labels,pos,url`)) as any[];
    const lines = cards.map((c) => {
      let line = `- ${c.name}  (id: ${c.id})`;
      if (c.due) line += `  due: ${c.due}`;
      if (c.labels?.length) line += `  labels: ${c.labels.map((l: any) => l.name || l.color).join(", ")}`;
      if (c.desc) line += `\n  ${c.desc.slice(0, 200)}`;
      return line;
    });
    return textResult(lines.join("\n") || "No cards found.");
  }
);

// ── Get card ──
server.tool(
  "get_card",
  "Get detailed information about a specific card",
  { card_id: z.string().describe("The card ID") },
  async ({ card_id }) => {
    const card = (await trelloFetch(`/cards/${card_id}?fields=name,desc,due,dueComplete,labels,url,idList,idBoard&members=true&checklists=all`)) as any;
    const parts = [
      `Name: ${card.name}`,
      `URL: ${card.url}`,
      `Description: ${card.desc || "(none)"}`,
      `Due: ${card.due || "(none)"}  Complete: ${card.dueComplete}`,
      `Labels: ${card.labels?.map((l: any) => l.name || l.color).join(", ") || "(none)"}`,
      `Members: ${card.members?.map((m: any) => m.fullName).join(", ") || "(none)"}`,
    ];
    if (card.checklists?.length) {
      for (const cl of card.checklists) {
        parts.push(`\nChecklist: ${cl.name}`);
        for (const item of cl.checkItems) {
          parts.push(`  [${item.state === "complete" ? "x" : " "}] ${item.name}`);
        }
      }
    }
    return textResult(parts.join("\n"));
  }
);

// ── Create card ──
server.tool(
  "create_card",
  "Create a new card in a Trello list",
  {
    list_id: z.string().describe("The list ID to create the card in"),
    name: z.string().describe("Card title"),
    desc: z.string().optional().describe("Card description"),
    due: z.string().optional().describe("Due date (ISO 8601 format)"),
    pos: z.enum(["top", "bottom"]).optional().describe("Position: top or bottom"),
  },
  async ({ list_id, name, desc, due, pos }) => {
    const params = new URLSearchParams({ name, idList: list_id });
    if (desc) params.set("desc", desc);
    if (due) params.set("due", due);
    if (pos) params.set("pos", pos);
    const card = (await trelloFetch(`/cards?${params.toString()}`, "POST")) as any;
    return textResult(`Card created: ${card.name}\nID: ${card.id}\nURL: ${card.url}`);
  }
);

// ── Update card ──
server.tool(
  "update_card",
  "Update an existing card (name, description, due date, move to another list)",
  {
    card_id: z.string().describe("The card ID"),
    name: z.string().optional().describe("New card title"),
    desc: z.string().optional().describe("New description"),
    due: z.string().optional().describe("New due date (ISO 8601) or empty to remove"),
    list_id: z.string().optional().describe("Move card to this list ID"),
    closed: z.boolean().optional().describe("Archive (true) or unarchive (false) the card"),
  },
  async ({ card_id, name, desc, due, list_id, closed }) => {
    const params = new URLSearchParams();
    if (name !== undefined) params.set("name", name);
    if (desc !== undefined) params.set("desc", desc);
    if (due !== undefined) params.set("due", due);
    if (list_id !== undefined) params.set("idList", list_id);
    if (closed !== undefined) params.set("closed", String(closed));
    const card = (await trelloFetch(`/cards/${card_id}?${params.toString()}`, "PUT")) as any;
    return textResult(`Card updated: ${card.name}\nURL: ${card.url}`);
  }
);

// ── Delete card ──
server.tool(
  "delete_card",
  "Permanently delete a card from Trello",
  { card_id: z.string().describe("The card ID to delete") },
  async ({ card_id }) => {
    await trelloFetch(`/cards/${card_id}`, "DELETE");
    return textResult("Card deleted.");
  }
);

// ── Create list ──
server.tool(
  "create_list",
  "Create a new list in a Trello board",
  {
    board_id: z.string().describe("The board ID"),
    name: z.string().describe("List name"),
    pos: z.enum(["top", "bottom"]).optional().describe("Position: top or bottom"),
  },
  async ({ board_id, name, pos }) => {
    const params = new URLSearchParams({ name, idBoard: board_id });
    if (pos) params.set("pos", pos);
    const list = (await trelloFetch(`/lists?${params.toString()}`, "POST")) as any;
    return textResult(`List created: ${list.name}\nID: ${list.id}`);
  }
);

// ── Create board ──
server.tool(
  "create_board",
  "Create a new Trello board",
  {
    name: z.string().describe("Board name"),
    desc: z.string().optional().describe("Board description"),
  },
  async ({ name, desc }) => {
    const params = new URLSearchParams({ name });
    if (desc) params.set("desc", desc);
    const board = (await trelloFetch(`/boards?${params.toString()}`, "POST")) as any;
    return textResult(`Board created: ${board.name}\nID: ${board.id}\nURL: ${board.url}`);
  }
);

// ── Add comment ──
server.tool(
  "add_comment",
  "Add a comment to a card",
  {
    card_id: z.string().describe("The card ID"),
    text: z.string().describe("Comment text"),
  },
  async ({ card_id, text }) => {
    const params = new URLSearchParams({ text });
    await trelloFetch(`/cards/${card_id}/actions/comments?${params.toString()}`, "POST");
    return textResult("Comment added.");
  }
);

// ── Search ──
server.tool(
  "search",
  "Search for cards and boards in Trello",
  {
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results (default 10)"),
  },
  async ({ query, limit }) => {
    const params = new URLSearchParams({ query, cards_limit: String(limit ?? 10), boards_limit: String(limit ?? 5) });
    const result = (await trelloFetch(`/search?${params.toString()}`)) as any;
    const parts: string[] = [];
    if (result.boards?.length) {
      parts.push("## Boards");
      for (const b of result.boards) parts.push(`- ${b.name}  (id: ${b.id})`);
    }
    if (result.cards?.length) {
      parts.push("## Cards");
      for (const c of result.cards) parts.push(`- ${c.name}  (id: ${c.id})\n  ${c.url}`);
    }
    return textResult(parts.join("\n") || "No results found.");
  }
);

// ── Add checklist ──
server.tool(
  "add_checklist",
  "Add a checklist to a card",
  {
    card_id: z.string().describe("The card ID"),
    name: z.string().describe("Checklist name"),
    items: z.array(z.string()).optional().describe("List of checklist item names"),
  },
  async ({ card_id, name, items }) => {
    const checklist = (await trelloFetch(`/cards/${card_id}/checklists?name=${encodeURIComponent(name)}`, "POST")) as any;
    if (items?.length) {
      for (const item of items) {
        await trelloFetch(`/checklists/${checklist.id}/checkItems?name=${encodeURIComponent(item)}`, "POST");
      }
    }
    return textResult(`Checklist "${name}" added with ${items?.length ?? 0} items.`);
  }
);

async function main(): Promise<void> {
  if (!API_KEY || !TOKEN) {
    log("ERROR: TRELLO_API_KEY and TRELLO_TOKEN environment variables are required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server started, listening on stdio");
}

main().catch((err) => {
  log("Fatal error:", err);
  process.exit(1);
});
