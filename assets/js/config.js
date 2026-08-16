/* ==========================================================================
   Site configuration.

   `supportEndpoint` decides how the Support Center submits a request:

     ""      -> offline mode. The request is turned into a reference number,
                a copyable summary, a downloadable .txt and a pre-filled
                mailto: link. Nothing leaves the browser on its own.
     "https://…" -> the form is POSTed there as multipart/form-data, with the
                screenshots attached. Any endpoint that accepts FormData works
                (Formspree, Web3Forms, a Worker, your own API…).

   GitHub Pages only serves static files, so offline mode is the default.
   ========================================================================== */

window.TOON_CONFIG = {
  supportEndpoint: "",

  // Where offline-mode mailto: links are addressed.
  supportEmail: "support@toonworld.app",
  billingEmail: "billing@toonworld.app",

  // Attachment limits, enforced in the browser before submitting.
  maxFileSizeMB: 8,
  maxFiles: 3,
  acceptedTypes: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "image/gif"],

  // Store links — swap in the real ones on launch day.
  iosUrl: "#",
  androidUrl: "#",

  // Keeps a local copy of submitted requests so a visitor can find their
  // reference number again. Never leaves the device.
  keepLocalHistory: true
};
