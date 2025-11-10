document.addEventListener('DOMContentLoaded', () => {
  const progressBar = document.getElementById('progressBar');
  const mainContent = document.getElementById('mainContent');

  document.body.style.scrollBehavior = 'auto';

  if (progressBar) {
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
  }
  if (mainContent) {
    mainContent.style.opacity = '0';
  }
  document.body.style.overflow = 'hidden';

  hidePreloader();

  // --- Scroll Reveal Animation Setup ---
  const intersectionObserverOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.2 // slightly higher for smoother trigger
  };

  const sectionObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.querySelectorAll('.animated-element').forEach(el => {
          el.classList.add('visible');
        });

        if (entry.target.id === 'skillsSection') {
          animateSkillBars();
        }

        if (entry.target.id === 'honorsSection') {
          animateHonorCards();
        }

        observer.unobserve(entry.target); // ensures animation happens once
      }
    });
  }, intersectionObserverOptions);

  document.querySelectorAll('section[id]').forEach(section => {
    sectionObserver.observe(section);
  });

  const heroElements = [
    document.querySelector('.ai-developer-tag'),
    document.querySelector('.hero-name'),
    document.querySelector('.hero-description'),
    document.querySelector('.hero-buttons')
  ];

  heroElements.forEach((el, index) => {
    if (el) {
      el.style.transitionDelay = `${0.3 + index * 0.1}s`;
    }
  });
});


// --- Skill Bar Animation Function ---
function animateSkillBars() {
  document.querySelectorAll('.skill-bar').forEach(bar => {
    if (bar.classList.contains('filled')) return;

    const percent = bar.getAttribute('data-percent');
    bar.style.width = percent + '%';
    bar.classList.add('filled');
  });
}


// --- Preloader Functions ---
function animateProgressText(duration) {
  const percentElement = document.getElementById('progressPercent');
  const end = 100;
  const startTime = Date.now();

  function update() {
    const elapsedTime = Date.now() - startTime;
    const progress = Math.min(1, elapsedTime / duration);
    const currentPercent = Math.floor(progress * end);

    if (percentElement) {
      percentElement.textContent = currentPercent + '%';
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function hidePreloader() {
  const preloader = document.getElementById('preloader');
  const progressBar = document.getElementById('progressBar');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mainContent = document.getElementById('mainContent');

  if (preloader && progressBar) {
    const minLoadTime = 2000;
    const fadeOutDuration = 800;

    progressBar.style.transition = 'width 2s ease-out';
    progressBar.style.width = '100%';
    animateProgressText(minLoadTime);

    setTimeout(() => {
      preloader.classList.add('fade-out');

      if (mainContent) {
        mainContent.style.opacity = '1';
      }

      setTimeout(() => {
        preloader.remove();
        document.body.style.overflow = 'auto';
        document.body.style.scrollBehavior = 'smooth';

        if (hamburgerBtn) {
          hamburgerBtn.style.opacity = '1';
          hamburgerBtn.style.pointerEvents = 'auto';
          hamburgerBtn.onclick = toggleOffCanvasMenu;
        }

        typeWriter();
      }, fadeOutDuration);

    }, minLoadTime);
  }
}


// --- Typing Effect ---
const WORDS = ["Software Engineer", "AI Developer"];
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typingSpeed = 100;
const deletingSpeed = 50;
const pauseTime = 1500;
const typingElement = document.getElementById('typingText');

function typeWriter() {
  if (!typingElement) return;

  const currentWord = WORDS[wordIndex];

  if (isDeleting) {
    typingElement.textContent = currentWord.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typingElement.textContent = currentWord.substring(0, charIndex + 1);
    charIndex++;
  }

  let speed = isDeleting ? deletingSpeed : typingSpeed;

  if (!isDeleting && charIndex === currentWord.length) {
    speed = pauseTime;
    isDeleting = true;
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    wordIndex = (wordIndex + 1) % WORDS.length;
    speed = pauseTime / 2;
  }

  setTimeout(typeWriter, speed);
}


// --- Off-Canvas Menu Toggle ---
function toggleOffCanvasMenu() {
  const offCanvasMenu = document.getElementById('offCanvasMenu');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const isOpening = !offCanvasMenu.classList.contains('show');

  offCanvasMenu.classList.toggle('show');
  document.body.classList.toggle('no-scroll');

  if (hamburgerBtn) {
    hamburgerBtn.style.opacity = isOpening ? '0' : '1';
    hamburgerBtn.style.pointerEvents = isOpening ? 'none' : 'auto';
  }
}


// --- Parallax/Mouse Follow ---
document.addEventListener('mousemove', (e) => {
  const content = document.querySelector('.parallax-content');
  const backgroundName = document.querySelector('.background-name');
  if (!content || !backgroundName) return;

  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const dx = (e.clientX - centerX) / centerX;
  const dy = (e.clientY - centerY) / centerY;
  const contentSensitivity = 15;
  const backgroundSensitivity = 5;

  content.style.transform = `translate(${-dx * contentSensitivity}px, ${-dy * contentSensitivity}px)`;
  backgroundName.style.transform = `translate(calc(-50% + ${dx * backgroundSensitivity}px), calc(-50% + ${dy * backgroundSensitivity}px))`;
});


// --- Honor & Awards Animation Function ---
function animateHonorCards() {
  const honorCards = document.querySelectorAll('.honor-card');
  honorCards.forEach((card, index) => {
    if (card.classList.contains('visible')) return;
    card.style.transitionDelay = `${index * 0.15}s`;
    card.classList.add('visible');
  });
}


// --- Close Off-Canvas Menu When Link Clicked ---
document.addEventListener('DOMContentLoaded', () => {
  const offCanvasMenu = document.getElementById('offCanvasMenu');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const menuLinks = offCanvasMenu.querySelectorAll('a[href^="#"]');

  menuLinks.forEach(link => {
    link.addEventListener('click', () => {
      offCanvasMenu.classList.remove('show');
      document.body.classList.remove('no-scroll');
      if (hamburgerBtn) {
        hamburgerBtn.style.opacity = '1';
        hamburgerBtn.style.pointerEvents = 'auto';
      }
    });
  });
});


// --- Honor & Awards Modal ---
function openHonorModal() {
  document.getElementById('honorModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeHonorModal() {
  document.getElementById('honorModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

window.onclick = function (event) {
  const modal = document.getElementById('honorModal');
  if (event.target === modal) {
    closeHonorModal();
  }
};
// === PROJECT FILTERING ===
const filterButtons = document.querySelectorAll(".filter-btn");
const projectCards = document.querySelectorAll(".project-card");

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const filter = btn.dataset.filter;
    projectCards.forEach(card => {
      card.style.display = (filter === "all" || card.dataset.category === filter)
        ? "block"
        : "none";
    });
  });
});

// === GRID / LIST TOGGLE ===
const gridViewBtn = document.getElementById("gridView");
const listViewBtn = document.getElementById("listView");
const projectContainer = document.querySelector(".projects-container");

gridViewBtn.addEventListener("click", () => {
  gridViewBtn.classList.add("active");
  listViewBtn.classList.remove("active");
  projectContainer.classList.remove("list-view");
  projectContainer.classList.add("grid-view");
});

listViewBtn.addEventListener("click", () => {
  listViewBtn.classList.add("active");
  gridViewBtn.classList.remove("active");
  projectContainer.classList.remove("grid-view");
  projectContainer.classList.add("list-view");
});
// === GRID / LIST VIEW TOGGLE ===
if (gridViewBtn && listViewBtn && projectContainer) {
  gridViewBtn.addEventListener("click", () => {
    gridViewBtn.classList.add("active");
    listViewBtn.classList.remove("active");
    projectContainer.classList.remove("list-view");
    projectContainer.classList.add("grid-view");
  });

  listViewBtn.addEventListener("click", () => {
    listViewBtn.classList.add("active");
    gridViewBtn.classList.remove("active");
    projectContainer.classList.remove("grid-view");
    projectContainer.classList.add("list-view");
  });
}
