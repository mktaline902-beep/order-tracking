/* Order Summary — mostra o resumo do pedido quando a URL traz ?t=<portal_token>.
   Sem token (e sem ?mock) a página funciona como antes e NENHUMA chamada é feita.
   Contrato da RPC get_order_summary(p_token) -> JSON:
   { order_id, customer_first_name, status, total, currency, created_at,
     tracking_code, carrier, tracking_url, items:[{item_name, qty}] }
   Retorna null quando o token é inválido/expirado. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://frqfwsaokppzlvmiabxo.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_dKYpcMYM02Fb63Z0Ya9zqw_Cu-LX81E';

  var params = new URLSearchParams(window.location.search);
  var token = (params.get('t') || '').trim();
  var mock = params.get('mock');

  // Sem token e sem mock: não faz nada (página padrão, zero requests).
  if (!token && !mock) return;

  var el = document.getElementById('orderSummary');
  if (!el) return;
  el.hidden = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(total, currency) {
    var cur = (currency || 'USD').toUpperCase();
    var n = Number(total);
    if (!isFinite(n)) return esc(total);
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n);
    } catch (e) {
      return cur + ' ' + n.toFixed(2);
    }
  }

  function statusMeta(status, hasTracking) {
    var s = (status || '').toString().toUpperCase();
    if (hasTracking) return { label: 'Shipped', cls: 'is-shipped' };
    if (s === 'DELIVERED') return { label: 'Delivered', cls: 'is-shipped' };
    if (s === 'CANCELLED' || s === 'REFUNDED') return { label: 'Cancelled', cls: 'is-cancelled' };
    return { label: 'Processing', cls: 'is-processing' };
  }

  function renderSkeleton() {
    el.innerHTML =
      '<div class="container"><div class="summary-card summary-skeleton">' +
      '<div class="sk sk-title"></div>' +
      '<div class="sk sk-row"></div><div class="sk sk-row"></div>' +
      '<div class="sk sk-row"></div><div class="sk sk-btn"></div>' +
      '</div></div>';
  }

  function renderNotFound() {
    el.innerHTML =
      '<div class="container"><div class="summary-card summary-muted">' +
      '<h3 class="summary-title">Order Summary</h3>' +
      '<p class="summary-note">We couldn’t find that order link, or it has expired. ' +
      'You can still track your package below using the tracking code from your email.</p>' +
      '<a href="#tracking" class="btn btn-yellow summary-cta">Go to tracking</a>' +
      '</div></div>';
  }

  function renderError() {
    el.innerHTML =
      '<div class="container"><div class="summary-card summary-muted">' +
      '<h3 class="summary-title">Order Summary</h3>' +
      '<p class="summary-note">We had trouble loading your order right now. ' +
      'Please refresh in a moment — or track your package below using the code from your email.</p>' +
      '<a href="#tracking" class="btn btn-yellow summary-cta">Go to tracking</a>' +
      '</div></div>';
  }

  function renderSummary(d) {
    var items = Array.isArray(d.items) && d.items.length
      ? d.items
      : [{ item_name: d.item_name || 'Exclusive Box', qty: d.qty || 1 }];

    var hasTracking = !!(d.tracking_code && String(d.tracking_code).trim());
    var st = statusMeta(d.status, hasTracking);
    var hi = d.customer_first_name ? 'Hi ' + esc(d.customer_first_name) + ', here’s your order' : 'Your order';

    var itemsHtml = items.map(function (it) {
      return '<div class="summary-row"><span>Item</span>' +
        '<span class="summary-value">' + esc(it.item_name || 'Exclusive Box') +
        (Number(it.qty) > 1 ? ' × ' + esc(it.qty) : '') + '</span></div>';
    }).join('');

    var trackingRow = hasTracking
      ? '<div class="summary-row"><span>Tracking</span>' +
        '<span class="summary-value summary-mono">' + esc(d.tracking_code) +
        (d.carrier ? ' <span class="summary-carrier">(' + esc(d.carrier) + ')</span>' : '') +
        '</span></div>'
      : '<div class="summary-row"><span>Tracking</span>' +
        '<span class="summary-value summary-pending">Not available yet</span></div>';

    var actions = hasTracking
      ? '<button type="button" class="btn btn-yellow summary-cta" id="summaryTrackBtn" ' +
        'data-code="' + esc(d.tracking_code) + '">Track my package</button>'
      : '<a href="#tracking" class="btn btn-yellow summary-cta">Track my order</a>';

    el.innerHTML =
      '<div class="container"><div class="summary-card">' +
      '<div class="summary-head">' +
        '<h3 class="summary-title">' + hi + '</h3>' +
        '<span class="summary-badge ' + st.cls + '">' + esc(st.label) + '</span>' +
      '</div>' +
      '<div class="summary-grid">' +
        itemsHtml +
        (Number(items[0] && items[0].qty) > 1 ? '' :
          '<div class="summary-row"><span>Qty</span><span class="summary-value">' +
          esc((items[0] && items[0].qty) || 1) + '</span></div>') +
        '<div class="summary-row"><span>Order ID</span>' +
          '<span class="summary-value summary-mono">' + esc(d.order_id || '') + '</span></div>' +
        trackingRow +
        '<div class="summary-row summary-total"><span>Total</span>' +
          '<span class="summary-value">' + money(d.total, d.currency) + '</span></div>' +
      '</div>' +
      actions +
      '</div></div>';

    var btn = document.getElementById('summaryTrackBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-code') || '';
        var input = document.getElementById('YQNum');
        if (input) input.value = code;
        var sec = document.getElementById('tracking');
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        if (typeof window.doTrack === 'function') setTimeout(window.doTrack, 400);
      });
    }
  }

  // ---- Mock fixtures para teste local sem o banco (?mock=1|processing|invalid) ----
  var FIXTURES = {
    '1': {
      order_id: '3A46C035FE', customer_first_name: 'Alex', status: 'HOLD',
      total: 29.00, currency: 'USD', created_at: '2026-04-13T20:21:41Z',
      tracking_code: 'SDH0094382734', carrier: 'USPS',
      tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=SDH0094382734',
      items: [{ item_name: 'Exclusive Box', qty: 1 }]
    },
    'processing': {
      order_id: '9EF17FF9AF', customer_first_name: 'Sam', status: 'HOLD',
      total: 127, currency: 'USD', created_at: '2026-04-13T20:21:41Z',
      tracking_code: null, carrier: null, tracking_url: null,
      items: [{ item_name: 'Exclusive Box', qty: 2 }]
    },
    'invalid': null
  };

  renderSkeleton();

  if (mock) {
    var key = mock === '1' ? '1' : mock;
    setTimeout(function () {
      var fx = Object.prototype.hasOwnProperty.call(FIXTURES, key) ? FIXTURES[key] : FIXTURES['1'];
      if (fx == null) renderNotFound(); else renderSummary(fx);
    }, 500);
    return;
  }

  // ---- Chamada real à RPC ----
  if (!window.supabase || !window.supabase.createClient) { renderError(); return; }
  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  client.rpc('get_order_summary', { p_token: token }).then(function (res) {
    if (res.error) { console.warn('[order-summary] rpc error', res.error.message); renderError(); return; }
    var data = res.data;
    if (Array.isArray(data)) data = data[0];
    if (!data) { renderNotFound(); return; }
    renderSummary(data);
  }).catch(function (err) {
    console.warn('[order-summary] network error', err && err.message);
    renderError();
  });
})();
