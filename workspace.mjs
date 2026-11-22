const extensionId = 'cldfmkmoeiodmabgocfbghjffhkocfne';
const extensionOrigin = 'chrome-extension://' + extensionId;
const localOrigin = 'http://127.0.0.1:4317';
const tools = [...document.querySelectorAll('[role="tab"]')];
const panels = new Map(tools.map(tab => [
  tab.getAttribute('aria-controls'), document.getElementById(tab.getAttribute('aria-controls')),
]));
const connections = new Map([...document.querySelectorAll('[data-connect]')].map(button => {
  const panel = panels.get(button.dataset.connect);
  return [button.dataset.connect, {
    button, frame: panel.querySelector('iframe'), notice: panel.querySelector('[role="status"]'),
    placeholder: panel.querySelector('[data-connection]'), timer: null,
  }];
}));

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
  connection.button.disabled = false;
  connection.notice.textContent = name === 'accounts'
    ? '请在 Chrome 启用「爆款视频拆解工作台」0.5.5 或更新版本，再点连接。'
    : '没连到本机拆解台。请确认工作台已启动，并在 Chrome 提示时允许访问本机。';
}

function attach(name, url) {
  const connection = connections.get(name);
  clearTimeout(connection.timer);
  connection.timer = setTimeout(() => reportFailure(name), 12000);
  connection.frame.src = url;
}

connections.get('video').button.addEventListener('click', () => {
  const connection = connections.get('video');
  connection.button.disabled = true;
  connection.notice.textContent = '正在连接这台电脑上的爆款拆解台…';
  attach('video', localOrigin + '/ip-video');
});

connections.get('accounts').button.addEventListener('click', () => {
  const connection = connections.get('accounts');
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) {
    reportFailure('accounts');
    return;
  }
  connection.button.disabled = true;
  connection.notice.textContent = '正在读取当前 Chrome 中的账号库…';
  try {
    runtime.sendMessage(extensionId, {type: 'ip-workbench:open-accounts'}, response => {
      if (runtime.lastError || !response?.ok || !URL.canParse(response.frame)) {
        reportFailure('accounts');
        return;
      }
      const url = new URL(response.frame);
      if (url.protocol !== 'chrome-extension:' || url.hostname !== extensionId ||
          url.pathname !== '/account-library.html' || !url.searchParams.has('workspace')) {
        reportFailure('accounts');
        return;
      }
      attach('accounts', url.href);
    });
  } catch {
    reportFailure('accounts');
  }
});

window.addEventListener('message', event => {
  const name = event.origin === localOrigin && event.data?.type === 'ip-workbench:video-ready' ? 'video'
    : event.origin === extensionOrigin && event.data?.type === 'ip-workbench:accounts-ready' ? 'accounts' : null;
  const connection = connections.get(name);
  if (!connection || event.source !== connection.frame.contentWindow) return;
  clearTimeout(connection.timer);
  connection.placeholder.hidden = true;
  connection.frame.hidden = false;
});

window.addEventListener('hashchange', () => choose(location.hash.slice(1), false));
choose(location.hash.slice(1), false);
