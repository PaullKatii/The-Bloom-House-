import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase/config.js";

const firebaseReady = !Object.values(firebaseConfig).some(v => String(v).includes("GANTI_DENGAN"));
let db = null;

if (firebaseReady) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

const intro = document.getElementById("intro");
const header = document.getElementById("header");
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

window.addEventListener("load", () => setTimeout(() => intro.classList.add("done"), 1400));
window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 30), { passive: true });

menuToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -45px 0px" });

document.querySelectorAll(".reveal").forEach((el, i) => {
  if (el.classList.contains("service-card")) el.style.transitionDelay = `${(i % 5) * 80}ms`;
  revealObserver.observe(el);
});

const track = document.getElementById("galleryTrack");
document.getElementById("galleryPrev").addEventListener("click", () =>
  track.scrollBy({ left: -track.clientWidth * .75, behavior: "smooth" })
);
document.getElementById("galleryNext").addEventListener("click", () =>
  track.scrollBy({ left: track.clientWidth * .75, behavior: "smooth" })
);

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const closeLightbox = () => {
  lightbox.classList.remove("open");
  document.body.classList.remove("no-scroll");
};
document.querySelectorAll(".gallery-item").forEach(item => item.addEventListener("click", () => {
  lightboxImage.src = item.dataset.full;
  lightbox.classList.add("open");
  document.body.classList.add("no-scroll");
}));
document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });

const form = document.getElementById("bookingForm");
const dateInput = document.getElementById("bookingDate");
const timeInput = document.getElementById("bookingTime");
const statusEl = document.getElementById("bookingStatus");
const submitBtn = form.querySelector("button[type=submit]");
const nameInput = document.getElementById("customerName");
const phoneInput = document.getElementById("customerPhone");
const serviceInput = document.getElementById("service");
const noteInput = document.getElementById("bookingNote");

const newCustomerBtn = document.getElementById("newCustomerBtn");
const returningCustomerBtn = document.getElementById("returningCustomerBtn");
const returningCustomerBox = document.getElementById("returningCustomerBox");
const returningPhoneInput = document.getElementById("returningPhone");
const findCustomerBtn = document.getElementById("findCustomerBtn");
const customerSearchMessage = document.getElementById("customerSearchMessage");

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function setCustomerMode(mode) {
  const returning = mode === "returning";
  newCustomerBtn.classList.toggle("active", !returning);
  returningCustomerBtn.classList.toggle("active", returning);
  returningCustomerBox.hidden = !returning;
  customerSearchMessage.textContent = "";

  if (!returning) {
    nameInput.readOnly = false;
    phoneInput.readOnly = false;
    nameInput.value = "";
    phoneInput.value = "";
  } else {
    const saved = localStorage.getItem("bloomHouseCustomerPhone");
    if (saved) {
      returningPhoneInput.value = saved;
      customerSearchMessage.textContent = "Nomor tersimpan di perangkat ini. Klik Cari.";
    }
  }
}

newCustomerBtn.addEventListener("click", () => setCustomerMode("new"));
returningCustomerBtn.addEventListener("click", () => setCustomerMode("returning"));

async function findCustomer() {
  const phoneKey = normalizePhone(returningPhoneInput.value);
  customerSearchMessage.textContent = "";

  if (!db) {
    customerSearchMessage.textContent = "Firebase belum terhubung.";
    return;
  }
  if (phoneKey.length < 10) {
    customerSearchMessage.textContent = "Masukkan nomor WhatsApp yang valid.";
    return;
  }

  findCustomerBtn.disabled = true;
  findCustomerBtn.textContent = "Mencari...";

  try {
    const snap = await getDoc(doc(db, "customers", phoneKey));

    if (!snap.exists()) {
      customerSearchMessage.textContent = "Data tidak ditemukan. Pilih Pelanggan Baru.";
      nameInput.readOnly = false;
      phoneInput.readOnly = false;
      return;
    }

    const customer = snap.data();
    nameInput.value = customer.nama || "";
    phoneInput.value = customer.whatsapp || phoneKey;
    nameInput.readOnly = true;
    phoneInput.readOnly = true;
    localStorage.setItem("bloomHouseCustomerPhone", phoneKey);
    customerSearchMessage.textContent = `✓ Selamat datang kembali, ${customer.nama || "pelanggan"}!`;
  } catch (err) {
    console.error(err);
    customerSearchMessage.textContent = "Pencarian gagal. Periksa Firebase Rules.";
  } finally {
    findCustomerBtn.disabled = false;
    findCustomerBtn.textContent = "Cari";
  }
}

findCustomerBtn.addEventListener("click", findCustomer);
returningPhoneInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    findCustomer();
  }
});

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
dateInput.min = localToday;

function getDay(date) {
  return new Date(`${date}T12:00:00`).getDay();
}

function populateTimes() {
  timeInput.innerHTML = '<option value="">Pilih jam</option>';
  if (!dateInput.value) return;

  const day = getDay(dateInput.value);
  const start = day === 0 ? 15 : 9;

  for (let h = start; h < 20; h++) {
    for (const m of [0, 30]) {
      const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = `${v} WIT`;
      timeInput.appendChild(opt);
    }
  }
}
dateInput.addEventListener("change", populateTimes);

function error(input, message) {
  const group = input.closest(".form-group");
  if (!group) return;
  group.classList.toggle("invalid", !!message);
  const e = group.querySelector(".form-error");
  if (e) e.textContent = message || "";
}

function clearErrors() {
  form.querySelectorAll(".form-group").forEach(g => {
    g.classList.remove("invalid");
    const e = g.querySelector(".form-error");
    if (e) e.textContent = "";
  });
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  clearErrors();
  statusEl.textContent = "";

  let valid = true;
  if (!nameInput.value.trim()) { error(nameInput, "Nama wajib diisi."); valid = false; }
  if (!phoneInput.value.trim()) { error(phoneInput, "Nomor WhatsApp wajib diisi."); valid = false; }
  if (!serviceInput.value) { error(serviceInput, "Pilih layanan."); valid = false; }
  if (!dateInput.value) { error(dateInput, "Pilih tanggal."); valid = false; }
  if (!timeInput.value) { error(timeInput, "Pilih jam."); valid = false; }

  if (!valid) {
    statusEl.textContent = "Silakan lengkapi data booking.";
    return;
  }
  if (!db) {
    statusEl.textContent = "Firebase belum terhubung. Periksa firebase/config.js.";
    return;
  }

  const normalizedPhone = normalizePhone(phoneInput.value);
  if (normalizedPhone.length < 10) {
    error(phoneInput, "Nomor WhatsApp tidak valid.");
    statusEl.textContent = "Periksa nomor WhatsApp.";
    return;
  }

  const selectedDate = new Date(`${dateInput.value}T12:00:00`);
  const formattedDate = selectedDate.toLocaleDateString("id-ID", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });

  const booking = {
    nama: nameInput.value.trim(),
    whatsapp: phoneInput.value.trim(),
    layanan: serviceInput.value,
    tanggal: dateInput.value,
    tanggalDisplay: formattedDate,
    jam: timeInput.value,
    catatan: noteInput.value.trim(),
    status: "pending",
    createdAt: serverTimestamp()
  };

  submitBtn.disabled = true;
  statusEl.textContent = "Menyimpan booking...";

  try {
    await setDoc(doc(db, "customers", normalizedPhone), {
      nama: booking.nama,
      whatsapp: normalizedPhone,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await addDoc(collection(db, "bookings"), booking);
    localStorage.setItem("bloomHouseCustomerPhone", normalizedPhone);

    const message = `Halo The Bloom House 🌸

Saya ingin booking salon.

Nama: ${booking.nama}
WhatsApp: ${booking.whatsapp}
Layanan: ${booking.layanan}
Tanggal: ${booking.tanggalDisplay}
Jam: ${booking.jam} WIT
Catatan: ${booking.catatan || "-"}

Mohon konfirmasi ketersediaannya. Terima kasih.`;

    statusEl.textContent = "Booking tersimpan. Membuka WhatsApp...";
    window.open(`https://wa.me/6281296509812?text=${encodeURIComponent(message)}`, "_blank", "noopener");

    form.reset();
    nameInput.readOnly = false;
    phoneInput.readOnly = false;
    timeInput.innerHTML = '<option value="">Pilih tanggal dahulu</option>';
    customerSearchMessage.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Booking belum tersimpan. Periksa Firebase Rules atau koneksi.";
  } finally {
    submitBtn.disabled = false;
  }
});

if (localStorage.getItem("bloomHouseCustomerPhone")) {
  returningCustomerBtn.classList.add("has-saved-customer");
}
