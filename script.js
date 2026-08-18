import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase/config.js";

const firebaseReady = !Object.values(firebaseConfig).some(value => String(value).includes("GANTI_DENGAN"));
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

window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 30);
}, { passive: true });

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

// Scroll animations
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

// Gallery
const track = document.getElementById("galleryTrack");
document.getElementById("galleryPrev").addEventListener("click", () => track.scrollBy({left:-track.clientWidth*.75,behavior:"smooth"}));
document.getElementById("galleryNext").addEventListener("click", () => track.scrollBy({left:track.clientWidth*.75,behavior:"smooth"}));

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const closeLightbox = () => { lightbox.classList.remove("open"); document.body.classList.remove("no-scroll"); };
document.querySelectorAll(".gallery-item").forEach(item => item.addEventListener("click", () => {
  lightboxImage.src = item.dataset.full;
  lightbox.classList.add("open");
  document.body.classList.add("no-scroll");
}));
document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });

// Booking
const form = document.getElementById("bookingForm");
const dateInput = document.getElementById("bookingDate");
const timeInput = document.getElementById("bookingTime");
const statusEl = document.getElementById("bookingStatus");
const submitBtn = form.querySelector("button[type=submit]");
const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
dateInput.min = localToday;

function getDay(date) { return new Date(`${date}T12:00:00`).getDay(); }

function populateTimes() {
  timeInput.innerHTML = '<option value="">Pilih jam</option>';
  if (!dateInput.value) return;
  const day = getDay(dateInput.value);
  const start = day === 0 ? 15 : 9;
  for (let h=start; h<20; h++) {
    for (const m of [0,30]) {
      const v = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = `${v} WIB`;
      timeInput.appendChild(opt);
    }
  }
}
dateInput.addEventListener("change", populateTimes);

function error(input, message) {
  const group = input.closest(".form-group");
  group.classList.toggle("invalid", !!message);
  group.querySelector(".form-error").textContent = message || "";
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

  const name = document.getElementById("customerName");
  const phone = document.getElementById("customerPhone");
  const service = document.getElementById("service");
  const note = document.getElementById("bookingNote");

  let valid = true;
  [[name,!name.value.trim()?"Nama wajib diisi.":""],
   [phone,!phone.value.trim()?"Nomor WhatsApp wajib diisi.":""],
   [service,!service.value?"Pilih layanan.":""],
   [dateInput,!dateInput.value?"Pilih tanggal.":""],
   [timeInput,!timeInput.value?"Pilih jam.":""]].forEach(([input,msg]) => {
    error(input,msg); if(msg) valid=false;
  });

  if (!valid) {
    statusEl.textContent = "Silakan lengkapi data booking.";
    return;
  }

  const selectedDate = new Date(`${dateInput.value}T12:00:00`);
  const formattedDate = selectedDate.toLocaleDateString("id-ID", {weekday:"long",day:"2-digit",month:"long",year:"numeric"});

  const booking = {
    nama: name.value.trim(),
    whatsapp: phone.value.trim(),
    layanan: service.value,
    tanggal: dateInput.value,
    tanggalDisplay: formattedDate,
    jam: timeInput.value,
    catatan: note.value.trim(),
    status: "pending",
    createdAt: serverTimestamp()
  };

  submitBtn.disabled = true;
  statusEl.textContent = "Menyimpan booking...";

  try {
    if (!db) {
      throw new Error("Firebase belum dikonfigurasi. Isi firebase/config.js terlebih dahulu.");
    }

    await addDoc(collection(db, "bookings"), booking);

    const message =
`Halo The Bloom House 🌸

Saya ingin booking salon.

Nama: ${booking.nama}
WhatsApp: ${booking.whatsapp}
Layanan: ${booking.layanan}
Tanggal: ${booking.tanggalDisplay}
Jam: ${booking.jam} WIB
Catatan: ${booking.catatan || "-"}

Mohon konfirmasi ketersediaannya. Terima kasih.`;

    statusEl.textContent = "Booking tersimpan. Membuka WhatsApp...";
    window.open(`https://wa.me/6281296509812?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    form.reset();
    timeInput.innerHTML = '<option value="">Pilih tanggal dahulu</option>';
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Booking belum tersimpan. Periksa konfigurasi Firebase.";
  } finally {
    submitBtn.disabled = false;
  }
});
