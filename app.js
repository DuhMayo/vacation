import { homes, initialMapView, sightseeingGuides } from "./data/listings.js";

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
const detailLocationNav = document.querySelector("#detail-location-nav");
const detailAddress = document.querySelector("#detail-address");
const detailConfidence = document.querySelector("#detail-confidence");
const detailAmenities = document.querySelector("#detail-amenities");
const detailNotes = document.querySelector("#detail-notes");
const visitLinkTop = document.querySelector("#visit-link-top");
const prevHomeButton = document.querySelector("#prev-home");
const nextHomeButton = document.querySelector("#next-home");
const resetViewButton = document.querySelector("#reset-view");
const menuToggle = document.querySelector("#menu-toggle");
const closeMenuButton = document.querySelector("#close-menu");
const menuPanel = document.querySelector("#menu-panel");
const guideList = document.querySelector("#guide-list");
const orderedHomes = [...homes].sort((a, b) =>
  `${a.locationGroup} ${a.name}`.localeCompare(`${b.locationGroup} ${b.name}`)
);

let activeSlug = null;
let activeTouchStartX = null;
const markerRegistry = new Map();

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

function markerHtml(isActive = false) {
  return `<div class="marker-badge${isActive ? " is-active" : ""}"></div>`;
}

function markerIcon(isActive = false) {
  return L.divIcon({
    className: "",
    html: markerHtml(isActive),
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function updateMarkerStates() {
  markerRegistry.forEach((marker, slug) => {
    marker.setIcon(markerIcon(slug === activeSlug));
  });
}

function addMarkers() {
  homes.forEach((home) => {
    const marker = L.marker([home.lat, home.lng], {
      icon: markerIcon(false),
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

function updateLocationNav(home) {
  const currentIndex = orderedHomes.findIndex((item) => item.slug === home.slug);
  detailLocationNav.textContent = `${currentIndex + 1} of ${orderedHomes.length} homes · ${home.locationGroup}`;
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
  detailNotes.textContent = home.notes;
  visitLinkTop.href = home.link;

  updateLocationNav(home);
  updateNavButtons(home);
  updateMarkerStates();
  syncHash(slug);

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
            <button
              class="guide-focus-button"
              type="button"
              data-focus-lat="${section.focus.center[0]}"
              data-focus-lng="${section.focus.center[1]}"
              data-focus-zoom="${section.focus.zoom}"
            >
              Focus map
            </button>
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
}

addMarkers();
updateMarkerStates();
renderGuide();

closeDetailButton.addEventListener("click", closeDetail);
prevHomeButton.addEventListener("click", () => moveSelection(-1));
nextHomeButton.addEventListener("click", () => moveSelection(1));
resetViewButton.addEventListener("click", resetSouthWestView);
menuToggle.addEventListener("click", () => {
  if (menuPanel.classList.contains("is-open")) {
    closeMenu();
  } else {
    openMenu();
  }
});
closeMenuButton.addEventListener("click", closeMenu);

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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (menuPanel.classList.contains("is-open")) closeMenu();
    if (detailPanel.classList.contains("is-open")) closeDetail();
  }
  if (!detailPanel.classList.contains("is-open")) return;
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

if (window.location.hash) {
  openDetail(window.location.hash.replace(/^#/, ""), { fly: false });
}
