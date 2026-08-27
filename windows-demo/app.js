(() => {
  "use strict";

  const BOARD = { width: 960, height: 540, grid: 16 };
  const STORAGE_KEY = "spend-city-builder-v3-dynamic-terrain";
  const engine = window.CityTerrainEngine;
  const assets = window.CITY_ASSETS || [];
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const grassImage = new Image();
  grassImage.src = "assets/grass_field.jpg";

  const els = {
    palette: document.getElementById("assetPalette"),
    paletteHint: document.getElementById("paletteHint"),
    canvas: document.getElementById("cityCanvas"),
    terrainCanvas: document.getElementById("terrainCanvas"),
    layer: document.getElementById("placedLayer"),
    reference: document.getElementById("referenceImage"),
    modeText: document.getElementById("modeText"),
    selectionText: document.getElementById("selectionText"),
    terrainStats: document.getElementById("terrainStats"),
    saveStatus: document.getElementById("saveStatus"),
    selectModeBtn: document.getElementById("selectModeBtn"),
    flipBtn: document.getElementById("flipBtn"),
    duplicateBtn: document.getElementById("duplicateBtn"),
    frontBtn: document.getElementById("frontBtn"),
    backBtn: document.getElementById("backBtn"),
    deleteBtn: document.getElementById("deleteBtn"),
    gridBtn: document.getElementById("gridBtn"),
    referenceBtn: document.getElementById("referenceBtn"),
    sampleBtn: document.getElementById("sampleBtn"),
    saveBtn: document.getElementById("saveBtn"),
    loadBtn: document.getElementById("loadBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importInput: document.getElementById("importInput"),
    resetBtn: document.getElementById("resetBtn"),
  };

  const state = {
    items: [],
    selectedAssetId: null,
    selectedItemId: null,
    category: "all",
    showGrid: true,
    showReference: false,
    zCounter: 1,
    geometry: null,
  };

  let statusTimer = null;
  let terrainFrame = 0;

  function makeId() {
    return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function snap(value) {
    return Math.round(value / BOARD.grid) * BOARD.grid;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function currentItem() {
    return state.items.find((item) => item.id === state.selectedItemId) || null;
  }

  function createStarterLayout() {
    const asset = assetMap.get("park_fountain");
    if (!asset) return [];
    return [
      {
        id: makeId(),
        assetId: asset.id,
        x: snap((BOARD.width - asset.defaultWidth) / 2),
        y: snap((BOARD.height - asset.defaultHeight) / 2),
        flipped: false,
        z: 10,
      },
    ];
  }

  function objectSource(asset) {
    return `assets/objects/${asset.id}.png`;
  }

  function isProcedural(asset) {
    return engine.PROCEDURAL_IDS.has(asset.id);
  }

  function showsObjectSprite(asset) {
    return !isProcedural(asset) || asset.id === "rail_crossing";
  }

  function setStatus(text, kind = "saved") {
    clearTimeout(statusTimer);
    els.saveStatus.textContent = text;
    els.saveStatus.className = `status-badge ${kind}`;
    statusTimer = setTimeout(() => {
      els.saveStatus.textContent = "준비됨";
      els.saveStatus.className = "status-badge";
    }, 1800);
  }

  function serialize() {
    return {
      version: 3,
      terrainEngine: "neighbor-aware-derived-v1",
      board: BOARD,
      items: state.items,
      showGrid: state.showGrid,
      showReference: state.showReference,
      savedAt: new Date().toISOString(),
    };
  }

  function validateLayout(data) {
    if (!data || !Array.isArray(data.items)) {
      throw new Error("items 배열이 없는 JSON입니다.");
    }
    return data.items
      .filter((item) => item && assetMap.has(item.assetId))
      .map((item, index) => {
        const asset = assetMap.get(item.assetId);
        return {
          id: typeof item.id === "string" ? item.id : makeId(),
          assetId: item.assetId,
          x: clamp(Number(item.x) || 0, 0, BOARD.width - asset.defaultWidth),
          y: clamp(Number(item.y) || 0, 0, BOARD.height - asset.defaultHeight),
          flipped: Boolean(item.flipped),
          z: Number.isFinite(Number(item.z)) ? Number(item.z) : index + 1,
        };
      });
  }

  function saveLocal(silent = false) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
      if (!silent) setStatus("저장됨");
    } catch (error) {
      console.error(error);
      setStatus("저장 실패", "error");
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus("저장 데이터 없음", "error");
        return;
      }
      const data = JSON.parse(raw);
      state.items = validateLayout(data);
      state.showGrid = data.showGrid !== false;
      state.showReference = Boolean(data.showReference);
      state.zCounter = Math.max(1, ...state.items.map((item) => item.z + 1));
      state.selectedItemId = null;
      state.selectedAssetId = null;
      renderAll();
      setStatus("불러옴");
    } catch (error) {
      console.error(error);
      setStatus("불러오기 실패", "error");
    }
  }

  function renderPalette() {
    const filtered = assets.filter(
      (asset) => state.category === "all" || asset.category === state.category,
    );
    els.palette.innerHTML = "";
    filtered.forEach((asset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `asset-card${state.selectedAssetId === asset.id ? " selected" : ""}`;
      button.title = `${asset.label} 배치`;
      button.innerHTML = `<img src="${asset.src}" alt="" draggable="false"><span>${asset.label}</span>`;
      button.addEventListener("click", () => {
        state.selectedAssetId = asset.id;
        state.selectedItemId = null;
        renderPalette();
        renderSelection();
      });
      els.palette.appendChild(button);
    });
  }

  function buildAndDrawTerrain() {
    state.geometry = engine.buildTerrainGeometry(state.items, assetMap, {
      width: BOARD.width,
      height: BOARD.height,
    });
    engine.drawTerrain(els.terrainCanvas, state.geometry, { grassImage });
    const stats = state.geometry.stats;
    els.terrainStats.textContent = `자동 연결 ${stats.autoConnections} · 진입로 ${stats.driveways} · 변형 지형 ${stats.terrainRegions}`;
  }

  function scheduleTerrainRender() {
    cancelAnimationFrame(terrainFrame);
    terrainFrame = requestAnimationFrame(buildAndDrawTerrain);
  }

  function renderItems() {
    els.layer.innerHTML = "";
    const ordered = [...state.items].sort((a, b) => a.z - b.z);
    ordered.forEach((item) => {
      const asset = assetMap.get(item.assetId);
      if (!asset) return;

      const procedural = isProcedural(asset);
      const node = document.createElement("div");
      node.className = [
        "placed-item",
        procedural ? "procedural-item" : "object-item",
        state.selectedItemId === item.id ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      node.dataset.itemId = item.id;
      node.style.left = `${item.x}px`;
      node.style.top = `${item.y}px`;
      node.style.width = `${asset.defaultWidth}px`;
      node.style.height = `${asset.defaultHeight}px`;
      node.style.zIndex = String(item.z + 100);

      const imageMarkup = showsObjectSprite(asset)
        ? `<div class="sprite-shell" style="transform:scaleX(${item.flipped ? -1 : 1})"><img src="${objectSource(asset)}" alt="${asset.label}" draggable="false"></div>`
        : "";
      const controlMarkup = procedural
        ? `<div class="procedural-control"><span>${asset.label}</span></div>`
        : "";
      node.innerHTML = `${imageMarkup}${controlMarkup}`;
      attachDrag(node, item, asset);
      els.layer.appendChild(node);
    });
    scheduleTerrainRender();
  }

  function applyNetworkSnap(item, asset) {
    if (!isProcedural(asset)) return false;
    const result = engine.snapNetworkItem(item, asset, state.items, assetMap, {
      width: BOARD.width,
      height: BOARD.height,
    });
    if (!result.snapped) return false;
    item.x = result.x;
    item.y = result.y;
    return true;
  }

  function attachDrag(node, item, asset) {
    let pointerId = null;
    let startClientX = 0;
    let startClientY = 0;
    let startX = 0;
    let startY = 0;
    let moved = false;

    node.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      pointerId = event.pointerId;
      startClientX = event.clientX;
      startClientY = event.clientY;
      startX = item.x;
      startY = item.y;
      moved = false;
      state.selectedItemId = item.id;
      state.selectedAssetId = null;
      node.setPointerCapture(pointerId);
      node.classList.add("dragging", "selected");
      renderPalette();
      renderSelection(false);
    });

    node.addEventListener("pointermove", (event) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startClientX;
      const dy = event.clientY - startClientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      item.x = clamp(startX + dx, 0, BOARD.width - asset.defaultWidth);
      item.y = clamp(startY + dy, 0, BOARD.height - asset.defaultHeight);
      node.style.left = `${item.x}px`;
      node.style.top = `${item.y}px`;
      scheduleTerrainRender();
      els.selectionText.textContent = `${asset.label} · x ${Math.round(item.x)}, y ${Math.round(item.y)}${item.flipped ? " · 좌우 반전" : ""}`;
    });

    const finish = (event) => {
      if (pointerId !== event.pointerId) return;
      item.x = clamp(snap(item.x), 0, BOARD.width - asset.defaultWidth);
      item.y = clamp(snap(item.y), 0, BOARD.height - asset.defaultHeight);
      const snapped = applyNetworkSnap(item, asset);
      pointerId = null;
      node.classList.remove("dragging");
      renderItems();
      renderSelection(false);
      if (moved) saveLocal(true);
      if (snapped) setStatus("주변 네트워크에 자동 연결됨");
    };
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);
  }

  function renderSelection(renderLayer = true) {
    const item = currentItem();
    const hasItem = Boolean(item);
    [els.flipBtn, els.duplicateBtn, els.frontBtn, els.backBtn, els.deleteBtn].forEach(
      (button) => (button.disabled = !hasItem),
    );

    if (item) {
      const asset = assetMap.get(item.assetId);
      els.modeText.innerHTML = "<strong>모드:</strong> 오브젝트 편집";
      els.selectionText.textContent = `${asset.label} · x ${Math.round(item.x)}, y ${Math.round(item.y)}${item.flipped ? " · 좌우 반전" : ""}`;
      els.paletteHint.textContent = isProcedural(asset)
        ? "이 에셋은 주변 연결과 지형을 다시 계산합니다."
        : "배치된 에셋을 편집 중입니다.";
    } else if (state.selectedAssetId) {
      const asset = assetMap.get(state.selectedAssetId);
      els.modeText.innerHTML = "<strong>모드:</strong> 배치";
      els.selectionText.textContent = `${asset.label} 선택됨 · 캔버스를 클릭하세요.`;
      els.paletteHint.textContent = `${asset.label} 배치 모드`;
    } else {
      els.modeText.innerHTML = "<strong>모드:</strong> 선택";
      els.selectionText.textContent = "선택된 오브젝트 없음";
      els.paletteHint.textContent = "배치할 에셋을 선택하세요.";
    }
    if (renderLayer) renderItems();
  }

  function renderToggles() {
    els.canvas.classList.toggle("grid-on", state.showGrid);
    els.gridBtn.classList.toggle("active", state.showGrid);
    els.reference.classList.toggle("visible", state.showReference);
    els.referenceBtn.classList.toggle("active", state.showReference);
  }

  function renderAll() {
    renderPalette();
    renderItems();
    renderSelection(false);
    renderToggles();
  }

  function placeSelected(event) {
    if (event.target !== els.canvas && event.target !== els.layer && event.target !== els.terrainCanvas) return;
    if (!state.selectedAssetId) {
      state.selectedItemId = null;
      renderSelection();
      return;
    }
    const asset = assetMap.get(state.selectedAssetId);
    const rect = els.canvas.getBoundingClientRect();
    const item = {
      id: makeId(),
      assetId: asset.id,
      x: clamp(
        snap(event.clientX - rect.left - asset.defaultWidth / 2),
        0,
        BOARD.width - asset.defaultWidth,
      ),
      y: clamp(
        snap(event.clientY - rect.top - asset.defaultHeight / 2),
        0,
        BOARD.height - asset.defaultHeight,
      ),
      flipped: false,
      z: state.zCounter++,
    };
    state.items.push(item);
    const snapped = applyNetworkSnap(item, asset);
    state.selectedItemId = item.id;
    state.selectedAssetId = null;
    renderAll();
    saveLocal(true);
    setStatus(snapped ? "배치 + 네트워크 자동 연결" : "배치 + 지형 재계산");
  }

  function mutateSelected(mutator) {
    const item = currentItem();
    if (!item) return;
    mutator(item);
    renderSelection();
    saveLocal(true);
  }

  function loadSample() {
    const sample = [
      ["road_cross", 400, 200, false, 10],
      ["road_straight_a", 258, 260, false, 11],
      ["road_straight_a", 542, 146, false, 12],
      ["road_straight_b", 258, 143, false, 13],
      ["road_straight_b", 542, 259, false, 14],
      ["rail_straight", 260, 430, false, 15],
      ["rail_straight", 402, 369, false, 16],
      ["rail_crossing", 544, 305, false, 17],
      ["park_fountain", 405, 36, false, 30],
      ["playground", 658, 392, false, 31],
      ["forest_pine", 40, 362, false, 32],
      ["forest_broadleaf", 760, 54, false, 33],
      ["house_red", 90, 216, false, 50],
      ["house_blue", 214, 346, false, 51],
      ["hospital", 690, 150, false, 52],
      ["fire_station", 752, 326, false, 53],
      ["shop_green", 710, 248, false, 54],
    ];
    state.items = sample.map(([assetId, x, y, flipped, z]) => ({
      id: makeId(),
      assetId,
      x,
      y,
      flipped,
      z,
    }));
    state.zCounter = 80;
    state.selectedAssetId = null;
    state.selectedItemId = null;
    renderAll();
    saveLocal(true);
    setStatus("반응형 예시 도시 배치됨");
  }

  els.canvas.addEventListener("pointerdown", placeSelected);

  els.selectModeBtn.addEventListener("click", () => {
    state.selectedAssetId = null;
    state.selectedItemId = null;
    renderAll();
  });
  els.flipBtn.addEventListener("click", () =>
    mutateSelected((item) => (item.flipped = !item.flipped)),
  );
  els.duplicateBtn.addEventListener("click", () => {
    const item = currentItem();
    if (!item) return;
    const asset = assetMap.get(item.assetId);
    const duplicate = {
      ...item,
      id: makeId(),
      x: clamp(snap(item.x + BOARD.grid * 2), 0, BOARD.width - asset.defaultWidth),
      y: clamp(snap(item.y + BOARD.grid * 2), 0, BOARD.height - asset.defaultHeight),
      z: state.zCounter++,
    };
    state.items.push(duplicate);
    applyNetworkSnap(duplicate, asset);
    state.selectedItemId = duplicate.id;
    renderAll();
    saveLocal(true);
  });
  els.frontBtn.addEventListener("click", () =>
    mutateSelected((item) => (item.z = state.zCounter++)),
  );
  els.backBtn.addEventListener("click", () => {
    const minZ = Math.min(0, ...state.items.map((item) => item.z));
    mutateSelected((item) => (item.z = minZ - 1));
  });
  els.deleteBtn.addEventListener("click", () => {
    if (!state.selectedItemId) return;
    state.items = state.items.filter((item) => item.id !== state.selectedItemId);
    state.selectedItemId = null;
    renderAll();
    saveLocal(true);
    setStatus("삭제 + 주변 지형 복원");
  });
  els.gridBtn.addEventListener("click", () => {
    state.showGrid = !state.showGrid;
    renderToggles();
    saveLocal(true);
  });
  els.referenceBtn.addEventListener("click", () => {
    state.showReference = !state.showReference;
    renderToggles();
    saveLocal(true);
  });
  els.sampleBtn.addEventListener("click", loadSample);
  els.saveBtn.addEventListener("click", () => saveLocal(false));
  els.loadBtn.addEventListener("click", loadLocal);
  els.resetBtn.addEventListener("click", () => {
    if (!window.confirm("분수공원만 남긴 기본 풀밭으로 초기화할까요?")) return;
    state.items = createStarterLayout();
    state.selectedAssetId = null;
    state.selectedItemId = null;
    state.zCounter = 20;
    renderAll();
    saveLocal(true);
    setStatus("기본 풀밭으로 초기화됨");
  });
  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `spend-city-v3-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus("JSON 내보냄");
  });
  els.importBtn.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", async () => {
    const file = els.importInput.files && els.importInput.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      state.items = validateLayout(data);
      state.zCounter = Math.max(1, ...state.items.map((item) => item.z + 1));
      state.selectedAssetId = null;
      state.selectedItemId = null;
      renderAll();
      saveLocal(true);
      setStatus("JSON 가져옴");
    } catch (error) {
      console.error(error);
      setStatus("JSON 오류", "error");
    } finally {
      els.importInput.value = "";
    }
  });

  document.querySelectorAll(".category-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      document.querySelectorAll(".category-tab").forEach((tab) =>
        tab.classList.toggle("active", tab === button),
      );
      renderPalette();
    });
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      saveLocal(false);
      return;
    }
    if (event.key === "Escape") {
      state.selectedAssetId = null;
      state.selectedItemId = null;
      renderAll();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && currentItem()) {
      event.preventDefault();
      els.deleteBtn.click();
      return;
    }
    if (key === "f" && currentItem()) {
      event.preventDefault();
      els.flipBtn.click();
    }
  });

  grassImage.addEventListener("load", scheduleTerrainRender);

  const query = new URLSearchParams(window.location.search);
  const wantsSample = query.get("sample") === "1" || query.get("preview") === "sample";
  try {
    const raw = wantsSample ? null : localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state.items = validateLayout(saved);
      state.showGrid = saved.showGrid !== false;
      state.showReference = Boolean(saved.showReference);
      state.zCounter = Math.max(1, ...state.items.map((item) => item.z + 1));
    } else if (wantsSample) {
      loadSample();
    } else {
      state.items = createStarterLayout();
      state.zCounter = 20;
      setStatus("분수공원 기본 풀밭 준비됨");
    }
  } catch (error) {
    console.warn("Saved layout was ignored:", error);
    state.items = createStarterLayout();
    state.zCounter = 20;
    setStatus("분수공원 기본 풀밭 준비됨");
  }
  renderAll();
})();
