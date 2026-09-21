'use strict';

const accountList = document.getElementById('accounts');

function renderAccounts(accounts) {
  accountList.replaceChildren();

  for (const account of accounts) {
    const item = document.createElement('li');

    const name = document.createElement('input');
    name.type = 'text';
    name.value = account.name;
    name.addEventListener('change', () => {
      window.app.accounts.rename(account.id, name.value.trim() || account.id);
    });

    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    // Removing the last account would leave nothing to show, and the config
    // layer would just recreate a default one anyway.
    remove.disabled = accounts.length < 2;
    remove.addEventListener('click', async () => {
      await window.app.accounts.remove(account.id);
      load();
    });

    item.append(name, remove);
    accountList.appendChild(item);
  }
}

document.getElementById('add-account').addEventListener('click', async () => {
  await window.app.accounts.add();
  load();
});

async function load() {
  const state = await window.app.settings.get();

  for (const input of document.querySelectorAll('[data-pref]')) {
    input.checked = Boolean(state.prefs[input.dataset.pref]);
    input.onchange = () => window.app.settings.set(input.dataset.pref, input.checked);
  }

  document.getElementById('tray-note').hidden = state.trayAvailable;
  document.getElementById('versions').textContent =
    `Version ${state.versions.app} — Electron ${state.versions.electron}, Chromium ${state.versions.chromium}`;

  renderAccounts(state.accounts);
}

load();
