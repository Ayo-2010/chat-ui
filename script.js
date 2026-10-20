var EMOJIS = ['😀', '😂', '🤝', '👍', '🎉', '🔥', '❤️', '🙏', '🚀', '☕'];

var CONVOS = [
  {
    id: 'design',
    name: 'Design team',
    initial: 'D',
    color: '#4f46e5',
    preview: 'Pushed the new component set',
    replies: [
      'Got it. I will update the Figma file and ping you when it is ready.',
      'That works for me. Let us review it together after standup.',
      'Nice catch. I will fix the spacing on the header before the demo.',
      'I pushed a fresh build, could you give the navigation a quick look?'
    ],
    seed: [
      { from: 'them', text: 'Morning! I pushed the new component set to review.', ago: 1580 },
      { from: 'me', text: 'Great, I will take a look right after standup.', ago: 1570 },
      { from: 'them', text: 'No rush. Focus on the nav states first.', ago: 1565 },
      { from: 'them', text: 'How is the button rollout looking?', ago: 42 },
      { from: 'me', text: 'Almost done, just tuning the focus rings.', ago: 38 }
    ]
  },
  {
    id: 'weekend',
    name: 'Weekend plans',
    initial: 'W',
    color: '#0ea5a4',
    preview: 'Saturday hike at 8am?',
    replies: [
      'Saturday works. I will bring the snacks and the thermos.',
      'Let us meet at the trailhead, I will share the pin tonight.',
      'Forecast looks clear, should be a good one.',
      'Sounds good, I will text when I roll up.'
    ],
    seed: [
      { from: 'them', text: 'Saturday hike at 8am, are you in?', ago: 120 },
      { from: 'me', text: 'Yes! Which trail were you thinking?', ago: 116 },
      { from: 'them', text: 'The ridge loop, about three hours round trip.', ago: 112 }
    ]
  },
  {
    id: 'support',
    name: 'Support',
    initial: 'S',
    color: '#f59e0b',
    preview: 'Ticket #4821 is resolved',
    replies: [
      'Thanks for the details. I have escalated ticket #4821 to the platform team.',
      'I can see the charge now. A refund will land in your account in three days.',
      'Could you confirm the browser and version you are using?',
      'Happy to help. I will keep this thread open until it is fully resolved.'
    ],
    seed: [
      { from: 'them', text: 'Hello, this is Priya from Support. I am looking at your ticket now.', ago: 300 },
      { from: 'me', text: 'Thanks, the dashboard keeps showing a stale count.', ago: 295 },
      { from: 'them', text: 'Ticket #4821 is resolved. Please refresh and let me know.', ago: 30 }
    ]
  },
  {
    id: 'random',
    name: 'Random',
    initial: 'R',
    color: '#ec4899',
    preview: 'That playlist is unreal',
    replies: [
      'Okay that playlist is unreal, I have had it on repeat all day.',
      'Sending you a link later, it is a weird but great mix.',
      'You were right about that cafe, the flat white is perfect.',
      'Let us plan something next week, it has been a while.'
    ],
    seed: [
      { from: 'me', text: 'Did you listen to the album I sent?', ago: 260 },
      { from: 'them', text: 'That playlist is unreal. Track four is the best one.', ago: 254 }
    ]
  }
];

var KEY_LIST = 'chatter:messages:v1';
var KEY_ACTIVE = 'chatter:active:v1';
var KEY_THEME = 'chatter:theme:v1';

var conversationsEl = document.getElementById('conversations');
var messagesEl = document.getElementById('messages');
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('sendBtn');
var typingEl = document.getElementById('typing');
var emojiBar = document.getElementById('emojiBar');
var themeBtn = document.getElementById('themeBtn');
var statusEl = document.getElementById('status');
var clearBtn = document.getElementById('clearBtn');
var threadName = document.getElementById('threadName');
var threadSub = document.getElementById('threadSub');
var threadAvatar = document.getElementById('threadAvatar');
var composer = document.getElementById('composer');

var store = {};
var activeId = CONVOS[0].id;
var replyIndex = {};
var busy = false;

function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    return;
  }
}

function load() {
  var raw = readRaw(KEY_LIST);
  if (raw) {
    try {
      store = JSON.parse(raw);
    } catch (e) {
      store = {};
    }
  }
  if (!store || typeof store !== 'object') store = {};
  var savedActive = readRaw(KEY_ACTIVE);
  if (savedActive && CONVOS.some(function (c) { return c.id === savedActive; })) {
    activeId = savedActive;
  }
  CONVOS.forEach(function (c) {
    if (!store[c.id]) {
      var now = Date.now();
      store[c.id] = c.seed.map(function (m) {
        return { from: m.from, text: m.text, ts: now - m.ago * 60 * 1000 };
      });
    }
  });
  var theme = readRaw(KEY_THEME);
  if (theme === 'dark' || theme === 'light') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function persist() {
  writeRaw(KEY_LIST, JSON.stringify(store));
  writeRaw(KEY_ACTIVE, activeId);
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function fmtTime(ts) {
  var d = new Date(ts);
  var h = d.getHours();
  var suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return h + ':' + pad(d.getMinutes()) + ' ' + suffix;
}

function dayLabel(ts) {
  var d = new Date(ts);
  var today = new Date();
  var yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getConvo(id) {
  for (var i = 0; i < CONVOS.length; i++) {
    if (CONVOS[i].id === id) return CONVOS[i];
  }
  return CONVOS[0];
}

function previewFor(id) {
  var list = store[id] || [];
  if (!list.length) return 'No messages yet';
  var last = list[list.length - 1];
  return (last.from === 'me' ? 'You: ' : '') + last.text;
}

function renderConversations() {
  conversationsEl.innerHTML = '';
  CONVOS.forEach(function (c) {
    var li = document.createElement('li');
    li.className = 'convo' + (c.id === activeId ? ' active' : '');
    li.setAttribute('tabindex', '0');
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', 'Open conversation with ' + c.name);
    li.dataset.id = c.id;

    var av = document.createElement('div');
    av.className = 'avatar';
    av.style.background = c.color;
    av.textContent = c.initial;

    var body = document.createElement('div');
    body.className = 'convo-body';
    var name = document.createElement('div');
    name.className = 'convo-name';
    name.textContent = c.name;
    var prev = document.createElement('div');
    prev.className = 'convo-preview';
    prev.textContent = previewFor(c.id);
    body.appendChild(name);
    body.appendChild(prev);

    li.appendChild(av);
    li.appendChild(body);
    conversationsEl.appendChild(li);
  });
}

function renderMessages() {
  var convo = getConvo(activeId);
  var list = store[activeId] || [];
  messagesEl.innerHTML = '';
  if (!list.length) {
    var empty = document.createElement('div');
    empty.className = 'day';
    empty.textContent = 'Conversation cleared';
    messagesEl.appendChild(empty);
  }
  var lastDay = null;
  list.forEach(function (m) {
    var key = new Date(m.ts).toDateString();
    if (key !== lastDay) {
      lastDay = key;
      var div = document.createElement('div');
      div.className = 'day';
      div.textContent = dayLabel(m.ts);
      messagesEl.appendChild(div);
    }
    var row = document.createElement('div');
    row.className = 'row ' + (m.from === 'me' ? 'me' : 'them');

    if (m.from !== 'me') {
      var mini = document.createElement('div');
      mini.className = 'mini';
      mini.style.background = convo.color;
      mini.textContent = convo.initial;
      row.appendChild(mini);
    }

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    var text = document.createElement('span');
    text.textContent = m.text;
    var time = document.createElement('span');
    time.className = 'time';
    time.textContent = fmtTime(m.ts);
    bubble.appendChild(text);
    bubble.appendChild(time);
    row.appendChild(bubble);

    messagesEl.appendChild(row);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderThreadHeader() {
  var convo = getConvo(activeId);
  threadName.textContent = convo.name;
  threadSub.textContent = 'Active now';
  threadAvatar.textContent = convo.initial;
  threadAvatar.style.background = convo.color;
  statusEl.textContent = 'Online';
}

function pushMessage(from, text) {
  store[activeId].push({ from: from, text: text, ts: Date.now() });
  persist();
  renderConversations();
  renderMessages();
}

function nextReply(convo) {
  if (replyIndex[convo.id] === undefined) replyIndex[convo.id] = 0;
  var pool = convo.replies;
  var line = pool[replyIndex[convo.id] % pool.length];
  replyIndex[convo.id] = (replyIndex[convo.id] + 1) % pool.length;
  return line;
}

function send() {
  var value = inputEl.value.trim();
  if (!value || busy) return;
  var convoId = activeId;
  var convo = getConvo(convoId);
  pushMessage('me', value);
  inputEl.value = '';
  busy = true;
  setTimeout(function () {
    if (activeId !== convoId) {
      busy = false;
      return;
    }
    typingEl.hidden = false;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 420);
  setTimeout(function () {
    typingEl.hidden = true;
    if (activeId === convoId) {
      pushMessage('them', nextReply(convo));
    } else {
      store[convoId].push({ from: 'them', text: nextReply(convo), ts: Date.now() });
      persist();
      renderConversations();
    }
    busy = false;
    inputEl.focus();
  }, 1500 + Math.random() * 900);
}

function selectConvo(id) {
  if (id === activeId) return;
  activeId = id;
  typingEl.hidden = true;
  busy = false;
  persist();
  renderThreadHeader();
  renderConversations();
  renderMessages();
  inputEl.focus();
}

function buildEmojiBar() {
  EMOJIS.forEach(function (emoji) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = emoji;
    b.setAttribute('aria-label', 'Insert ' + emoji);
    b.addEventListener('click', function () {
      inputEl.value = inputEl.value + emoji;
      inputEl.focus();
    });
    emojiBar.appendChild(b);
  });
}

conversationsEl.addEventListener('click', function (e) {
  var li = e.target.closest('.convo');
  if (li) selectConvo(li.dataset.id);
});

conversationsEl.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var li = e.target.closest('.convo');
  if (!li) return;
  e.preventDefault();
  selectConvo(li.dataset.id);
});

composer.addEventListener('submit', function (e) {
  e.preventDefault();
  send();
});

clearBtn.addEventListener('click', function () {
  store[activeId] = [];
  typingEl.hidden = true;
  persist();
  renderConversations();
  renderMessages();
});

themeBtn.addEventListener('click', function () {
  var root = document.documentElement;
  var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  writeRaw(KEY_THEME, next);
});

window.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    inputEl.focus();
  }
});

load();
renderThreadHeader();
renderConversations();
renderMessages();
buildEmojiBar();
if (window.matchMedia('(hover: hover)').matches) inputEl.focus();
