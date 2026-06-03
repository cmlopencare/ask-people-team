// v7
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

const HR_PAGES = [
  { id: '641d557407534cca99196811b789d2ee', title: 'Benefits Policy (Canada)', keywords: ['benefit', 'canada', 'canadian', 'health', 'dental', 'insurance'] },
  { id: '39422a3ba9094c47a463624bf02cc9bc', title: 'Benefits Policy (US)', keywords: ['benefit', 'us', 'usa', 'united states', 'american', 'health', 'dental', 'insurance'] },
  { id: '4d25c944af864a959b5c47fbcd9950f0', title: 'Information Security Policy', keywords: ['security', 'information', 'data', 'password', 'device'] },
  { id: 'fc4b2c59f9594ed79d567ca9db9e24c5', title: 'Equal Opportunities', keywords: ['equal', 'opportunity', 'discrimination', 'diversity'] },
  { id: 'bc2275153ec24e219539c48b176097dc', title: 'Flexible Working & Meeting Free Wednesday', keywords: ['flexible', 'working', 'remote', 'wednesday', 'meeting', 'work from home', 'wfh'] },
  { id: '06fbb0ca864647b6b263a16cf0441a32', title: 'Unlimited Vacation Policy (HQ)', keywords: ['vacation', 'pto', 'time off', 'holiday', 'leave', 'unlimited'] },
  { id: '41fdacc1b49249c99929a9eb00c9a088', title: 'Disconnecting from Work (HQ)', keywords: ['disconnect', 'after hours', 'work life', 'balance'] },
  { id: '882c8f5a9c9a40e395b6baa8c05afc77', title: 'Expenses & Reimbursements', keywords: ['expense', 'reimburs', 'receipt', 'claim', 'spend', 'cost'] },
  { id: '8cc07d204de44305b09e603502be5f31', title: 'Leaves under ESA (Canada)', keywords: ['leave', 'esa', 'canada', 'absence', 'sick'] },
  { id: '1147c971cf944ead89bfe981c4377813', title: 'Pregnancy + Parental Leave (Canada)', keywords: ['pregnant', 'pregnancy', 'parental', 'maternity', 'paternity', 'baby', 'canada'] },
  { id: '160c91da238e404e8dd2fcfb542aaf2d', title: 'Pregnancy + Parental Leave (USA)', keywords: ['pregnant', 'pregnancy', 'parental', 'maternity', 'paternity', 'baby', 'usa', 'us'] },
  { id: '440e2da6956a46d592e12d5596522edd', title: 'Health & Safety Policy', keywords: ['health', 'safety', 'injury', 'accident', 'workplace'] },
  { id: 'a3af9f6dd6184d0b87e3b499f6e91f13', title: 'Workplace Violence and Harassment Policy', keywords: ['harassment', 'violence', 'bullying', 'discrimination', 'workplace'] },
  { id: '7e1d4b8bc0044fdebe5b026069f7f178', title: 'Promotion Policy & Process', keywords: ['promot', 'promotion', 'career', 'advance', 'raise', 'level up', 'growth'] },
  { id: '464e082bcbcf440291404233770cb6ef', title: 'Company Holidays', keywords: ['holiday', 'holidays', 'statutory', 'public holiday', 'day off', 'closed'] },
  { id: 'cf76d30c9f304e6aa13a5f7db12b1a5b', title: 'Employee Referral Program', keywords: ['referral', 'refer', 'bonus', 'friend', 'recruit'] },
  { id: 'ef290e01522e40538a04e62390b4125e', title: 'Offboarding Info', keywords: ['offboard', 'leaving', 'resign', 'last day', 'exit'] },
  { id: '1c04e3536d444580861bf263973b8451', title: 'Employee Directory', keywords: ['directory', 'contact', 'employee', 'team', 'who is'] },
  { id: '345e7ab8dc0081c898b7f10eb099b111', title: 'MDM/EPP Installation Guide', keywords: ['mdm', 'epp', 'install', 'laptop', 'device', 'computer'] },
  { id: '35ee7ab8dc008097b0dee1a0d4f21a0c', title: 'Employment Verification Letter', keywords: ['verification', 'verify', 'letter', 'employment letter', 'proof of employment'] },
  { id: '513b375f213a4a0192658ee0c8687730', title: 'HQ New Hire Orientation Presentation', keywords: ['onboard', 'orientation', 'new hire', 'first day', 'start'] },
  { id: '496d8bd4774a4d3e8b543d52a81eb5c7', title: "Hiring Manager's Guide to Talent Acquisition", keywords: ['hiring', 'hire', 'recruit', 'interview', 'job posting'] },
  { id: 'bf1646c0511540c78ac3f84a0ca805cb', title: 'Recruiter Guide', keywords: ['recruit', 'hiring', 'candidate', 'interview'] },
  { id: '2a1e7ab8dc0080b6afe4d30695226bcd', title: 'RibbonAI — AI Interviewer', keywords: ['ribbon', 'ai', 'interview', 'automated'] },
  { id: '186fd54388174a859cf27b7a9b3b545b', title: 'Learning + Development Home', keywords: ['learn', 'development', 'training', 'course', 'skill', 'grow'] },
  { id: '690f1db990c34a8c8dc6a081478b4b34', title: 'Performance Reviews', keywords: ['performance', 'review', 'feedback', 'rating', 'evaluation', 'assess'] },
  { id: 'ff6bd4332144464eb8cf63f99522bfbf', title: 'Mental Health Guide', keywords: ['mental health', 'stress', 'anxiety', 'wellbeing', 'wellness', 'burnout'] },
  { id: 'bfd0226f6e954585b3e3fd36294cd80f', title: 'Managing Mental Health Conversations', keywords: ['mental health', 'conversation', 'support', 'manager'] },
  { id: '5d051d9e06424b20ba8fd02ff5f50632', title: 'DEI @ Opencare', keywords: ['dei', 'diversity', 'equity', 'inclusion', 'belonging'] },
  { id: '8fe878dcc94d4bc486fd02f73b7966f4', title: 'Compensation (HQ Team)', keywords: ['compensation', 'salary', 'pay', 'wage', 'comp'] },
  { id: '0567d0a867ee45eab5d35976ebcd6ab2', title: 'Stock Options (HQ Team)', keywords: ['stock', 'option', 'equity', 'shares', 'vesting'] },
  { id: '2f264d7de81a44b0ae8a73e459cac50c', title: 'PH Orientation Documents', keywords: ['philippines', 'ph', 'orientation', 'onboard'] },
  { id: '75af0411087446ebba2a52ffc2d38542', title: 'HIPPA & Device Encryption', keywords: ['hippa', 'hipaa', 'encryption', 'device', 'security', 'privacy'] },
  { id: '3ce4d02ddb6c493ab3bdd53da233ba8a', title: 'Daily Expectation', keywords: ['expectation', 'daily', 'schedule', 'hours', 'work hours'] },
  { id: '747bb2c00f2647a1b08ecf31122b76e4', title: 'HMO', keywords: ['hmo', 'health', 'medical', 'insurance', 'philippines'] },
  { id: 'aeeaff3c96d24df88abb6e53cf402025', title: 'PTO & Holiday Pay Policy', keywords: ['pto', 'holiday pay', 'vacation pay', 'time off'] },
  { id: '30830bf17bbf47a39102a772ef505cf4', title: 'Leave of Absence', keywords: ['leave', 'absence', 'loa', 'time off', 'unpaid'] },
  { id: '102be1b8238345ada6830a27155c3267', title: 'Resignation Guidelines', keywords: ['resign', 'resignation', 'quit', 'notice', 'leaving', 'two weeks'] },
  { id: 'a29d327f836a4bd8b88343ccdf473910', title: 'Stages for Performance Improvement', keywords: ['pip', 'performance improvement', 'improvement plan', 'underperform'] },
];

async function getPageText(pageId) {
  try {
    const response = await notion.blocks.children.list({ block_id: pageId });
    let text = '';
    for (const block of response.results) {
      if (block.paragraph?.rich_text) {
        text += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n';
      } else if (block.heading_1?.rich_text) {
        text += '# ' + block.heading_1.rich_text.map(t => t.plain_text).join('') + '\n';
      } else if (block.heading_2?.rich_text) {
        text += '## ' + block.heading_2.rich_text.map(t => t.plain_text).join('') + '\n';
      } else if (block.heading_3?.rich_text) {
        text += '### ' + block.heading_3.rich_text.map(t => t.plain_text).join('') + '\n';
      } else if (block.bulleted_list_item?.rich_text) {
        text += '• ' + block.bulleted_list_item.rich_text.map(t => t.plain_text).join('') + '\n';
      } else if (block.numbered_list_item?.rich_text) {
        text += block.numbered_list_item.rich_text.map(t => t.plain_text).join('') + '\n';
      } else if (block.type === 'table') {
        const tableRows = await notion.blocks.children.list({ block_id: block.id });
        for (const row of tableRows.results) {
          if (row.type === 'table_row') {
            const cells = row.table_row.cells.map(cell =>
              cell.map(t => t.plain_text).join('')
            );
            text += cells.join(' | ') + '\n';
          }
        }
      } else if (block.type === 'child_page') {
        text += '\n## ' + block.child_page.title + '\n';
        text += await getPageText(block.id);
      } else if (block.type === 'column_list' || block.type === 'column') {
        text += await getPageText(block.id);
      }
    }
    return text;
  } catch (e) {
    console.error('getPageText error:', e.message);
    return '';
  }
}

async function getNotionContent(question) {
  try {
    console.log('Finding relevant pages for:', question);
    const q = question.toLowerCase();
    const relevant = HR_PAGES.filter(page =>
      page.keywords.some(keyword => q.includes(keyword))
    );
    const pagesToRead = relevant.length > 0 ? relevant.slice(0, 4) : HR_PAGES.slice(0, 3);
    console.log('Pages to read:', pagesToRead.map(p => p.title));
    let allText = '';
    for (const page of pagesToRead) {
      allText += '\n## ' + page.title + '\n';
      allText += await getPageText(page.id);
    }
    console.log('Content length:', allText.length);
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
    const notionContent = await getNotionContent(question);
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
      const notionContent = await getNotionContent(event.text);
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
