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

async function getPageText(blockId) {
  try {
    const response = await notion.blocks.children.list({ block_id: blockId });
    let text = '';
    for (const block of response.results) {
      if (block.paragraph?.rich_text) {
        text += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n';
      }
      if (block.heading_1?.rich_text) {
        text += block.heading_1.rich_text.map(t => t.plain_text).
