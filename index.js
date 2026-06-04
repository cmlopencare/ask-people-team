const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@notionhq/client');

console.log('Starting up...');
console.log('SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'SET' : 'MISSING');
console.log('SLACK_APP_TOKEN:', process.env.SLACK_APP_TOKEN ? 'SET' : 'MISSING');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING');
console.log('NOTION_API_KEY:', process.env.NOTION_API_KEY ? 'SET' : 'MISSING');
console.log('NOTION_PAGE_ID:', process.env.NOTION_PAGE_ID ? 'SET' : 'MISSING');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Cache Notion content so we don't re-fetch on every message
let notionCache = null;
let cacheTime = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchNotionContent() {
  if (notionCache && cacheTime && Date.now() - cacheTime < CACHE_TTL_MS) {
    console.log('Using cached Notion content');
    return notionCache;
  }

  console.log('Fetching Notion content...');
  const rootPageId = process.env.NOTION_PAGE_ID;
  let allText = '';

  async function extractPageText(pageId, depth = 0) {
    if (depth > 3) return; // Don't go too deep
    try {
      // Get page blocks
      const blocks = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
      for (const block of blocks.results) {
        // Extract text from common block types
        const richText =
          block[block.type]?.rich_text ||
          block[block.type]?.text ||
          [];
        if (richText.length > 0) {
          const text = richText.map(t => t.plain_text).join('');
          if (text.trim()) allText += text + '\n';
        }
        // Recurse into child pages and synced blocks
        if (block.type === 'child_page' && depth < 2) {
          allText += `\n--- ${block.child_page.title} ---\n`;
          await extractPageText(block.id, depth + 1);
        } else if (block.has_children && depth < 2) {
          await extractPageText(block.id, depth + 1);
        }
      }
    } catch (err) {
      console.error(`Error fetching page ${pageId}:`, err.message);
    }
  }

  await extractPageText(rootPageId);
  notionCache = allText;
  cacheTime = Date.now();
  console.log(`Fetched ${allText.length} chars from Notion`);
  return allText;
}

async function askClaude(question, notionContent) {
  const systemPrompt = `You are the People Assistant for Opencare — a friendly, knowledgeable HR support bot available in Slack. Your role is to answer HR and People Ops questions quickly and accurately.

You have access to Opencare's People Ops policies below. Answer questions based on this content. If the answer isn't in the policies, say so honestly and suggest the employee reach out to the People team directly.

Keep answers concise and friendly. Use bullet points where helpful. Never make up policy details.

IMPORTANT: Do not surface or discuss individual employee salaries, compensation, pay rates, performance ratings, termination details, or other sensitive personal HR data. Direct those questions to GoCo or the People team directly.

--- OPENCARE PEOPLE OPS POLICIES ---
${notionContent}
--- END OF POLICIES ---`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  });

  return response.content[0].text;
}

// ─── Handle @mentions in public AND private channels ───────────────────────
app.event('app_mention', async ({ event, say }) => {
  console.log('app_mention event received in channel:', event.channel, 'type:', event.channel_type);

  // Strip the bot mention from the text
  const question = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!question) {
    await say({ text: "Hi! Ask me anything about Opencare's People Ops policies 👋", thread_ts: event.ts });
    return;
  }

  try {
    await say({ text: '⏳ Looking that up for you...', thread_ts: event.ts });
    const notionContent = await fetchNotionContent();
    const answer = await askClaude(question, notionContent);
    await say({ text: answer, thread_ts: event.ts });
  } catch (err) {
    console.error('Error handling app_mention:', err);
    await say({ text: "Sorry, I ran into an error. Please try again or reach out to the People team directly.", thread_ts: event.ts });
  }
});

// ─── Handle direct messages (no @mention needed in DMs) ────────────────────
app.message(async ({ message, say }) => {
  // Only handle DMs (channel_type === 'im') and ignore bot messages / edits
  if (message.channel_type !== 'im' || message.subtype) return;
  // Also ignore if it's already handled by app_mention
  if (message.text && message.text.includes('<@')) return;

  console.log('DM message received from:', message.user);

  const question = message.text?.trim();
  if (!question) return;

  try {
    await say({ text: '⏳ Looking that up for you...' });
    const notionContent = await fetchNotionContent();
    const answer = await askClaude(question, notionContent);
    await say({ text: answer });
  } catch (err) {
    console.error('Error handling DM:', err);
    await say({ text: "Sorry, I ran into an error. Please try again or reach out to the People team directly." });
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log('⚡ Ask People Team bot is running!');
})();
