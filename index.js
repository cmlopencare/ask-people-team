const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@notionhq/client');

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function getNotionContent() {
  try {
    const response = await notion.blocks.children.list({
      block_id: process.env.NOTION_PAGE_ID,
    });
    return response.results
      .map(block => block.paragraph?.rich_text?.map(t => t.plain_text).join('') || '')
      .filter(Boolean)
      .join('\n');
  } catch (e) {
    return '';
  }
}

async function askClaude(question, notionContent) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are Opencare's HR assistant. Use the HR documentation below to answer the employee's question accurately and concisely. If the answer isn't in the documentation, say so politely and suggest they contact the People team directly.

HR Documentation:
${notionContent}

Employee question: ${question}`
    }]
  });
  return response.content[0].text;
}

slack.event('app_mention', async ({ event, say }) => {
  try {
    const question = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    const notionContent = await getNotionContent();
    const answer = await askClaude(question, notionContent);
    await say({ text: answer, thread_ts: event.ts });
  } catch (e) {
    await say({ text: 'Sorry, I ran into an error. Please try again or contact the People team directly.', thread_ts: event.ts });
  }
});

slack.event('message', async ({ event, say }) => {
  if (event.channel_type === 'im' && !event.bot_id) {
    try {
      const notionContent = await getNotionContent();
      const answer = await askClaude(event.text, notionContent);
      await say(answer);
    } catch (e) {
      await say('Sorry, I ran into an error. Please try again or contact the People team directly.');
    }
  }
});

(async () => {
  await slack.start();
  console.log('Ask People Team bot is running!');
})();
