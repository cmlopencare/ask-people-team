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

const normalizeId = (id) => (id || '').replace(/-/g, '');

async function getPageText(pageId) {
  try {
    const response = await notion.blocks.children.list({ block_id: pageId });
    let text = '';
    for (const block of response.results) {
      if (block.paragraph?.rich_text) {
        text += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.heading_1?.rich_text) {
        text += '# ' + block.heading_1.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.heading_2?.rich_text) {
        text += '## ' + block.heading_2.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.heading_3?.rich_text) {
        text += '### ' + block.heading_3.rich_text.map(t => t.plain_text).join('') + '\n';
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
    console.error('getPageText error:', e.message);
    return '';
  }
}

async function getNotionContent() {
  try {
    const peopleOpsId = process.env.NOTION_PAGE_ID;
    const response = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 50,
    });
    const peopleOpsPages = response.results.filter(page => {
      return normalizeId(page.id) === normalizeId(peopleOpsId) ||
             normalizeId(page.parent?.page_id || '') === normalizeId(peopleOpsId);
    });
    console.log('People Ops pages found:', peopleOpsPages.length);
    let allText = '';
    for (const page of peopleOpsPages) {
      const title = page.properties?.title?.title?.[0]?.plain_text ||
                    page.properties?.Name?.title?.[0]?.plain_text ||
                    'Untitled';
      console.log('Reading page:', title);
      allText += '\n\n# ' + title + '\n';
      allText += await getPageText(page.id);
    }
    return allText;
  } catch (e) {
    console.error('getNotionContent error:', e.message);
    return '';
  }
}

async function askClaude(question, notionContent) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: 'You are Opencare HR assistant. Use the HR documentation below to answer the employee question accurately and concisely. If the answer is not in the documentation, say so politely and suggest they contact the People team directly.\n\nHR Documentation:\n' + notionContent + '\n\nEmployee question: ' + question
    }]
  });
  return response.content[0].text;
}

slack.event('app_mention', async ({ event, say }) => {
  console.log('app_mention received:', event.text);
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

slack.ev
