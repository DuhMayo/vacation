import { homes, initialMapView } from "./data/listings.js";

const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
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
const detailNotes = document.querySelector("#detail-notes");
const visitLink = document.querySelector("#visit-link");
const prevHomeButton = document.querySelector("#prev-home");
const nextHomeButton = document.querySelector("#next-home");
const cardRail = document.querySelector("#card-rail");
const railTitle = document.querySelector("#rail-title");
const railCount = document.querySelector("#rail-count");
const filterChips = document.querySelector("#filter-chips");
const resetViewButton = document.querySelector("#reset-view");

const locationGroups = ["All", ...new Set(homes.map((home) => home.locationGroup))];
const markerLayer = L.layerGroup().addTo(map);
let activeFilter = "All";
let activeSlug = null;
let activeTouchStartX = null;

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

function filteredHomes() {
  return activeFilter === "All"
    ? homes
    : homes.filter((home) => home.locationGroup === activeFilter);
}

function getHomeBySlug(slug) {
  return homes.find((home) => home.slug === slug);
}

function createMarker(home) {
  const marker = L.marker([home.lat, home.lng], {
    icon: L.divIcon({
      className: "",
      html: `<div class="marker-badge"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
  });

  marker.on("click", () => openDetail(home.slug, { fly: false }));
  return marker;
}

function renderMarkers() {
  markerLayer.clearLayers();
  filteredHomes().forEach((home) => {
    markerLayer.addLayer(createMarker(home));
  });
}

function renderFilters() {
  filterChips.innerHTML = "";
  locationGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${group === activeFilter ? " active" : ""}`;
    button.textContent = group;
    button.addEventListener("click", () => {
      activeFilter = group;
      if (activeSlug && !filteredHomes().some((home) => home.slug === activeSlug)) {
        activeSlug = null;
        closeDetail();
      }
      renderEverything();
      if (group === "All") {
        resetSouthWestView();
      }
    });
    filterChips.appendChild(button);
  });
}

function cardTemplate(home) {
  return `
    <article class="home-card ${home.slug === activeSlug ? "active" : ""}" data-slug="${home.slug}" tabindex="0">
      <img src="${imageFor(home)}" alt="${home.name}" loading="lazy" />
      <div class="home-card-body">
        <p class="eyebrow">${home.locationGroup}</p>
        <h3>${home.name}</h3>
        <p>${home.townArea}</p>
      </div>
    </article>
  `;
}

function renderCards() {
  const homesToRender = filteredHomes();
  railTitle.textContent =
    activeFilter === "All" ? "All shortlisted stays" : activeFilter;
  railCount.textContent = `${homesToRender.length} home${homesToRender.length === 1 ? "" : "s"}`;
  cardRail.innerHTML = homesToRender.map(cardTemplate).join("");

  cardRail.querySelectorAll(".home-card").forEach((card) => {
    const slug = card.dataset.slug;
    const home = getHomeBySlug(slug);
    const image = card.querySelector("img");
    if (home && image) {
      image.onerror = () => {
        image.src = createFallbackImage(home);
      };
    }
    const activate = () => openDetail(slug);
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
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

function openDetail(slug, options = {}) {
  const home = getHomeBySlug(slug);
  if (!home) return;

  activeSlug = slug;
  const currentHomes = filteredHomes();
  if (!currentHomes.some((item) => item.slug === slug)) {
    activeFilter = home.locationGroup;
    renderEverything();
  }

  detailPanel.classList.add("is-open");
  detailPanel.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

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
  detailNotes.textContent = home.notes;
  visitLink.href = home.link;

  renderCards();
  updateNavButtons();
  syncHash(slug);
  if (options.fly !== false) focusHome(home);
}

function closeDetail() {
  activeSlug = null;
  detailPanel.classList.remove("is-open");
  detailPanel.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  renderCards();
  syncHash(null);
}

function moveSelection(direction) {
  const currentHomes = filteredHomes();
  if (!currentHomes.length) return;

  const currentIndex = currentHomes.findIndex((home) => home.slug === activeSlug);
  if (currentIndex < 0) {
    openDetail(currentHomes[0].slug);
    return;
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= currentHomes.length) return;
  openDetail(currentHomes[nextIndex].slug);
}

function updateNavButtons() {
  const currentHomes = filteredHomes();
  const currentIndex = currentHomes.findIndex((home) => home.slug === activeSlug);
  prevHomeButton.disabled = currentIndex <= 0;
  nextHomeButton.disabled =
    currentIndex === -1 || currentIndex >= currentHomes.length - 1;
}

function resetSouthWestView() {
  map.flyTo(initialMapView.center, initialMapView.zoom, {
    duration: 0.65,
  });
}

function renderEverything() {
  renderFilters();
  renderMarkers();
  renderCards();
}

closeDetailButton.addEventListener("click", closeDetail);
detailPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeDetail === "true") {
    closeDetail();
  }
});
prevHomeButton.addEventListener("click", () => moveSelection(-1));
nextHomeButton.addEventListener("click", () => moveSelection(1));
resetViewButton.addEventListener("click", resetSouthWestView);

document.addEventListener("keydown", (event) => {
  if (!detailPanel.classList.contains("is-open")) return;
  if (event.key === "Escape") closeDetail();
  if (event.key === "ArrowLeft") moveSelection(-1);
  if (event.key === "ArrowRight") moveSelection(1);
});

detailPanel.addEventListener("touchstart", (event) => {
  activeTouchStartX = event.changedTouches[0].clientX;
});

detailPanel.addEventListener("touchend", (event) => {
  if (activeTouchStartX === null) return;
  const deltaX = event.changedTouches[0].clientX - activeTouchStartX;
  activeTouchStartX = null;
  if (Math.abs(deltaX) < 44) return;
  if (deltaX < 0) moveSelection(1);
  if (deltaX > 0) moveSelection(-1);
});

window.addEventListener("hashchange", () => {
  const slug = window.location.hash.replace(/^#/, "");
  if (!slug) {
    closeDetail();
    return;
  }
  openDetail(slug, { fly: false });
});

renderEverything();

if (window.location.hash) {
  openDetail(window.location.hash.replace(/^#/, ""), { fly: false });
}
