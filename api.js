// 九州支社アプリ（GitHub Pages）から、Apps Script「叩きカウンター 九州支社」の doPost を呼ぶ（本社の 32_クローザー入力/アプリ/api.js と同じ作り）。
// 各画面は Apps Script の画面と同じ google.script.run で書いてあるので、ここでそれを API 呼び出しに置き換える。
// 合言葉は最初に1回入れるとスマホに覚えさせる（kPass）。違っていたら入れ直してもらう
const API_URL = 'https://script.google.com/macros/s/AKfycbyq-oN_51JWuE4RZB3BXVCREl6rWCX9o7DOroCg0X7unm-rD6_ntRyPRTk6_MqQ9C4szg/exec';

(function () {
  const KEY = 'kPass';
  const pass = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  let asking = false;

  // text/plain で送ると、ブラウザの事前確認（CORS）が要らない
  function call(fn, args) {
    return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args, pass: pass() }) })
      .catch(() => { throw new Error('通信できません（電波を確認してください）'); })
      .then(r => r.json())
      .then(r => {
        if (r.auth) { askPass(pass() ? '合言葉が違います' : ''); throw new Error('合言葉を入れてください'); }
        if (r.error) throw new Error(r.error);
        return r.result;
      });
  }

  // 前に読んだ結果をスマホに覚えておき、開いたときにすぐ出す（Apps Script は1回の読み込みに数秒かかるため）
  // ONCE：設定・名前の一覧。今日覚えたものがあればそれをすぐ使い、裏で読み直して次に開いたときに使う
  // TWICE：今日の数・予定。覚えたものをすぐ出し、新しいのが届いたら（変わっていれば）もう一度出す
  const ONCE = ['getConfig'];
  const TWICE = ['getTodayGoal', 'custList', 'kpiData'];
  const today = () => new Date().toLocaleDateString('sv-SE');
  const keyOf = (fn, a) => 'jc:' + fn + ':' + JSON.stringify(a) + (ONCE.includes(fn) ? ':' + today() : '');
  const load = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const keep = (k, v) => {
    try { localStorage.setItem(k, v); } catch (e) {
      try { Object.keys(localStorage).filter(x => x.startsWith('jc:')).forEach(x => localStorage.removeItem(x)); localStorage.setItem(k, v); } catch (e2) {}
    }
  };

  // google.script.run.withSuccessHandler(f).withFailureHandler(g).関数名(引数) と同じ書き方で使えるようにする
  function runner() {
    let ok = () => {}, ng = () => {};
    const p = new Proxy({}, { get(_, k) {
      if (k === 'withSuccessHandler') return f => { ok = f; return p; };
      if (k === 'withFailureHandler') return f => { ng = f; return p; };
      return (...a) => {
        if (!ONCE.includes(k) && !TWICE.includes(k)) { call(k, a).then(r => ok(r), e => ng(e)); return; }
        const key = keyOf(k, a), old = load(key);
        if (old) setTimeout(() => ok(JSON.parse(old)), 0);
        call(k, a).then(r => {
          const s = JSON.stringify(r);
          keep(key, s);
          if (!old || (TWICE.includes(k) && s !== old)) ok(r);
        }, e => { if (!old) ng(e); });
      };
    } });
    return p;
  }
  window.google = { script: { get run() { return runner(); } } };

  function askPass(msg) {
    if (asking) return;
    asking = true;
    const show = () => {
      const d = document.createElement('div');
      d.id = 'lfLogin';
      d.innerHTML = '<div class="box"><svg class="mk" viewBox="345 157 536 536" aria-hidden="true"><path fill="#fff" d="M355 425 613 167 846 399H742L716 374 613 477H510L665 322 613 271 458 425Z"/><path fill="#fff" opacity=".55" d="M407 425H458L484 451H381ZM742 399H846L820 425H767Z"/><path fill="#fff" opacity=".8" d="M381 451H484L613 579 767 425H871L613 683Z"/></svg><small>LIEN FORT</small><b>九州支社</b>' +
        '<p></p><input type="password" placeholder="合言葉" autocomplete="current-password"><button>はじめる</button></div>';
      d.querySelector('p').textContent = msg || 'チームの合言葉を入れてください';
      const save = () => {
        const v = d.querySelector('input').value.trim();
        if (!v) return;
        try { localStorage.setItem(KEY, v); } catch (e) {}
        location.reload();
      };
      d.querySelector('button').onclick = save;
      d.querySelector('input').onkeydown = e => { if (e.key === 'Enter') save(); };
      document.body.appendChild(d);
      d.querySelector('input').focus();
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
  if (!pass()) askPass();

  // 画面をスマホに保存しておく（sw.js）
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
