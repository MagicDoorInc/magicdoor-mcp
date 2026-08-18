/**
 * Conversations with tenants, owners and vendors. Chats live on the portal API, alongside the
 * leases and people they are about.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";

const chatId = z.string().describe("The chat id, as returned by list_chats.");

export const chatTools: ToolDefinition[] = [
  {
    name: "list_chats",
    title: "List chats",
    description:
      "The conversations with tenants, owners and vendors, each with its subject, participants and " +
      "latest message. Use for 'what are people asking about' and to find a chat to read.",
    service: "portal",
    path: "chats",
    schema: {
      closed: z.boolean().optional().describe("Only closed conversations when true, only open when false."),
      humanEngagementRequested: z
        .boolean()
        .optional()
        .describe("Only chats where someone asked for a person rather than the assistant."),
      assignedPropertyManagerId: z
        .string()
        .optional()
        .describe("Only chats assigned to this property manager."),
    },
  },
  {
    name: "get_chat",
    title: "Get a chat",
    description:
      "One conversation with its participants, subject, what it is about, and whether it is still " +
      "open. Does not include the messages — use get_chat_messages for those.",
    service: "portal",
    path: "chats/{chatId}",
    schema: { chatId },
  },
  {
    name: "get_chat_messages",
    title: "Read a chat's messages",
    description:
      "The messages in one conversation, newest first. Use to read what was actually said, and " +
      "narrow with before/after when a conversation is long.",
    service: "portal",
    path: "chats/{chatId}/messages",
    schema: {
      chatId,
      take: z.number().int().min(1).max(100).optional().describe("How many messages to return."),
      before: z.string().optional().describe("Only messages sent before this date, YYYY-MM-DD."),
      after: z.string().optional().describe("Only messages sent after this date, YYYY-MM-DD."),
      search: z.string().optional().describe("Only messages containing this text."),
      fileName: z.string().optional().describe("Only messages carrying a file with this name."),
    },
  },
  {
    name: "list_unread_messages",
    title: "List unread messages",
    description:
      "Messages nobody has replied to yet, across every conversation. Use for 'what needs a " +
      "response' and 'what have we missed' questions.",
    service: "portal",
    path: "chats/unread-messages",
    paginated: true,
    schema: {
      messageType: z
        .enum(["Email", "Chat"])
        .optional()
        .describe("Only unread messages of this kind."),
    },
  },
  {
    name: "search_chat_messages",
    title: "Search chat messages",
    description:
      "Find messages across every conversation by their text or an attached file name. Use when " +
      "the question is 'did anyone mention X' rather than about one known chat.",
    service: "portal",
    path: "chats/search",
    paginated: true,
    schema: {
      search: z.string().optional().describe("Text to look for in message bodies."),
      fileName: z.string().optional().describe("Find messages carrying a file with this name."),
    },
  },
];
