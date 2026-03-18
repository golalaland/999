/* ---------- Free Tonight Modal – Only active trending videos ---------- */
function showHighlightsModal(videos) {
  document.getElementById("highlightsModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "highlightsModal";
  Object.assign(modal.style, {
    position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
    background: "rgba(8,3,25,0.97)",
    backgroundImage: "linear-gradient(135deg, rgba(0,255,234,0.09), rgba(255,0,242,0.14), rgba(138,43,226,0.11))",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "flex-start",
    zIndex: "999999", overflowY: "auto", padding: "20px 12px", boxSizing: "border-box",
    fontFamily: "system-ui, sans-serif"
  });

  // HEADER with charming write-up
  const intro = document.createElement("div");
  intro.innerHTML = `
    <div style="text-align:center; color:#e0b0ff; max-width:640px; margin:0 auto 24px;
                line-height:1.6; font-size:14px;
                background:linear-gradient(135deg,rgba(255,0,242,0.15),rgba(138,43,226,0.12));
                padding:16px 28px; border:1px solid rgba(138,43,226,0.5);
                box-shadow:0 0 20px rgba(255,0,242,0.25); border-radius:16px; position:relative;">
      <div style="margin-bottom:8px;">
        <span style="background:linear-gradient(90deg,#00ffea,#ff00f2,#8a2be2);
                     -webkit-background-clip:text; -webkit-text-fill-color:transparent;
                     font-weight:800; font-size:22px; letter-spacing:0.4px;">
          ◑△◐ Free Tonight ◑△◐
        </span>
      </div>
      <p style="margin:0 0 8px; font-size:15px; font-weight:500; color:#d0b0ff;">
        Real moments, real vibes — no paywalls, no waiting. 
        <br>Just pure connection under the Lagos night sky.
      </p>
      <p style="margin:0; color:#aaa; font-size:13px;">
        Filter by location or city to find your vibe.
      </p>
    </div>
  `;
  modal.appendChild(intro);

  // CLOSE BUTTON
  const closeBtn = document.createElement("div");
  closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke="#00ffea" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "8px",
    right: "10px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: "1002",
    transition: "all 0.25s ease",
    filter: "drop-shadow(0 0 10px rgba(0,255,234,0.7))"
  });
  closeBtn.onmouseenter = () => closeBtn.style.transform = "rotate(90deg) scale(1.2)";
  closeBtn.onmouseleave = () => closeBtn.style.transform = "rotate(0deg) scale(1)";
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeBtn.style.transform = "rotate(180deg) scale(1.35)";
    setTimeout(() => modal.remove(), 280);
  };
  intro.firstElementChild.appendChild(closeBtn);

  // CONTROLS — Enter Location button + tag filters
  const controls = document.createElement("div");
  controls.style.cssText = `
    width:100%; max-width:640px; margin:0 auto 28px;
    display:flex; flex-direction:column; align-items:center; gap:16px;
  `;

  // Enter Location Button
  const locationBtn = document.createElement("button");
  locationBtn.textContent = "Enter Location";
  Object.assign(locationBtn.style, {
    padding: "10px 24px",
    borderRadius: "30px",
    fontSize: "14px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #240046, #3c0b5e)",
    color: "#00ffea",
    border: "1px solid rgba(138,43,226,0.6)",
    cursor: "pointer",
    transition: "all 0.3s",
    boxShadow: "0 4px 12px rgba(138,43,226,0.4)"
  });
  locationBtn.onclick = () => openLocationModal();
  controls.appendChild(locationBtn);

  const tagContainer = document.createElement("div");
  tagContainer.id = "tagButtons";
  tagContainer.style.cssText = `
    display:flex; flex-wrap:wrap; gap:10px; justify-content:center; max-width:500px;
    margin-top:12px; padding:8px 0;
  `;
  controls.appendChild(tagContainer);
  modal.appendChild(controls);

  const grid = document.createElement("div");
  grid.id = "highlightsGrid";
  grid.style.cssText = `
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px; width: 100%; max-width: 960px; margin: 0 auto; padding-bottom: 80px;
  `;
  modal.appendChild(grid);

  // State
  let activeTags = new Set();

  // Location Modal
  function openLocationModal() {
    const locModal = document.createElement("div");
    locModal.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(12px);
      z-index:1000000; display:flex; align-items:center; justify-content:center;
    `;

    const inner = document.createElement("div");
    inner.style.cssText = `
      background:rgba(15,10,26,0.95); border:1px solid rgba(138,43,226,0.5);
      border-radius:20px; padding:32px; max-width:420px; width:90%;
      box-shadow:0 0 40px rgba(138,43,226,0.6); text-align:center;
    `;

    inner.innerHTML = `
      <h3 style="color:#fff; margin-bottom:20px; font-size:20px;">Filter by Location</h3>
      <input type="text" id="locSearch" placeholder="e.g. Lagos, Abuja, Lekki..."
             style="width:100%; padding:14px; background:#0a0a0a; border:1px solid #444; border-radius:12px; color:#fff; font-size:15px; margin-bottom:20px;">
      <button id="goLoc" style="padding:12px 40px; background:linear-gradient(90deg,#ff2e78,#ff5e2e); color:#fff; border:none; border-radius:50px; font-weight:700; cursor:pointer;">
        Go
      </button>
    `;

    locModal.appendChild(inner);
    document.body.appendChild(locModal);

    const input = inner.querySelector("#locSearch");
    const goBtn = inner.querySelector("#goLoc");

    goBtn.onclick = () => {
      const term = input.value.trim().toLowerCase();
      if (term) {
        activeTags.clear();
        activeTags.add(term);
        renderCards(videos);
      }
      locModal.remove();
    };

    input.focus();
  }

  function renderCards(videosToRender = videos) {
    grid.innerHTML = "";
    tagContainer.innerHTML = "";

    let visibleVideos = videosToRender.filter(v => {
      const now = Date.now();
      return v.isTrending === true && (!v.trendingUntil || v.trendingUntil > now);
    });

    if (activeTags.size > 0) {
      visibleVideos = visibleVideos.filter(v => {
        const videoTags = (v.tags || []).map(t => (t || "").trim().toLowerCase());
        if (v.location) videoTags.push(v.location.trim().toLowerCase());
        if (v.city) videoTags.push(v.city.trim().toLowerCase());
        return [...activeTags].every(tag => videoTags.includes(tag));
      });
    }

    const visibleTags = new Set();
    visibleVideos.forEach(v => {
      (v.tags || []).forEach(t => {
        if (t && typeof t === "string" && t.trim()) {
          visibleTags.add(t.trim().toLowerCase());
        }
      });
      if (v.location) visibleTags.add(v.location.trim().toLowerCase());
      if (v.city) visibleTags.add(v.city.trim().toLowerCase());
    });
    const sortedVisibleTags = [...visibleTags].sort();

    sortedVisibleTags.forEach(tag => {
      const btn = document.createElement("button");
      btn.textContent = tag; // no #
      btn.dataset.tag = tag;
      Object.assign(btn.style, {
        padding: "6px 14px",
        borderRadius: "24px",
        fontSize: "12px",
        fontWeight: "600",
        background: activeTags.has(tag) ? "linear-gradient(135deg, #ff2e78, #ff5e9e)" : "rgba(255,46,120,0.2)",
        color: activeTags.has(tag) ? "#fff" : "#ff6ab6",
        border: "1px solid rgba(255,46,120,0.6)",
        cursor: "pointer",
        transition: "all 0.25s"
      });
      btn.onclick = () => {
        if (activeTags.has(tag)) activeTags.delete(tag);
        else activeTags.add(tag);
        renderCards(videosToRender);
      };
      tagContainer.appendChild(btn);
    });

    const filtered = visibleVideos.sort(() => Math.random() - 0.5);

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No one's on Free Tonight right now... check back soon! 🔥";
      empty.style.cssText = "grid-column:1/-1; text-align:center; padding:60px; color:#888; font-size:16px;";
      grid.appendChild(empty);
      return;
    }

    filtered.forEach(video => {
      const card = document.createElement("div");
      Object.assign(card.style, {
        position: "relative", aspectRatio: "9/16", borderRadius: "16px", overflow: "hidden",
        background: "#0f0a1a", cursor: "pointer", boxShadow: "0 4px 20px rgba(138,43,226,0.35)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        border: "1px solid rgba(138,43,226,0.4)"
      });
      card.onmouseenter = () => {
        card.style.transform = "scale(1.03)";
        card.style.boxShadow = "0 12px 32px rgba(255,0,242,0.5)";
      };
      card.onmouseleave = () => {
        card.style.transform = "scale(1)";
        card.style.boxShadow = "0 4px 20px rgba(138,43,226,0.35)";
      };

      const vidContainer = document.createElement("div");
      vidContainer.style.cssText = "width:100%; height:100%; position:relative; background:#000;";

      const videoEl = document.createElement("video");
      videoEl.muted = true; videoEl.loop = true; videoEl.preload = "metadata";
      videoEl.loading = "lazy"; // ← thumbnail caching boost
      videoEl.style.cssText = "width:100%; height:100%; object-fit:cover;";
      videoEl.src = video.previewClip || video.videoUrl || "";
      videoEl.load();
      vidContainer.onmouseenter = (e) => { e.stopPropagation(); videoEl.play().catch(() => {}); };
      vidContainer.onmouseleave = (e) => { e.stopPropagation(); videoEl.pause(); videoEl.currentTime = 0; };

      vidContainer.onclick = (e) => {
        e.stopPropagation();
        openFullScreenVideo(video.videoUrl || "");
      };

      vidContainer.appendChild(videoEl);
      card.appendChild(vidContainer);

      // Info overlay
      const info = document.createElement("div");
      info.style.cssText = `
        position:absolute; bottom:0; left:0; right:0;
        background:linear-gradient(to top, rgba(15,10,26,0.95), transparent);
        padding:60px 12px 12px;
      `;

      const user = document.createElement("div");
      user.textContent = `@${video.uploaderName || "cutie"}`;
      user.style.cssText = "font-size:14px; color:#00ffea; font-weight:700; cursor:pointer; position:relative;";
      user.onclick = (e) => {
        e.stopPropagation();
        if (video.uploaderId) {
          // Restore spinner
          const spinner = document.createElement("div");
          spinner.className = "profile-spinner";
          spinner.style.cssText = `
            position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
            width:20px; height:20px; border:3px solid rgba(0,255,234,0.3);
            border-top:3px solid #00ffea; border-radius:50%; animation:spin 1s linear infinite;
          `;
          user.appendChild(spinner);

          getDoc(doc(db, "users", video.uploaderId))
            .then(userSnap => {
              spinner.remove();
              if (userSnap.exists()) {
                showSocialCard(userSnap.data());
              }
            })
            .catch(err => {
              spinner.remove();
              console.error("Failed to load user:", err);
            });
        }
      };

      // One-liner: A {naturePick} {gender} in her {ageGroup}
      const naturePick = video.naturePick || "";
      const genderRaw = (video.gender || "person").toLowerCase().trim();
      const ageGroup = !video.age ? "20s" : video.age >= 30 ? "30s" : "20s";
      const oneLinerText = naturePick 
        ? `A ${naturePick} ${genderRaw} in her ${ageGroup}`
        : `A ${genderRaw} in her ${ageGroup}`;

      const oneLiner = document.createElement("div");
      oneLiner.textContent = oneLinerText;
      oneLiner.style.cssText = "font-size:11px; color:#aaa; margin-top:4px;";

      // Tags — location & city only, no #
      const tagsEl = document.createElement("div");
      tagsEl.style.cssText = "display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;";

      if (video.location) {
        const span = document.createElement("span");
        span.textContent = video.location.trim();
        span.style.cssText = `
          font-size:11px; padding:2px 8px; border-radius:10px;
          background: rgba(0,255,234,0.3); color: #00ffea;
          border: 1px solid rgba(0,255,234,0.6);
        `;
        tagsEl.appendChild(span);
      }

      if (video.city) {
        const span = document.createElement("span");
        span.textContent = video.city.trim();
        span.style.cssText = `
          font-size:11px; padding:2px 8px; border-radius:10px;
          background: rgba(0,255,234,0.3); color: #00ffea;
          border: 1px solid rgba(0,255,234,0.6);
        `;
        tagsEl.appendChild(span);
      }

      info.append(user, oneLiner, tagsEl);
      card.appendChild(info);

      // FruitPick — tiny standalone emoji, extreme right, reduced glow
      let fruitEl = null;
      if (video.fruitPick) {
        fruitEl = document.createElement("div");
        fruitEl.textContent = video.fruitPick.trim();
        fruitEl.style.cssText = `
          position: absolute;
          bottom: 10px;
          right: 10px;
          font-size: 16px;
          line-height: 1;
          color: #fff;
          text-shadow: 0 0 4px rgba(255,255,255,0.5); /* reduced glow */
          z-index: 3;
        `;
      }

      if (fruitEl) card.appendChild(fruitEl);

      // BADGE — original top-right placement
      const badge = document.createElement("div");
      badge.textContent = "Free Tonight ♡";
      Object.assign(badge.style, {
        position: "absolute",
        top: "12px",
        right: "12px",
        padding: "6px 12px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "700",
        color: "#fff",
        background: "linear-gradient(135deg, #ff3366, #ff9f1c, #ff6b6b)",
        boxShadow: "0 0 18px rgba(255,51,102,0.9)",
        border: "1px solid rgba(255,255,255,0.3)",
        textShadow: "0 0 4px rgba(0,0,0,0.7)"
      });
      card.appendChild(badge);

      grid.appendChild(card);
    });
  }

  // Initial render
  renderCards(videos);
  document.body.appendChild(modal);
}
