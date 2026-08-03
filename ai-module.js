// ==================== AI 助手 ====================
function renderAIPage(){
  return `
    <div class="chat-wrap">
      <div class="chat-messages" id="chatMessages">
        <div class="empty-state">
          <div class="empty-illust">🤖</div>
          <div class="empty-text">你好！我是元の小屋的 AI 助手<br>有什么可以帮你的？</div>
        </div>
      </div>
      <div class="chat-input-wrap">
        <input class="input-field" id="chatInput" placeholder="输入消息..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMessage();}">
        <button class="btn btn-primary" onclick="sendChatMessage()" style="border-radius:20px;padding:10px 20px;min-width:70px;white-space:nowrap;">发送</button>
      </div>
    </div>`;
}

function initAIChat(){
  const msgs = DB.load('chat',[]);
  const container = document.getElementById('chatMessages');
  if(!container) return;

  if(msgs.length > 0){
    container.innerHTML = '';
    msgs.forEach(m => {
      container.appendChild(createMsgEl(m));
    });
    container.scrollTop = container.scrollHeight;
  }
}

function createMsgEl(msg){
  const div = document.createElement('div');
  div.className = `chat-msg ${msg.role}`;
  const avatarIcon = msg.role === 'user' ? '😊' : '🤖';
  const avatarBg = msg.role === 'user' ? 'var(--c-purple-1)' : 'var(--c-pink-1)';

  let content = msg.content || '';
  // 简单 markdown 渲染
  content = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  div.innerHTML = `
    <div class="avatar" style="background:${avatarBg}">${avatarIcon}</div>
    <div>
      <div class="bubble">${content}</div>
      <div class="time">${formatDate(msg.time)}</div>
    </div>
  `;
  return div;
}

async function sendChatMessage(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;

  // 保存用户消息
  const msgs = DB.load('chat',[]);
  msgs.push({role:'user', content:text, time:Date.now()});
  DB.save('chat', msgs);

  // 渲染
  const container = document.getElementById('chatMessages');
  if(container.querySelector('.empty-state')){
    container.innerHTML = '';
  }
  container.appendChild(createMsgEl({role:'user', content:text, time:Date.now()}));
  input.value = '';
  container.scrollTop = container.scrollHeight;

  // 显示 typing
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-msg assistant';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `<div class="avatar" style="background:var(--c-pink-1)">🤖</div><div><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  // 调用 AI
  try {
    const response = await callAI(text, msgs);
    document.getElementById('typingIndicator')?.remove();

    const assistantMsg = {role:'assistant', content:response, time:Date.now()};
    msgs.push(assistantMsg);
    DB.save('chat', msgs);
    container.appendChild(createMsgEl(assistantMsg));
    container.scrollTop = container.scrollHeight;
  } catch(e) {
    document.getElementById('typingIndicator')?.remove();
    const errMsg = {role:'assistant', content:'抱歉，AI 服务暂时不可用，请稍后重试 😢', time:Date.now()};
    msgs.push(errMsg);
    DB.save('chat', msgs);
    container.appendChild(createMsgEl(errMsg));
    container.scrollTop = container.scrollHeight;
  }
}

async function callAI(userMsg, history){
  // 使用免费的 AI 服务
  // 优先尝试本地沙箱环境的 AI，回退到通用方案
  const API_URL = 'https://api.openai.com/v1/chat/completions';

  // 构建上下文：最近10条历史消息
  const recentHistory = history.slice(-11, -1); // 排除刚刚发的那条

  const messages = [
    {
      role: 'system',
      content: `你是「元の小屋」的 AI 助手，一款可爱的个人管理工具。你的角色设定：友好、温暖、带一点可爱的语气。你帮助用户管理目标、打卡习惯、写笔记、实现心愿。回答简洁实用，不超过200字。回答时偶尔使用 emoji 增加亲和力。`
    },
    ...recentHistory.map(m => ({role: m.role, content: m.content})),
    {role: 'user', content: userMsg}
  ];

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.8
      })
    });
    if(!resp.ok) throw new Error('API error');
    const data = await resp.json();
    return data.choices[0].message.content;
  } catch(e) {
    // 回退：本地智能回复
    return getLocalReply(userMsg);
  }
}

function getLocalReply(msg){
  const lower = msg.toLowerCase();
  // 预设回复
  if(lower.includes('你好')||lower.includes('hi')||lower.includes('hello'))
    return '你好呀！我是元の小屋的 AI 助手 🤖 有什么我可以帮你的吗？';
  if(lower.includes('目标')||lower.includes('计划'))
    return '💡 在「目标管理」页面可以创建你的目标哦！设定截止日期，追踪进度条，每一步都看得见~';
  if(lower.includes('打卡')||lower.includes('习惯'))
    return '✅ 去「打卡区」创建每日/每周打卡项目吧！坚持打卡，统计图表会让你看到自己的进步 📈';
  if(lower.includes('笔记')||lower.includes('写写')||lower.includes('记录'))
    return '📝 「随便写写」就是你的数字笔记本！支持插入图片和链接，还有全文搜索哦~';
  if(lower.includes('心愿')||lower.includes('梦想')||lower.includes('愿望'))
    return '⭐ 把心愿写进「心愿清单」吧！每实现一个就点亮一颗星 🌟';
  if(lower.includes('回收')||lower.includes('删除'))
    return '🗑 不用担心误删！所有删除的内容都会进入「回收站」，可以随时恢复~';
  if(lower.includes('统计')||lower.includes('看板')||lower.includes('数据'))
    return '📊 点击左侧「总览看板」查看你的全部数据统计，一目了然！';
  if(lower.includes('时间')||lower.includes('日期'))
    return `现在是 ${new Date().toLocaleString('zh-CN')} 🕐`;
  if(lower.includes('谢谢')||lower.includes('感谢'))
    return '不客气！能帮到你我也很开心 😊 随时来找我聊天~';
  return `收到你的消息啦~ 💜 我会尽力帮你！你可以问我关于目标、打卡、笔记、心愿相关的任何问题。也可以告诉我你想做什么，我帮你出主意 ✨`;
}
