/**
 * Instagram Messaging Service (Milestone 63 / Instagram Bot Integration)
 *
 * Implements Meta Instagram Graph API (v21.0) messaging integration:
 * - Sends text messages to Instagram Direct Message threads
 * - Delivers rich media (moodboards, floorplans, PDF links) to user DMs
 * - Sends quick reply buttons for booking confirmation and budget options
 */

import axios from "axios";

const INSTAGRAM_GRAPH_URL = "https://graph.facebook.com/v21.0";

function getPageAccessToken(): string {
  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "test") {
      return "mock_test_token";
    }
    throw new Error("INSTAGRAM_PAGE_ACCESS_TOKEN is not configured in environment");
  }
  return token;
}

/**
 * Sends a direct text message to an Instagram user (IGSID).
 */
export async function sendInstagramText(recipientId: string, text: string): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    return; // Skip outbound network calls in test mode
  }
  const token = getPageAccessToken();

  // Instagram DM character limit is 1,000 chars per message
  const chunks = splitIntoChunks(text, 950);

  for (const chunk of chunks) {
    await axios.post(
      `${INSTAGRAM_GRAPH_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: chunk },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
  }
}

/**
 * Sends an image attachment (moodboard, floorplan render) directly into an Instagram DM.
 */
export async function sendInstagramImage(recipientId: string, imageUrl: string): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  const token = getPageAccessToken();

  await axios.post(
    `${INSTAGRAM_GRAPH_URL}/me/messages`,
    {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "image",
          payload: {
            url: imageUrl,
            is_reusable: true,
          },
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );
}

/**
 * Sends an event planning option with Quick Reply action buttons to an Instagram user.
 */
export async function sendInstagramQuickReplies(
  recipientId: string,
  text: string,
  quickReplies: Array<{ title: string; payload: string }>
): Promise<void> {
  const token = getPageAccessToken();

  await axios.post(
    `${INSTAGRAM_GRAPH_URL}/me/messages`,
    {
      recipient: { id: recipientId },
      message: {
        text,
        quick_replies: quickReplies.map((q) => ({
          content_type: "text",
          title: q.title.substring(0, 20), // Max 20 chars per Meta spec
          payload: q.payload,
        })),
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );
}

function splitIntoChunks(str: string, size: number): string[] {
  if (str.length <= size) return [str];
  const chunks: string[] = [];
  let remaining = str;

  while (remaining.length > 0) {
    if (remaining.length <= size) {
      chunks.push(remaining);
      break;
    }

    // Try to split on newline or space within the window
    let splitIndex = remaining.lastIndexOf("\n", size);
    if (splitIndex < size / 2) {
      splitIndex = remaining.lastIndexOf(" ", size);
    }
    if (splitIndex < size / 2) {
      splitIndex = size; // Fallback to hard cut
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks.filter((c) => c.length > 0);
}
