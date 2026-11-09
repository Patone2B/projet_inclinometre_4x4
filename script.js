
/* CONFIGURATION FACILE A MODIFIER */

const CONFIG = {
  smoothing: 0.12,

  // Inverser avec -1 si nécessaire
  pitchDirection: 1,
  rollDirection: 1,

  // Couleurs des modes
  modes: {
    snow: "#71cbff",
    sport: "#ff626b",
    eco: "#65e09b",
    race: "#ffc66c"
  }
};

const $ = id => document.getElementById(id);

const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, v));

const degrees = v => v * 180 / Math.PI;

const difference = (a, b) =>
  ((a - b + 540) % 360) - 180;

let gravity = null;
let zero = null;
let started = false;
let lastReading = 0;

/* MODES DECORATIFS */

function setMode(name) {
  document.documentElement.style.setProperty(
    "--accent",
    CONFIG.modes[name]
  );

  document.querySelectorAll(".mode").forEach(button => {
    const selected = button.dataset.mode === name;

    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected);
  });
}

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

setMode("snow");

/* ORIENTATION DE L'IPHONE */

function screenAxes(a) {
  const orientation = (
    (screen.orientation?.angle ?? window.orientation ?? 0)
    + 360
  ) % 360;

  switch (orientation) {
    case 90:
      return { x: a.y, y: -a.x, z: a.z };

    case 180:
      return { x: -a.x, y: -a.y, z: a.z };

    case 270:
      return { x: -a.y, y: a.x, z: a.z };

    default:
      return { x: a.x, y: a.y, z: a.z };
  }
}

/* CALCUL DES ANGLES REELS */

function angles(vector) {
  const a = screenAxes(vector);

  // iPhone en paysage, presque vertical
  return {
    pitch: degrees(
      Math.atan2(a.z, Math.hypot(a.x, a.y))
    ),

    roll: degrees(
      Math.atan2(a.x, -a.y)
    )
  };
}

/* LECTURE DE L'ACCELEROMETRE */

function onMotion(event) {
  const a = event.accelerationIncludingGravity;

  if (!a || ![a.x, a.y, a.z].every(Number.isFinite)) {
    return;
  }

  // Filtre pour réduire les vibrations
  if (gravity === null) {
    gravity = {
      x: a.x,
      y: a.y,
      z: a.z
    };
  } else {
    for (const axis of ["x", "y", "z"]) {
      gravity[axis] +=
        CONFIG.smoothing * (a[axis] - gravity[axis]);
    }
  }

  lastReading = Date.now();

  $("status").textContent = "● CAPTEURS ACTIFS";
  $("status").classList.add("live");

  // Attendre le calibrage
  if (!zero) return;

  const current = angles(gravity);

  const pitch = clamp(
    CONFIG.pitchDirection *
    (current.pitch - zero.pitch),
    -90,
    90
  );

  const roll = clamp(
    CONFIG.rollDirection *
    difference(current.roll, zero.roll),
    -90,
    90
  );

  // Valeurs numériques
  $("pitchValue").textContent = pitch.toFixed(1) + "°";
  $("rollValue").textContent = roll.toFixed(1) + "°";

  // Horizon artificiel
  $("pitchHorizon").style.transform =
    `translateY(${pitch * 2}px)`;

  $("rollHorizon").style.transform =
    `rotate(${-roll}deg)`;
}

/* ACTIVATION DES CAPTEURS IOS */

$("start").addEventListener("click", async () => {
  try {
    if (!window.isSecureContext) {
      throw new Error("Ouvre le site en HTTPS.");
    }

    if (typeof DeviceMotionEvent === "undefined") {
      throw new Error("Capteurs non disponibles.");
    }

    // Permission spécifique iPhone
    if (
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {
      const permission =
        await DeviceMotionEvent.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "Autorisation des capteurs refusée."
        );
      }
    }

    if (!started) {
      window.addEventListener(
        "devicemotion",
        onMotion
      );

      started = true;
    }

    $("hint").textContent =
      "Capteurs demandés. Attends quelques secondes, " +
      "puis calibre sur terrain horizontal, à l'arrêt.";

    setTimeout(() => {
      if (!lastReading) {
        $("hint").textContent =
          "Aucune mesure reçue. Vérifie les " +
          "autorisations Safari et l'adresse HTTPS.";
      }
    }, 2500);

  } catch (error) {
    $("status").textContent = "● ERREUR CAPTEURS";
    $("hint").textContent = error.message;
  }
});

/* CALIBRAGE DU ZERO */

$("calibrate").addEventListener("click", () => {
  if (
    !gravity ||
    Date.now() - lastReading > 1500
  ) {
    $("hint").textContent =
      "Active les capteurs et attends une " +
      "mesure récente avant de calibrer.";
    return;
  }

  zero = angles(gravity);

  $("pitchValue").textContent = "0.0°";
  $("rollValue").textContent = "0.0°";

  $("pitchHorizon").style.transform =
    "translateY(0)";

  $("rollHorizon").style.transform =
    "rotate(0deg)";

  $("hint").textContent =
    "Zéro calibré. Angles affichés " +
    "par rapport à cette position.";
});

/* RECALIBRAGE APRES ROTATION */

window.addEventListener("orientationchange", () => {
  zero = null;

  $("hint").textContent =
    "Orientation modifiée : calibre à nouveau le zéro.";
});
