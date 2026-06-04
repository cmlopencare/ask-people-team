const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@notionhq/client');

console.log('=== Ask People Team Bot Starting ===');
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

  console.log('Fetching fresh Notion content...');
  const rootPageId = process.env.NOTION_PAGE_ID;
  let allText = '';

  async function extractPageText(pageId, depth) {
    if (depth > 2) return;
    try {
      const blocks = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
      for (const block of blocks.results) {
        const richText = block[block.type]?.rich_text || block[block.type]?.text || [];
        if (richText.length > 0) {
          const text = richText.map(t => t.plain_text).join('');
          if (text.trim()) allText += text + '\n';
        }
        if (block.type === 'child_page' && depth < 2) {
          allText += `\n--- ${block.child_page.title} ---\n`;
          await extractPageText(block.id, depth + 1);
        } else if (block.has_children && depth < 2) {
          await extractPageText(block.id, depth + 1);
        }
      }
    } catch (err) {
      console.error('Notion fetch error for page', pageId, ':', err.message);
    }
  }

  await extractPageText(rootPageId, 0);
  notionCache = allText;
  cacheTime = Date.now();
  console.log('Notion content fetched, length:', allText.length, 'chars');
  return allText;
}

async function askClaude(question, notionContent) {
  console.log('Calling Claude API...');
  const systemPrompt = `You are the People Assistant for Opencare — a friendly, knowledgeable HR support bot available in Slack. Your role is to answer HR and People Ops questions quickly and accurately.

You have access to Opencare's People Ops policies below. Answer questions based on this content. If the answer isn't in the policies, say so honestly and suggest the employee reach out to the People team directly.

Keep answers concise and friendly. Use bullet points where helpful. Never make up policy details.

IMPORTANT: Do not surface or discuss individual employee salaries, compensation, pay rates, performance ratings, termination details, or other sensitive personal HR data. Direct those questions to GoCo or the People team directly.

--- OPENCARE PEOPLE OPS POLICIES ---
${notionContent}
--- END OF POLICIES ---`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    });
    console.log('Claude API response received');
    return response.content[0].text;
  } catch (err) {
    console.error('Claude API error:', err.message);
    throw err;
  }
}

// ─── Handle @mentions in public AND private channels ───────────────────────
app.event('app_mention', async ({ event, say }) => {
  console.log('app_mention received in channel:', event.channel, '| text:', event.text);

  const question = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!question) {
    await say({ text: "Hi! Ask me anything about Opencare's People Ops policies 👋", thread_ts: event.ts });
    return;
  }

  try {
    await say({ text: '⏳ Looking that up for you...', thread_ts: event.ts });
    console.log('Fetching Notion content...');
    const notionContent = await fetchNotionContent();
    console.log('Calling Claude with question:', question);
    const answer = await askClaude(question, notionContent);
    console.log('Got answer, sending to Slack...');
    await say({ text: answer, thread_ts: event.ts });
    console.log('Reply sent successfully');
  } catch (err) {
    console.error('Error in app_mention handler:', err);
    await say({ text: "Sorry, I ran into an error. Please try again or reach out to the People team directly.", thread_ts: event.ts });
  }
});

// ─── Handle direct messages ─────────────────────────────────────────────────
app.message(async ({ message, say }) => {
  if (message.channel_type !== 'im' || message.subtype) return;
  if (message.text && message.text.includes('<@')) return;

  console.log('DM received from user:', message.user, '| text:', message.text);

  const question = message.text?.trim();
  if (!question) return;

  try {
    await say({ text: '⏳ Looking that up for you...' });
    const notionContent = await fetchNotionContent();
    const answer = await askClaude(question, notionContent);
    await say({ text: answer });
    console.log('DM reply sent successfully');
  } catch (err) {
    console.error('Error in DM handler:', err);
    await say({ text: "Sorry, I ran into an error. Please try again or reach out to the People team directly." });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log('=== Ask People Team Bot is LIVE ===');
})();
