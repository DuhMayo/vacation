import {
  homes,
  initialMapView,
  sightseeingGuides,
  diningGuides,
} from "./data/listings.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
  tap: true,
}).setView(initialMapView.center, initialMapView.zoom);

L.control
  .zoom({
    position: "topright",
  })
  .addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const detailPanel = document.querySelector("#detail-panel");
const closeDetailButton = document.querySelector("#close-detail");
const detailImage = document.querySelector("#detail-image");
const detailPlatform = document.querySelector("#detail-platform");
const detailGroup = document.querySelector("#detail-group");
const detailTitle = document.querySelector("#detail-title");
const detailArea = document.querySelector("#detail-area");
const detailAddress = document.querySelector("#detail-address");
const detailConfidence = document.querySelector("#detail-confidence");
const detailAmenities = document.querySelector("#detail-amenities");
const detailParking = document.querySelector("#detail-parking");
const detailDining = document.querySelector("#detail-dining");
const visitLinkTop = document.querySelector("#visit-link-top");
const prevHomeButton = document.querySelector("#prev-home");
const nextHomeButton = document.querySelector("#next-home");
const resetViewButton = document.querySelector("#reset-view");
const menuToggle = document.querySelector("#menu-toggle");
const closeMenuButton = document.querySelector("#close-menu");
const menuPanel = document.querySelector("#menu-panel");
const guideList = document.querySelector("#guide-list");
const regionPanel = document.querySelector("#region-panel");
const closeRegionButton = document.querySelector("#close-region");
const regionTitle = document.querySelector("#region-title");
const regionSummary = document.querySelector("#region-summary");
const regionDayTrips = document.querySelector("#region-day-trips");
const regionThings = document.querySelector("#region-things");
const regionTowns = document.querySelector("#region-towns");
const regionFocusMap = document.querySelector("#region-focus-map");
const regionItinerary = document.querySelector("#region-itinerary");
const menuSheet = document.querySelector(".menu-sheet");
const regionSheet = document.querySelector(".region-sheet");
const menuBackToTop = document.querySelector("#menu-back-to-top");
const regionBackToTop = document.querySelector("#region-back-to-top");
const orderedHomes = [...homes].sort((a, b) =>
  `${a.locationGroup} ${a.name}`.localeCompare(`${b.locationGroup} ${b.name}`)
);

let activeSlug = null;
let activeRegion = null;
let regionMapInstance = null;
let regionPoiMarkers = [];
const markerRegistry = new Map();

// ─── Favorites state ──────────────────────────────────────────────────────────
let localFavorites = new Set(
  JSON.parse(localStorage.getItem("vhmap_favorites") || "[]")
);
let userName = localStorage.getItem("vhmap_username") || null;
let publicFavorites = []; // [{ slug, user_name }] from Supabase
let showOnlyFavorites = false;
let pendingFavoriteSlug = null;
let favoriteToggleInFlight = false;

let supabase = null;
try {
  if (SUPABASE_URL && !SUPABASE_URL.startsWith("YOUR_")) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (_) {}

function createFallbackImage(home) {
  const title = encodeURIComponent(home.name);
  const subtitle = encodeURIComponent(home.townArea);
  const platform = encodeURIComponent(home.platform);
  return `data:image/svg+xml;charset=UTF-8,
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'>
    <defs>
      <linearGradient id='bg' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0%' stop-color='%230f5a64'/>
        <stop offset='50%' stop-color='%2314a097'/>
        <stop offset='100%' stop-color='%23f08f65'/>
      </linearGradient>
    </defs>
    <rect width='1200' height='800' fill='url(%23bg)' />
    <circle cx='180' cy='180' r='110' fill='rgba(255,255,255,0.12)' />
    <circle cx='1040' cy='120' r='140' fill='rgba(255,255,255,0.10)' />
    <path d='M0 585 C140 520 260 500 380 548 C470 585 565 610 650 570 C742 526 848 450 967 470 C1080 490 1140 540 1200 510 L1200 800 L0 800 Z' fill='rgba(255,255,255,0.16)'/>
    <path d='M0 660 C160 606 252 626 335 660 C454 708 574 708 677 650 C793 582 931 582 1200 650 L1200 800 L0 800 Z' fill='rgba(12,39,43,0.22)'/>
    <rect x='72' y='72' width='260' height='44' rx='22' fill='rgba(255,251,245,0.22)' />
    <text x='102' y='101' font-family='Arial, sans-serif' font-size='26' fill='white'>Preview blocked</text>
    <text x='72' y='520' font-family='Georgia, serif' font-size='66' font-weight='700' fill='white'>${title}</text>
    <text x='72' y='580' font-family='Arial, sans-serif' font-size='32' fill='rgba(255,255,255,0.92)'>${subtitle}</text>
    <text x='72' y='628' font-family='Arial, sans-serif' font-size='24' fill='rgba(255,255,255,0.78)'>${platform}</text>
  </svg>`;
}

function imageFor(home) {
  return home.image || createFallbackImage(home);
}

function getHomeBySlug(slug) {
  return homes.find((home) => home.slug === slug);
}

const PHOTO_ZOOM_THRESHOLD = 12;

function markerIcon(isActive = false, home = null) {
  const showPhoto = home && home.image && map.getZoom() >= PHOTO_ZOOM_THRESHOLD;

  if (showPhoto) {
    return L.divIcon({
      className: "",
      html: `<div class="marker-photo${isActive ? " is-active" : ""}">
               <img src="${home.image}" alt="${home.name}" />
               <div class="marker-photo-name">${home.name}</div>
             </div>`,
      iconSize: [80, 76],
      iconAnchor: [40, 38],
    });
  }

  return L.divIcon({
    className: "",
    html: `<div class="marker-badge${isActive ? " is-active" : ""}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function updateMarkerStates() {
  const favSlugs = showOnlyFavorites
    ? new Set(publicFavorites.map((f) => f.slug))
    : null;
  markerRegistry.forEach((marker, slug) => {
    const home = getHomeBySlug(slug);
    marker.setIcon(markerIcon(slug === activeSlug, home));
    if (favSlugs) {
      if (favSlugs.has(slug)) {
        if (!map.hasLayer(marker)) marker.addTo(map);
      } else {
        if (map.hasLayer(marker)) marker.remove();
      }
    } else {
      if (!map.hasLayer(marker)) marker.addTo(map);
    }
  });
}

function addMarkers() {
  homes.forEach((home) => {
    const marker = L.marker([home.lat, home.lng], {
      icon: markerIcon(false, home),
      title: home.name,
    }).addTo(map);

    marker.on("click", () => openDetail(home.slug, { fly: false }));
    markerRegistry.set(home.slug, marker);
  });
}

function focusHome(home) {
  map.flyTo([home.lat, home.lng], Math.max(map.getZoom(), 10), {
    duration: 0.6,
  });
}

function syncHash(slug) {
  const nextHash = slug ? `#${slug}` : "";
  if (window.location.hash !== nextHash) {
    history.replaceState(null, "", nextHash || window.location.pathname);
  }
}

function updateNavButtons(home) {
  const currentIndex = orderedHomes.findIndex((item) => item.slug === home.slug);
  prevHomeButton.disabled = currentIndex <= 0;
  nextHomeButton.disabled = currentIndex >= orderedHomes.length - 1;
}

function openDetail(slug, options = {}) {
  const home = getHomeBySlug(slug);
  if (!home) return;

  activeSlug = slug;
  detailPanel.classList.add("is-open");
  detailPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("detail-open");

  detailImage.src = imageFor(home);
  detailImage.alt = home.name;
  detailImage.onerror = () => {
    detailImage.src = createFallbackImage(home);
  };
  detailPlatform.textContent = home.platform;
  detailGroup.textContent = home.locationGroup;
  detailTitle.textContent = home.name;
  detailArea.textContent = home.townArea;
  detailAddress.textContent = home.address;
  detailConfidence.textContent = `Address confidence: ${home.addressConfidence}`;
  detailAmenities.textContent = home.amenities;
  if (home.parking) {
    const { spaces, type, notes } = home.parking;
    const spacesLabel =
      spaces === "Not specified"
        ? "Spaces: not specified"
        : `${spaces} space${spaces !== "1" ? "s" : ""} · ${type}`;
    detailParking.innerHTML = `<p><strong>${spacesLabel}</strong></p><p>${notes}</p>`;
  } else {
    detailParking.innerHTML = "<p>No parking info available.</p>";
  }
  detailDining.innerHTML = (diningGuides[home.locationGroup] || [
    {
      name: "Search nearby places",
      note: "Open Google Maps and explore the area after you narrow this stay down.",
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(home.townArea)}`,
    },
  ])
    .map(
      (item) =>
        `<p><a href="${item.url}" target="_blank" rel="noreferrer">${item.name}</a>${
          item.note ? `: ${item.note}` : ""
        }</p>`
    )
    .join("");
  visitLinkTop.href = home.link;

  updateNavButtons(home);
  updateMarkerStates();
  syncHash(slug);
  updateHeartButton(slug);

  if (options.fly !== false) {
    focusHome(home);
  }
}

function closeDetail() {
  activeSlug = null;
  detailPanel.classList.remove("is-open");
  detailPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("detail-open");
  updateMarkerStates();
  syncHash(null);
}

function moveSelection(direction) {
  if (!activeSlug) return;
  const currentIndex = orderedHomes.findIndex((item) => item.slug === activeSlug);
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= orderedHomes.length) return;
  openDetail(orderedHomes[nextIndex].slug);
}

function resetSouthWestView() {
  map.flyTo(initialMapView.center, initialMapView.zoom, {
    duration: 0.65,
  });
}

function openMenu() {
  menuPanel.classList.add("is-open");
  menuPanel.setAttribute("aria-hidden", "false");
  menuToggle.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  menuPanel.classList.remove("is-open");
  menuPanel.setAttribute("aria-hidden", "true");
  menuToggle.setAttribute("aria-expanded", "false");
}

function openRegion(regionName) {
  const region = sightseeingGuides.find((item) => item.region === regionName);
  if (!region) return;

  // Close the menu first so the panel is fully visible on mobile
  closeMenu();

  activeRegion = region;
  regionTitle.textContent = region.region;
  regionSummary.textContent = region.summary || "";
  regionDayTrips.innerHTML = (region.dayTrips || [])
    .map((item) => `<p>${item}</p>`)
    .join("");
  regionThings.innerHTML = (region.thingsToDo || [])
    .map((item) => `<p>${item}</p>`)
    .join("");
  regionItinerary.innerHTML = (region.itinerary || [])
    .map(
      (item, i) => `
        <div class="itinerary-item">
          <div class="itinerary-num">${i + 1}</div>
          <div class="itinerary-body">
            <p class="itinerary-slot">${item.slot}</p>
            <p class="itinerary-place">${item.place}</p>
            <p class="itinerary-desc">${item.description}</p>
          </div>
        </div>
      `
    )
    .join("");
  regionTowns.innerHTML = (region.towns || [])
    .map(
      (town) => `
        <section class="region-town">
          <h4>${town.name}</h4>
          <ul>
            ${town.highlights.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </section>
      `
    )
    .join("");

  regionPanel.classList.add("is-open");
  regionPanel.setAttribute("aria-hidden", "false");

  // Initialize the mini-map lazily; invalidate size after the slide-in transition (220ms)
  setTimeout(() => {
    if (!regionMapInstance) {
      regionMapInstance = L.map("region-map", {
        zoomControl: true,
        attributionControl: true,
        tap: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(regionMapInstance);
    }

    // Swap POI markers for the newly selected region
    regionPoiMarkers.forEach((m) => m.remove());
    regionPoiMarkers = [];
    (region.itinerary || []).forEach((item, i) => {
      if (!item.lat || !item.lng) return;
      const marker = L.marker([item.lat, item.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="region-poi-marker">${i + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        title: item.place,
      })
        .bindPopup(
          `<strong>${item.place}</strong><br><span style="font-size:0.82em;color:#607670">${item.slot}</span>`
        )
        .addTo(regionMapInstance);
      regionPoiMarkers.push(marker);
    });

    regionMapInstance.invalidateSize();
    regionMapInstance.setView(region.focus.center, region.focus.zoom);
  }, 240);
}

function closeRegion() {
  activeRegion = null;
  regionPanel.classList.remove("is-open");
  regionPanel.setAttribute("aria-hidden", "true");
}

function renderGuide() {
  guideList.innerHTML = sightseeingGuides
    .map(
      (section) => `
        <article class="guide-region">
          <div class="guide-region-head">
            <div>
              <p class="eyebrow">${section.region}</p>
              <h3>${section.region}</h3>
            </div>
            <div class="guide-head-actions">
              <button
                class="guide-focus-button"
                type="button"
                data-focus-lat="${section.focus.center[0]}"
                data-focus-lng="${section.focus.center[1]}"
                data-focus-zoom="${section.focus.zoom}"
              >
                Focus
              </button>
              <button
                class="guide-open-button"
                type="button"
                data-region="${section.region}"
              >
                Expand
              </button>
            </div>
          </div>
          <div class="guide-town-list">
            ${section.towns
              .map(
                (town) => `
                  <section class="guide-town">
                    <h4>${town.name}</h4>
                    <ul>
                      ${town.highlights.map((item) => `<li>${item}</li>`).join("")}
                    </ul>
                  </section>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");

  guideList.querySelectorAll(".guide-focus-button").forEach((button) => {
    button.addEventListener("click", () => {
      const lat = Number(button.dataset.focusLat);
      const lng = Number(button.dataset.focusLng);
      const zoom = Number(button.dataset.focusZoom);
      map.flyTo([lat, lng], zoom, { duration: 0.7 });
      closeMenu();
    });
  });

  guideList.querySelectorAll(".guide-open-button").forEach((button) => {
    button.addEventListener("click", () => {
      openRegion(button.dataset.region);
    });
  });
}

addMarkers();
updateMarkerStates();
renderGuide();

closeDetailButton.addEventListener("click", closeDetail);
prevHomeButton.addEventListener("click", () => moveSelection(-1));
nextHomeButton.addEventListener("click", () => moveSelection(1));
resetViewButton.addEventListener("click", resetSouthWestView);
map.on("zoomend", updateMarkerStates);
visitLinkTop.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const href = visitLinkTop.getAttribute("href");
  if (href && href !== "#") {
    window.open(href, "_blank", "noopener,noreferrer");
  }
});
menuToggle.addEventListener("click", () => {
  if (menuPanel.classList.contains("is-open")) {
    closeMenu();
  } else {
    openMenu();
  }
});
closeMenuButton.addEventListener("click", closeMenu);
closeRegionButton.addEventListener("click", closeRegion);
regionFocusMap.addEventListener("click", () => {
  if (!activeRegion) return;
  map.flyTo(activeRegion.focus.center, activeRegion.focus.zoom, { duration: 0.7 });
  closeRegion();
  closeMenu();
});

detailPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeDetail === "true") {
    closeDetail();
  }
});

menuPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeMenu === "true") {
    closeMenu();
  }
});

regionPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeRegion === "true") {
    closeRegion();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (nameModal.classList.contains("is-open")) { closeNameModal(); return; }
    if (favoritesPanel.classList.contains("is-open")) { closeFavoritesPanel(); return; }
    if (regionPanel.classList.contains("is-open")) closeRegion();
    if (menuPanel.classList.contains("is-open")) closeMenu();
    if (detailPanel.classList.contains("is-open")) closeDetail();
  }
  if (!detailPanel.classList.contains("is-open")) return;
  if (event.key === "ArrowLeft") moveSelection(-1);
  if (event.key === "ArrowRight") moveSelection(1);
});

window.addEventListener("hashchange", () => {
  const slug = window.location.hash.replace(/^#/, "");
  if (!slug) {
    closeDetail();
    return;
  }
  openDetail(slug, { fly: false });
});

if (window.location.hash) {
  openDetail(window.location.hash.replace(/^#/, ""), { fly: false });
}

menuSheet.addEventListener("scroll", () => {
  menuBackToTop.classList.toggle("is-visible", menuSheet.scrollTop > 200);
});

menuBackToTop.addEventListener("click", () => {
  menuSheet.scrollTo({ top: 0, behavior: "smooth" });
});

regionSheet.addEventListener("scroll", () => {
  regionBackToTop.classList.toggle("is-visible", regionSheet.scrollTop > 200);
});

regionBackToTop.addEventListener("click", () => {
  regionSheet.scrollTo({ top: 0, behavior: "smooth" });
});

// ─── Favorites ────────────────────────────────────────────────────────────────

const favoriteBtn          = document.querySelector("#favorite-btn");
const favoritesPanel       = document.querySelector("#favorites-panel");
const closeFavoritesBtn    = document.querySelector("#close-favorites");
const favoritesToggleBtn   = document.querySelector("#favorites-toggle");
const favoritesList        = document.querySelector("#favorites-list");
const filterFavoritesBtn   = document.querySelector("#filter-favorites-btn");
const filterActiveIndicator = document.querySelector("#filter-active-indicator");
const nameModal            = document.querySelector("#name-modal");
const nameInput            = document.querySelector("#name-input");
const nameSubmitBtn        = document.querySelector("#name-submit");
const nameCancelBtn        = document.querySelector("#name-cancel");

// ── localStorage helpers ──────────────────────────────────────────────────────
function saveLocalFavorites() {
  localStorage.setItem("vhmap_favorites", JSON.stringify([...localFavorites]));
}

function saveUserName(name) {
  userName = name;
  localStorage.setItem("vhmap_username", name);
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function fetchPublicFavorites() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("slug, user_name");
    if (!error && data) publicFavorites = data;
  } catch (_) {}
}

async function pushFavoriteToDb(slug) {
  if (!supabase || !userName) return;
  try {
    await supabase
      .from("favorites")
      .upsert({ slug, user_name: userName }, { onConflict: "slug,user_name", ignoreDuplicates: true });
  } catch (_) {}
}

async function pullFavoriteFromDb(slug) {
  if (!supabase || !userName) return;
  try {
    await supabase
      .from("favorites")
      .delete()
      .eq("slug", slug)
      .eq("user_name", userName);
  } catch (_) {}
}

// ── Toggle favorite ───────────────────────────────────────────────────────────
async function toggleFavorite(slug) {
  if (favoriteToggleInFlight) return;

  if (!userName) {
    pendingFavoriteSlug = slug;
    openNameModal();
    return;
  }

  favoriteToggleInFlight = true;

  if (localFavorites.has(slug)) {
    localFavorites.delete(slug);
    saveLocalFavorites();
    await pullFavoriteFromDb(slug);
  } else {
    localFavorites.add(slug);
    saveLocalFavorites();
    await pushFavoriteToDb(slug);
  }

  await fetchPublicFavorites();
  favoriteToggleInFlight = false;

  updateHeartButton(slug);
  updateMarkerStates();
  updateFilterIndicator();
  if (favoritesPanel.classList.contains("is-open")) {
    renderFavoritesList();
  }
}

function updateHeartButton(slug) {
  const btn = document.querySelector("#favorite-btn");
  if (!btn) return;
  const isFav = slug ? localFavorites.has(slug) : false;
  btn.textContent = isFav ? "♥" : "♡";
  btn.classList.toggle("is-favorited", isFav);
  btn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
}

favoriteBtn.addEventListener("click", () => {
  if (activeSlug) toggleFavorite(activeSlug);
});

// ── Name modal ────────────────────────────────────────────────────────────────
function openNameModal() {
  nameModal.classList.add("is-open");
  nameModal.setAttribute("aria-hidden", "false");
  nameInput.value = "";
  setTimeout(() => nameInput.focus(), 50);
}

function closeNameModal() {
  nameModal.classList.remove("is-open");
  nameModal.setAttribute("aria-hidden", "true");
  pendingFavoriteSlug = null;
}

nameSubmitBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  saveUserName(name);
  const slug = pendingFavoriteSlug;
  closeNameModal();
  if (slug) await toggleFavorite(slug);
});

nameCancelBtn.addEventListener("click", closeNameModal);

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") nameSubmitBtn.click();
  if (e.key === "Escape") closeNameModal();
});

nameModal.querySelector(".name-modal-backdrop").addEventListener("click", closeNameModal);

// ── Favorites panel ───────────────────────────────────────────────────────────
async function openFavoritesPanel() {
  favoritesPanel.classList.add("is-open");
  favoritesPanel.setAttribute("aria-hidden", "false");
  favoritesList.innerHTML = '<p class="favorites-loading">Loading&hellip;</p>';
  await fetchPublicFavorites();
  renderFavoritesList();
}

function closeFavoritesPanel() {
  favoritesPanel.classList.remove("is-open");
  favoritesPanel.setAttribute("aria-hidden", "true");
}

function renderFavoritesList() {
  // Group by slug, collecting all user names per location
  const grouped = new Map();
  for (const fav of publicFavorites) {
    if (!grouped.has(fav.slug)) grouped.set(fav.slug, []);
    grouped.get(fav.slug).push(fav.user_name);
  }

  if (grouped.size === 0) {
    favoritesList.innerHTML =
      '<p class="favorites-empty">No favorites yet — be the first to heart a location!</p>';
    return;
  }

  favoritesList.innerHTML = [...grouped.entries()]
    .map(([slug, names]) => {
      const home = getHomeBySlug(slug);
      if (!home) return "";
      return `
        <button class="favorite-item" type="button" data-slug="${slug}">
          <div class="favorite-item-text">
            <p class="favorite-item-name">${home.name}</p>
            <p class="favorite-item-area">${home.townArea}</p>
          </div>
          <p class="favorite-item-who">&#x2665; ${names.join(", ")}</p>
        </button>`;
    })
    .join("");

  favoritesList.querySelectorAll(".favorite-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeFavoritesPanel();
      openDetail(btn.dataset.slug);
    });
  });
}

function updateFilterIndicator() {
  filterFavoritesBtn.textContent = showOnlyFavorites
    ? "Show All Locations"
    : "Show Favorites Only on Map";
  filterFavoritesBtn.classList.toggle("is-active", showOnlyFavorites);
  filterActiveIndicator.classList.toggle("is-active", showOnlyFavorites);
  filterActiveIndicator.setAttribute("aria-hidden", showOnlyFavorites ? "false" : "true");
}

filterFavoritesBtn.addEventListener("click", () => {
  showOnlyFavorites = !showOnlyFavorites;
  updateFilterIndicator();
  updateMarkerStates();
});

filterActiveIndicator.addEventListener("click", () => {
  showOnlyFavorites = false;
  updateFilterIndicator();
  updateMarkerStates();
});

favoritesToggleBtn.addEventListener("click", openFavoritesPanel);
closeFavoritesBtn.addEventListener("click", closeFavoritesPanel);

favoritesPanel.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.closeFavorites === "true") {
    closeFavoritesPanel();
  }
});

// Load public favorites on startup so the filter is ready to use immediately
fetchPublicFavorites();
