'use strict';

const list = document.getElementById('accounts');

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] || '').join('').toUpperCase() || '?';
}

function render(accounts) {
  list.replaceChildren();

  for (const account of accounts) {
    const button = document.createElement('button');
    button.className = account.active ? 'account active' : 'account';
    button.title = account.name;
    button.textContent = initials(account.name);
    button.addEventListener('click', () => window.app.accounts.activate(account.id));

    if (account.unread > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = account.unread > 99 ? '99+' : String(account.unread);
      button.appendChild(badge);
    }

    list.appendChild(button);
  }
}

document.getElementById('add').addEventListener('click', async () => {
  await window.app.accounts.add();
});

document.getElementById('settings').addEventListener('click', () => {
  window.app.settings.open();
});

window.app.accounts.onChanged(render);
window.app.accounts.list().then(render);
