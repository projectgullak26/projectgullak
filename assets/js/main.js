/* ==========================================================================
   PROJECT GULLAK — main.js    Navigation, scroll reveals, topic cards, form.
   No dependencies.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Sticky header state ---------------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------- Mobile navigation ---------------- */
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.getElementById("mobile-menu");

  function setNav(open) {
    if (!toggle || !panel) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    panel.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  }

  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });

    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setNav(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1180) setNav(false);
    });
  }

  /* ---------------- Scroll reveal ---------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

      revealEls.forEach(function (el, i) {
        // Stagger siblings inside a grid for a gentle cascade
        var parent = el.parentElement;
        var index = parent ? Array.prototype.indexOf.call(parent.children, el) : i;
        if (parent && parent.children.length > 1 && index < 6) {
          el.style.setProperty("--delay", (index * 0.08) + "s");
        }
        io.observe(el);
      });
    }
  }

  /* ---------------- Interactive topic cards ---------------- */
  Array.prototype.forEach.call(document.querySelectorAll(".topic-card"), function (card) {
    var btn = card.querySelector(".topic-toggle");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var open = card.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
      var label = btn.querySelector(".label");
      if (label) label.textContent = open ? "Hide example" : "Read an example";
    });
  });

  /* ---------------- Our Work — expandable session boxes ----------------
     Clicking a box (or its + icon) expands that box to full width and pushes
     the boxes below it down. Only one box stays open at a time. */
  var sessionCards = Array.prototype.slice.call(document.querySelectorAll(".session-card"));

  function closeSession(card) {
    card.classList.remove("is-open");
    var h = card.querySelector(".session-head");
    if (h) h.setAttribute("aria-expanded", "false");
  }

  sessionCards.forEach(function (card) {
    var head = card.querySelector(".session-head");
    if (!head) return;

    head.addEventListener("click", function () {
      var willOpen = !card.classList.contains("is-open");
      sessionCards.forEach(function (other) {
        if (other !== card) closeSession(other);
      });
      card.classList.toggle("is-open", willOpen);
      head.setAttribute("aria-expanded", String(willOpen));
    });
  });

  /* ---------------- Contact form — real submission to Formspree ----------------
     Endpoint comes from the form's action attribute in contact.html.
     Validated client-side, then POSTed via fetch (Formspree AJAX API). */
  var form = document.getElementById("contact-form");
  if (form) {
    var status = document.getElementById("form-status");
    var submitBtn = form.querySelector('button[type="submit"]');

    function formErrorText(data) {
      if (data && data.errors && data.errors.length) return "Sorry — " + data.errors.join(", ") + ".";
      if (data && data.error) return "Sorry — " + data.error + ".";
      return "Sorry — something went wrong sending your message. Please try again.";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = form.querySelector("#cf-name");
      var email = form.querySelector("#cf-email");
      var message = form.querySelector("#cf-message");

      var errors = [];
      if (!name.value.trim()) errors.push("your name");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) errors.push("a valid email");
      if (!message.value.trim()) errors.push("a message");

      status.classList.add("is-visible");
      if (errors.length) {
        status.classList.add("is-error");
        status.textContent = "Please enter " + errors.join(", ") + " before sending.";
        return;
      }

      var endpoint = form.getAttribute("action");
      if (submitBtn) submitBtn.disabled = true;
      status.classList.remove("is-error");
      status.textContent = "Sending your message…";

      fetch(endpoint, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: new FormData(form)
      })
        .then(function (res) {
          if (res.ok) {
            status.classList.remove("is-error");
            status.textContent = "Thank you, " + name.value.trim().split(" ")[0] +
              " — your message has been sent. We'll get back to you soon.";
            form.reset();
          } else {
            return res.json().catch(function () { return {}; }).then(function (data) {
              status.classList.add("is-error");
              status.textContent = formErrorText(data);
            });
          }
        })
        .catch(function () {
          status.classList.add("is-error");
          status.textContent = "Network error — please check your connection and try again.";
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }
})();
