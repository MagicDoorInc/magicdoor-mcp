/**
 * Conversations with tenants, owners and vendors. Chats live on the portal API, alongside the
 * leases and people they are about.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";

const chatId = z.string().describe("The chat id, as returned by list_chats.");

/**
 * `/chats` answers with every chat the company has ever had — 860 of them, three megabytes, on a
 * real account — because the endpoint takes no pagination. So the listing is trimmed here: the
 * fields that let a model pick the right conversation, and a count of what was left out.
 */
function summariseChats(payload: unknown, args: Record<string, unknown>): unknown {
  const chats = (payload as { chats?: unknown[] })?.chats;
  if (!Array.isArray(chats)) {
    return payload;
  }

  const limit = typeof args.limit === "number" ? args.limit : DEFAULT_CHAT_LIMIT;
  const shown = chats.slice(0, limit).map((chat) => {
    const c = chat as Record<string, unknown>;
    const participants = Array.isArray(c.participants) ? c.participants : [];

    return {
      id: c.id,
      subject: c.subject,
      type: c.type,
      closed: c.closed,
      pinned: c.pinned,
      created: c.created,
      lastMessageSentAt: c.lastMessageSentAt,
      messageCount: c.messageCount,
      unreadMessages: c.unreadMessages,
      propertyId: c.propertyId,
      unitId: c.unitId,
      participantCount: participants.length,
      latestMessagePreview: previewOf(c.latestMessage),
    };
  });

  return {
    chats: shown,
    totalCount: chats.length,
    omitted: Math.max(0, chats.length - shown.length),
    note:
      chats.length > shown.length
        ? `Showing ${shown.length} of ${chats.length} chats. Raise limit, or filter by closed or ` +
          `assignedPropertyManagerId, to see others. Use get_chat and get_chat_messages for one in full.`
        : undefined,
  };
}

function previewOf(message: unknown): string | undefined {
  const body = (message as { message?: unknown })?.message;
  return typeof body === "string" ? body.slice(0, 140) : undefined;
}

const DEFAULT_CHAT_LIMIT = 25;

export const chatTools: ToolDefinition[] = [
  {
    name: "list_chats",
    title: "List chats",
    description:
      "The conversations with tenants, owners and vendors — subject, type, message count and when " +
      "each was last active. A summary, so use get_chat and get_chat_messages once you have picked " +
      "one. Companies accumulate hundreds of chats, so this returns the most recent unless you " +
      "raise limit or filter.",
    service: "portal",
    path: "chats",
    shape: summariseChats,
    schema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("How many conversations to return. Defaults to 25."),
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
