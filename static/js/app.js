(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const BAG_KEY = "zaaya-bag", WISH_KEY = "zaaya-wish";
  const SHIP_FREE = 2999, SHIP_FEE = 99;

  let products = [], byId = {};
  let cat = "all", sort = "featured", q = "", wishOnly = false;
  let bag = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
  let wish = JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
  let picked = null, pickedSize = null;

  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Curated remote editorial photos. Local SVGs remain as graceful fallbacks if a host is unavailable.
  const photoByProduct = {
    "kundan-anarkali": "https://images.pexels.com/photos/13124413/pexels-photo-13124413.jpeg?auto=compress&cs=tinysrgb&w=900",
    "banarasi-saree": "https://images.pexels.com/photos/12850123/pexels-photo-12850123.jpeg?auto=compress&cs=tinysrgb&w=900",
    "bridal-lehenga": "https://images.pexels.com/photos/6739340/pexels-photo-6739340.jpeg?auto=compress&cs=tinysrgb&w=900",
    "chikankari-kurta": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=85",
    "sequin-gown": "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=900&q=85",
    "linen-coord": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85",
    "mustard-sharara": "https://images.pexels.com/photos/6739340/pexels-photo-6739340.jpeg?auto=compress&cs=tinysrgb&w=900",
    "blush-satin-maxi": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=85"
  };
  const media = (p) => `<img src="${photoByProduct[p.id] || `/static/img/${p.id}.svg`}" data-fallback="/static/img/${esc(p.id)}.svg" alt="${esc(p.name)}" loading="lazy" onerror="svgFallback(this)">`;

  const saveBag = () => { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); renderBag(); };
  const saveWish = () => { localStorage.setItem(WISH_KEY, JSON.stringify(wish)); $("#wishCount").textContent = wish.length; renderGrid(); };

  // ----- Catalogue -----
  function visible() {
    const sorters = {
      featured: (a, b) => b.reviews - a.reviews,
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
    };
    return products
      .filter((p) => (cat === "all" || p.category === cat))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .filter((p) => !wishOnly || wish.includes(p.id))
      .sort(sorters[sort]);
  }

  function card(p) {
    const off = Math.round((1 - p.price / p.mrp) * 100);
    const on = wish.includes(p.id);
    return `<article class="card">
      <div class="media" data-name="${esc(p.name)}" data-open="${esc(p.id)}">
        ${p.tag ? `<span class="badge">${esc(p.tag)}</span>` : ""}
        <button class="wish ${on ? "on" : ""}" data-wish="${esc(p.id)}" aria-label="${on ? "Remove from" : "Save to"} wishlist">${on ? "♥" : "♡"}</button>
        ${media(p)}
      </div>
      <div class="info">
        <p class="cat">${esc(p.category)}</p>
        <h3 data-open="${esc(p.id)}">${esc(p.name)}</h3>
        <p class="rate"><b>★ ${p.rating}</b> · ${p.reviews} reviews</p>
        <p class="price"><strong>${inr(p.price)}</strong><s>${inr(p.mrp)}</s><em>${off}% off</em></p>
        <button class="btn" data-open="${esc(p.id)}">Select size</button>
      </div>
    </article>`;
  }

  function renderGrid() {
    const list = visible();
    $("#count").textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}${wishOnly ? " in your wishlist" : ""}`;
    $("#grid").innerHTML = list.length
      ? list.map(card).join("")
      : `<p class="empty">Nothing matches here yet. Try another category or search.</p>`;
  }

  function setCat(c) {
    cat = c;
    wishOnly = false;
    $$("#chips .chip").forEach((x) => x.classList.toggle("on", x.dataset.cat === c));
    $$(".nav a").forEach((x) => x.style.color = "");
    renderGrid();
    updateBottomNav();
  }

  function updateBottomNav() {
    $("#bNavWish").classList.toggle("on", wishOnly);
  }

  // ----- Product modal -----
  function openProduct(id) {
    picked = byId[id];
    pickedSize = null;
    if (!picked) return;
    const p = picked;
    const off = Math.round((1 - p.price / p.mrp) * 100);
    $("#mMedia").className = "modal-media";
    $("#mMedia").dataset.name = p.name;
    $("#mMedia").innerHTML = media(p);
    $("#mCat").textContent = p.category;
    $("#mName").textContent = p.name;
    $("#mRate").textContent = `★ ${p.rating} · ${p.reviews} reviews`;
    $("#mPrice").innerHTML = `<strong>${inr(p.price)}</strong><s>${inr(p.mrp)}</s><em>${off}% off</em>`;
    $("#mSizes").innerHTML = p.sizes.map((s) => `<button class="size" data-size="${esc(s)}">${esc(s)}</button>`).join("");
    $("#mDesc").textContent = p.description;
    $("#mFabric").textContent = `Fabric: ${p.fabric}`;
    $("#mMsg").textContent = "";
    $("#mAdd").disabled = p.stock < 1;
    $("#mAdd").textContent = p.stock < 1 ? "Sold out" : "Add to bag";
    openLayer("#modal");
  }

  // ----- Bag -----
  function addToBag(id, size) {
    const key = `${id}|${size}`;
    const line = bag.find((l) => l.key === key);
    if (line) line.qty++;
    else bag.push({ key, id, size, qty: 1 });
    saveBag();
  }

  function renderBag() {
    let subtotal = 0, count = 0;
    const rows = bag.map((l) => {
      const p = byId[l.id];
      if (!p) return "";
      subtotal += p.price * l.qty;
      count += l.qty;
      return `<div class="line">
        ${`<img src="${photoByProduct[p.id] || `/static/img/${esc(p.id)}.svg`}" data-fallback="/static/img/${esc(p.id)}.svg" alt="" loading="lazy" onerror="svgFallback(this)">`}
        <div>
          <p><strong>${esc(p.name)}</strong></p>
          <p class="rate">Size ${esc(l.size)}</p>
          <div class="qty"><button data-dec="${esc(l.key)}" aria-label="Less">−</button><span>${l.qty}</span><button data-inc="${esc(l.key)}" aria-label="More">+</button></div>
        </div>
        <div style="text-align:right">
          <strong>${inr(p.price * l.qty)}</strong>
          <p><button class="link" data-rm="${esc(l.key)}">Remove</button></p>
        </div>
      </div>`;
    }).join("");
    $("#bagItems").innerHTML = count ? rows : `<div class="empty-bag">Your bag is empty.<br><a class="link" href="#shop" data-close>Continue shopping</a></div>`;

    const shipping = subtotal === 0 || subtotal >= SHIP_FREE ? 0 : SHIP_FEE;
    $("#meter").style.width = Math.min(100, (subtotal / SHIP_FREE) * 100) + "%";
    $("#shipNote").textContent = subtotal >= SHIP_FREE
      ? "You've unlocked free shipping"
      : `Add ${inr(SHIP_FREE - subtotal)} more for free shipping`;
    $("#sub").textContent = inr(subtotal);
    $("#ship").textContent = shipping ? inr(shipping) : "Free";
    $("#total").textContent = inr(subtotal + shipping);
    $("#bagCount").textContent = count;
    $("#placeBtn").disabled = !count;
  }

  // ----- Layers (modal, drawer, overlay) -----
  function openLayer(sel) {
    $(sel).classList.add("open");
    $("#overlay").classList.add("open");
  }

  function closeLayers() {
    ["#modal", "#drawer", "#profileDrawer"].forEach((s) => $(s).classList.remove("open"));
    $("#overlay").classList.remove("open");
  }

  // ----- Data -----
  async function load() {
    products = await (await fetch("/api/products")).json();
    byId = Object.fromEntries(products.map((p) => [p.id, p]));
    renderGrid();
    renderBag();
    $("#wishCount").textContent = wish.length;
  }

  // ----- Events -----
  $("#grid").addEventListener("click", (e) => {
    const w = e.target.closest("[data-wish]");
    if (w) {
      const id = w.dataset.wish;
      wish = wish.includes(id) ? wish.filter((x) => x !== id) : [...wish, id];
      saveWish();
      return;
    }
    const o = e.target.closest("[data-open]");
    if (o) openProduct(o.dataset.open);
  });

  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (b) setCat(b.dataset.cat);
  });

  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-cat-link]");
    if (link) setCat(link.dataset.catLink);
  });

  $("#sort").addEventListener("change", (e) => { sort = e.target.value; renderGrid(); });
  $("#search").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); renderGrid(); });

  $("#mSizes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-size]");
    if (!b) return;
    pickedSize = b.dataset.size;
    $$("#mSizes .size").forEach((x) => x.classList.toggle("on", x === b));
    $("#mMsg").textContent = "";
  });

  $("#mAdd").addEventListener("click", () => {
    if (!picked) return;
    if (!pickedSize) { $("#mMsg").textContent = "Please select a size."; return; }
    addToBag(picked.id, pickedSize);
    closeLayers();
    openLayer("#drawer");
  });

  const openBag = () => openLayer("#drawer");
  $("#bagBtn").addEventListener("click", openBag);
  $("#bNavBag").addEventListener("click", openBag);
  $("#bagClose").addEventListener("click", closeLayers);
  const openProfile = () => { closeLayers(); openLayer("#profileDrawer"); };
  $("#profileBtn").addEventListener("click", openProfile);
  $("#bNavProfile").addEventListener("click", openProfile);
  $("#profileClose").addEventListener("click", closeLayers);
  $("#overlay").addEventListener("click", closeLayers);

  $("#profileLookup").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $("#profileMsg");
    const target = $("#profileDetails");
    msg.className = "msg";
    msg.textContent = "Looking up your orders…";
    target.innerHTML = "";
    try {
      const body = Object.fromEntries(new FormData(form));
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not look up your orders.");
      msg.textContent = "";
      if (!data.orders.length) {
        target.innerHTML = '<div class="profile-empty"><h3>No orders found yet</h3><p>Check your mobile number and email, or place your first ZAAYA order.</p></div>';
        return;
      }
      const p = data.profile || {};
      target.innerHTML = `<section class="profile-details"><p class="eyebrow">YOUR DETAILS</p><h3>${esc(p.name || "Customer")}</h3><p>${esc(p.phone || "")}</p><p>${esc(p.email || "Email not provided")}</p><p>${esc(p.address || "")}${p.pincode ? `, ${esc(p.pincode)}` : ""}</p></section><div class="profile-orders-head"><h3>Your orders</h3><span>${data.orders.length} order${data.orders.length===1?"":"s"}</span></div>` + data.orders.map(o => {
        const items = Array.isArray(o.items) ? o.items : [];
        const steps = ["Order Placed", "Processing", "Shipped", "Delivered"];
        const status = o.status || "Order Placed";
        const step = Math.max(0, steps.indexOf(status));
        return `<article class="order-card"><div class="order-top"><div><small>ORDER ID</small><strong>${esc(o.id)}</strong></div><span class="order-status">${esc(status)}</span></div><p class="order-date">Placed ${esc(o.created_at || "")}</p><div class="order-items">${items.map(i => `<div><span>${esc(i.name)} · ${esc(i.size)} × ${Number(i.qty)||1}</span><b>${inr((Number(i.price)||0)*(Number(i.qty)||1))}</b></div>`).join("")}</div><div class="tracking-steps">${steps.map((st,idx)=>`<div class="tracking-step ${idx<=step?"done":""}"><i></i><span>${st}</span></div>`).join("")}</div><div class="order-bottom"><span>${esc(String(o.payment||"").toUpperCase())}</span><strong>${inr(o.total)}</strong></div></article>`;
      }).join("");
    } catch (err) { msg.className = "msg err"; msg.textContent = err.message || "Please try again."; }
  });
  $("#mClose").addEventListener("click", closeLayers);
  $("#overlay").addEventListener("click", closeLayers);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLayers(); });

  const showWish = () => {
    wishOnly = !wishOnly;
    if (wishOnly) cat = "all";
    $$("#chips .chip").forEach((x) => x.classList.toggle("on", x.dataset.cat === cat && !wishOnly));
    renderGrid();
    updateBottomNav();
    if (wishOnly) $("#shop").scrollIntoView();
  };
  $("#wishBtn").addEventListener("click", showWish);
  $("#bNavWish").addEventListener("click", showWish);

  $("#bagItems").addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    const rm = e.target.closest("[data-rm]");
    const close = e.target.closest("[data-close]");
    if (close) { closeLayers(); return; }
    const key = (inc || dec || rm)?.dataset[inc ? "inc" : dec ? "dec" : "rm"];
    const line = bag.find((l) => l.key === key);
    if (!line) return;
    if (inc) line.qty++;
    else if (dec && --line.qty < 1) bag = bag.filter((l) => l !== line);
    else if (rm) bag = bag.filter((l) => l !== line);
    saveBag();
  });

  $("#checkout").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = $("#coMsg");
    msg.className = "msg";
    msg.textContent = "Placing your order…";
    try {
      const body = {
        ...Object.fromEntries(new FormData(form)),
        items: bag.map((l) => ({ id: l.id, size: l.size, qty: l.qty })),
      };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const lines = bag
        .filter((l) => byId[l.id])
        .map((l) => ({ id: l.id, name: byId[l.id].name, size: l.size, qty: l.qty, price: byId[l.id].price }));
      bag = [];
      saveBag();
      form.reset();
      msg.textContent = "";
      closeLayers();
      await load();
      showSuccess(data, body, lines);
    } catch (err) {
      msg.className = "msg err";
      msg.textContent = err.message || "Something went wrong.";
    }
  });

  function showSuccess(data, body, lines) {
    $("#sName").textContent = body.name.split(" ")[0];
    $("#sId").textContent = data.order_id;
    $("#sPay").textContent = body.payment === "cod" ? "Cash on Delivery" : "UPI";
    $("#sPin").textContent = body.pincode;
    $("#sItems").innerHTML = lines.map((l) =>
      `<div class="s-line"><div><strong>${esc(l.name)}</strong><span>Size ${esc(l.size)} · Qty ${l.qty}</span></div><b>${inr(l.price * l.qty)}</b></div>`
    ).join("");
    $("#sTotal").textContent = inr(data.total);
    $("#success").classList.add("open");
    $("#success").setAttribute("aria-hidden", "false");
    $("#sContinue").focus();
  }

  function closeSuccess() {
    $("#success").classList.remove("open");
    $("#success").setAttribute("aria-hidden", "true");
  }

  $("#sContinue").addEventListener("click", () => {
    closeSuccess();
    $("#shop").scrollIntoView();
  });
  $("#sClose").addEventListener("click", closeSuccess);
  $("#success").addEventListener("click", (e) => { if (e.target.id === "success") closeSuccess(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSuccess(); });

  // Hero product card opens the detail view (grid cards are handled separately).
  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o && !e.target.closest("#grid")) openProduct(o.dataset.open);
  });

  load();
})();
