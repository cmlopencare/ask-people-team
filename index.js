const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@notionhq/client');

console.log('Starting up...');
console.log('SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'SET' : 'MISSING');
console.log('SLACK_APP_TOKEN:', process.env.SLACK_APP_TOKEN ? 'SET' : 'MISSING');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING');
console.log('NOTION_API_KEY:', process.env.NOTION_API_KEY ? 'SET' : 'MISSING');
console.log('NOTION_PAGE_ID:', process.env.NOTION_PAGE_ID ? 'SET' : 'MISSING');

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function getPageText(blockId) {
  try {
    const response = await notion.blocks.children.list({ block_id: blockId });
    let text = '';
    for (const block of response.results) {
      if (block.paragraph?.rich_text) {
        text += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.heading_1?.rich_text) {
        text += block.heading_1.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.heading_2?.rich_text) {
        text += block.heading_2.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.heading_3?.rich_text) {
        text += block.heading_3.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.bulleted_list_item?.rich_text) {
        text += '• ' + block.bulleted_list_item.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.numbered_list_item?.rich_text) {
        text += block.numbered_list_item.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.type === 'child_page') {
        text += '\n## ' + block.child_page.title + '\n';
        text += await getPageText(block.id);
      }
    }
    return text;
  } catch (e) {
    console.error('Notion error:', e.message);
    return '';
  }
}

async function getNotionContent() {
  return await getPageText(process.env.NOTION_PAGE_ID);
}

async function askClaude(question, notionContent) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: 'You are Opencare HR assistant. Use the HR documentation below to answer the employee question accurately and concisely. If the answer is not in the documentation, say so politely and suggest they contact the People team directly.\n\nHR Documentation:\n' + notionContent + '\n\nEmployee question: ' + question
    }]
  });
  return response.content[0].text;
}

slack.event('app_mention', async ({ event, say }) => {
  console.log('app_mention event received:', event.text);
  try {
    const question = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    const notionContent = await getNotionContent();
    const answer = await askClaude(question, notionContent);
    await say({ text: answer, thread_ts: event.ts });
  } catch (e) {
    console.error('app_mention error:', e.message);
    await say({ text: 'Sorry, I ran into an error. Please try again or contact the People team directly.', thread_ts: event.ts });
  }
});

slack.event('message', async ({ event, say }) => {
  if (event.channel_type === 'im' && !event.bot_id) {
    console.log('DM received:', event.text);
    try {
      const notionContent = await getNotionContent();
      const answer = await askClaude(event.text, notionContent);
      await say(answer);
    } catch (e) {
      console.error('DM error:', e.message);
      await say('Sorry, I ran into an error. Please try again or contact the People team directly.');
    }
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

(async () => {
  try {
    await slack.start();
    console.log('Ask People Team bot is running!');
  } catch (e) {
    console.error('Failed to start:', e.message);
  }
})();
