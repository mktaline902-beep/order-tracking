document.addEventListener('DOMContentLoaded', function () {

  /* ===== SPLASH SCREEN ===== */
  var splash = document.getElementById('splash');
  var splashBar = document.getElementById('splashBar');
  if (splash && splashBar) {
    var progress = 0;
    var interval = setInterval(function () {
      progress += Math.random() * 18 + 8;
      if (progress >= 100) progress = 100;
      splashBar.style.width = progress + '%';
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(function () {
          splash.classList.add('hidden');
        }, 300);
      }
    }, 200);
  }

  /* FAQ accordion */
  document.querySelectorAll('.faq-question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = this.closest('.faq-item');
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(el) {
        el.classList.remove('open');
      });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* Carousel arrows */
  var carousel = document.getElementById('stockCarousel');
  var leftBtn = document.getElementById('carouselLeft');
  var rightBtn = document.getElementById('carouselRight');
  if (carousel && leftBtn && rightBtn) {
    var scrollAmount = 300;
    leftBtn.addEventListener('click', function() {
      carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    rightBtn.addEventListener('click', function() {
      carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  }

  /* Smooth scroll for anchor links */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
