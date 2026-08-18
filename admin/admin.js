import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "../firebase/config.js";

const ready = !Object.values(firebaseConfig).some((v) =>
  String(v).includes("GANTI_DENGAN"),
);
const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginMessage = document.getElementById("loginMessage");
let auth,
  db,
  allBookings = [];

if (ready) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginView.classList.add("hidden");
      dashboardView.classList.remove("hidden");
      document.getElementById("adminEmail").textContent = user.email || "";
      watchBookings();
    } else {
      dashboardView.classList.add("hidden");
      loginView.classList.remove("hidden");
    }
  });
} else {
  loginMessage.textContent = "Isi firebase/config.js terlebih dahulu.";
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ready) return;
  loginMessage.textContent = "Memeriksa...";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("email").value,
      document.getElementById("password").value,
    );
    loginMessage.textContent = "";
  } catch (err) {
    console.error(err);
    const code = err?.code || "";
    if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found"
    ) {
      loginMessage.textContent = "Email atau password salah.";
    } else if (code === "auth/operation-not-allowed") {
      loginMessage.textContent =
        "Login Email/Password belum diaktifkan di Firebase Authentication.";
    } else if (code === "auth/invalid-api-key") {
      loginMessage.textContent =
        "Firebase API key tidak valid. Periksa firebase/config.js.";
    } else if (code === "auth/network-request-failed") {
      loginMessage.textContent =
        "Koneksi ke Firebase gagal. Periksa internet atau jalankan lewat localhost.";
    } else {
      loginMessage.textContent = `Login gagal (${code || "unknown-error"}). Cek Console browser.`;
    }
  }
});

document
  .getElementById("logoutBtn")
  .addEventListener("click", () => signOut(auth));
document.getElementById("refreshBtn").addEventListener("click", () => render());
document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("statusFilter").addEventListener("change", render);

function watchBookings() {
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
  onSnapshot(
    q,
    (snap) => {
      allBookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error(err);
      document.getElementById("bookingBody").innerHTML =
        `<tr><td colspan="7" class="empty">Tidak bisa membaca booking. Periksa Firestore Rules.</td></tr>`;
    },
  );
}

function render() {
  const search = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();
  const filter = document.getElementById("statusFilter").value;
  const rows = allBookings.filter((b) => {
    const text =
      `${b.nama || ""} ${b.layanan || ""} ${b.whatsapp || ""}`.toLowerCase();
    return (
      (!search || text.includes(search)) &&
      (filter === "all" || b.status === filter)
    );
  });

  document.getElementById("totalCount").textContent = allBookings.length;
  document.getElementById("pendingCount").textContent = allBookings.filter(
    (b) => b.status === "pending",
  ).length;
  document.getElementById("confirmedCount").textContent = allBookings.filter(
    (b) => b.status === "confirmed",
  ).length;
  document.getElementById("completedCount").textContent = allBookings.filter(
    (b) => b.status === "completed",
  ).length;

  const body = document.getElementById("bookingBody");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">Belum ada booking.</td></tr>`;
    return;
  }
  body.innerHTML = rows
    .map((b) => {
      let bookedAt = "-";

      if (b.createdAt) {
        try {
          const date = b.createdAt.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt);

          bookedAt =
            date.toLocaleString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) + " WIB";
        } catch (e) {
          bookedAt = "-";
        }
      }

      return `
    <tr>
      <td><strong>${esc(b.nama)}</strong></td>

      <td>${esc(b.layanan)}</td>

      <td>${esc(b.tanggalDisplay || b.tanggal || "-")}</td>

      <td>${esc(b.jam || "-")} WIB</td>

      <td>${esc(b.whatsapp || "-")}</td>

      <td>${esc(bookedAt)}</td>

      <td>
        <span class="status ${esc(b.status || "pending")}">
          ${esc(b.status || "pending")}
        </span>
      </td>

      <td class="actions">
        ${
          b.status === "pending"
            ? `
              <button
                class="confirm"
                data-id="${b.id}"
                data-status="confirmed">
                Terima
              </button>

              <button
                class="reject"
                data-id="${b.id}"
                data-status="rejected">
                Tolak
              </button>
            `
            : ""
        }

        ${
          b.status === "confirmed"
            ? `
              <button
                class="complete"
                data-id="${b.id}"
                data-status="completed">
                Selesai
              </button>
            `
            : ""
        }
      </td>
    </tr>
  `;
    })
    .join("");

  body
    .querySelectorAll("[data-status]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        changeStatus(btn.dataset.id, btn.dataset.status),
      ),
    );
}

async function changeStatus(id, status) {
  try {
    await updateDoc(doc(db, "bookings", id), { status });
  } catch (err) {
    console.error(err);
    alert("Status belum berhasil diubah.");
  }
}

function esc(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}
