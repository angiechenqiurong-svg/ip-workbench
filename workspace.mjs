const localOrigin = 'http://127.0.0.1:4317';
const tools = [...document.querySelectorAll('[role="tab"]')];
const panels = new Map(tools.map(tab => [
  tab.getAttribute('aria-controls'), document.getElementById(tab.getAttribute('aria-controls')),
]));
const connections = new Map([...document.querySelectorAll('[data-connect]')].map(button => {
  const panel = panels.get(button.dataset.connect);
  return [button.dataset.connect, {
    button, frame: panel.querySelector('iframe'), notice: panel.querySelector('[role="status"]'),
    placeholder: panel.querySelector('[data-connection]'), timer: null, ready: false,
  }];
}));
let pendingVideo = null;

function choose(name, updateAddress = true) {
  if (!panels.has(name)) name = 'story';
  for (const tab of tools) {
    const active = tab.getAttribute('aria-controls') === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const [key, panel] of panels) panel.hidden = key !== name;
  if (updateAddress) history.replaceState(null, '', '#' + name);
}

for (const [index, tab] of tools.entries()) {
  tab.addEventListener('click', () => choose(tab.getAttribute('aria-controls')));
  tab.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowRight') target = tools[(index + 1) % tools.length];
    if (event.key === 'ArrowLeft') target = tools[(index + tools.length - 1) % tools.length];
    if (event.key === 'Home') target = tools[0];
    if (event.key === 'End') target = tools[tools.length - 1];
    if (!target) return;
    event.preventDefault();
    choose(target.getAttribute('aria-controls'));
    target.focus();
  });
}

function reportFailure(name) {
  const connection = connections.get(name);
  clearTimeout(connection.timer);
  connection.timer = null;
  connection.button.disabled = false;
  connection.notice.textContent = name === 'accounts'
    ? '请启动本机工作台，并在 Chrome 启用「爆款视频拆解工作台」0.5.6 或更新版本。'
    : '没连到本机拆解台。请确认工作台已启动，并在 Chrome 提示时允许访问本机。';
}

function attach(name, url) {
  const connection = connections.get(name);
  connection.ready = false;
  clearTimeout(connection.timer);
  connection.timer = setTimeout(() => reportFailure(name), 12000);
  if (name === 'accounts') {
    connection.placeholder.closest('[role="tabpanel"]').classList.add('pending-frame');
    connection.frame.hidden = false;
  }
  connection.frame.src = url;
}

function connectVideo() {
  const connection = connections.get('video');
  connection.button.disabled = true;
  connection.notice.textContent = '正在连接这台电脑上的爆款拆解台…';
  attach('video', localOrigin + '/ip-video');
}
connections.get('video').button.addEventListener('click', connectVideo);

connections.get('accounts').button.addEventListener('click', () => {
  const connection = connections.get('accounts');
  connection.button.disabled = true;
  connection.notice.textContent = '正在读取当前 Chrome 中的账号库…';
  attach('accounts', localOrigin + '/ip-accounts/');
});

function showReferenceVideo(url) {
  pendingVideo = url;
  choose('video');
  const connection = connections.get('video');
  if (connection.ready) sendReferenceVideo(connection);
  else if (connection.timer === null) connectVideo();
}

function sendReferenceVideo(connection) {
  if (!pendingVideo) return;
  connection.frame.contentWindow.postMessage({ type: 'ip-workbench:prefill-video', url: pendingVideo }, localOrigin);
  pendingVideo = null;
}

window.addEventListener('message', event => {
  if (event.origin !== localOrigin) return;
  const type = event.data?.type;
  if (type === 'ip-workbench:open-video') {
    if (event.source === connections.get('accounts').frame.contentWindow &&
        typeof event.data.url === 'string' && event.data.url.length <= 512) showReferenceVideo(event.data.url);
    return;
  }
  const name = type === 'ip-workbench:video-ready' ? 'video'
    : ['ip-workbench:accounts-ready', 'ip-workbench:accounts-unavailable'].includes(type) ? 'accounts' : null;
  const connection = connections.get(name);
  if (!connection || event.source !== connection.frame.contentWindow) return;
  clearTimeout(connection.timer);
  connection.timer = null;
  if (type === 'ip-workbench:accounts-unavailable') {
    reportFailure(name);
    return;
  }
  connection.placeholder.closest('[role="tabpanel"]').classList.remove('pending-frame');
  connection.placeholder.hidden = true;
  connection.frame.hidden = false;
  connection.ready = true;
  if (name === 'video') sendReferenceVideo(connection);
  if (name === 'accounts') {
    connection.frame.contentWindow.postMessage({ type: 'ip-workbench:enable-breakdown-links' }, localOrigin);
  }
});

window.addEventListener('hashchange', () => choose(location.hash.slice(1), false));
choose(location.hash.slice(1), false);
