document.addEventListener('DOMContentLoaded', () => {
  let products = [];
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  let currentPage = 0;
  const productsPerPage = 6;
  let imageErrorShown = sessionStorage.getItem('imageErrorShown') === 'true';

  // Toast notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Debounce utility
  function debounce(fn, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  // Fetch products with retry mechanism
  async function fetchProducts(attempts = 3) {
    try {
      const cacheBuster = `?v=${Date.now()}`;
      const response = await fetch(`/product.json${cacheBuster}`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      products = await response.json();
      localStorage.setItem('products', JSON.stringify(products));
      return products;
    } catch (error) {
      if (attempts > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchProducts(attempts - 1);
      }
      showToast('Unable to load products. Please try again later.', 'error');
      return [];
    }
  }

  // Fetch testimonials with fallback
  async function fetchTestimonials() {
    const cached = localStorage.getItem('testimonials');
    if (cached) return JSON.parse(cached);
    try {
      const response = await fetch('/public/testimonials.json');
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      localStorage.setItem('testimonials', JSON.stringify(data));
      return data;
    } catch (error) {
      showToast('Testimonials unavailable. Showing default.', 'info');
      const defaultTestimonial = [{
        image: '/images/placeholder.png',
        quote: 'Beautiful craftsmanship! Our custom lamp is a cherished keepsake.',
        name: 'Jane Doe'
      }];
      localStorage.setItem('testimonials', JSON.stringify(defaultTestimonial));
      return defaultTestimonial;
    }
  }

  // Handle image errors
  function handleImageError(img, src) {
    img.onerror = null;
    img.src = '/images/placeholder.png';
    if (!imageErrorShown) {
      showToast(`Failed to load image: ${src}`, 'error');
      sessionStorage.setItem('imageErrorShown', 'true');
      imageErrorShown = true;
    }
  }

  // Render products
  async function renderProducts(category = 'all') {
    const grid = document.querySelector('.product-grid');
    if (!grid) {
      showToast('Product grid not found.', 'error');
      return;
    }
    grid.classList.add('loading');

    const filteredProducts = category === 'all'
      ? products
      : products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    const start = currentPage * productsPerPage;
    const end = start + productsPerPage;
    const pageProducts = filteredProducts.slice(start, end);

    if (currentPage === 0) grid.innerHTML = '';
    if (pageProducts.length === 0 && currentPage === 0) {
      grid.innerHTML = '<p class="empty-cart">No products found in this category.</p>';
      grid.classList.remove('loading');
      return;
    }

    pageProducts.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      const imageSrc = p.images?.[0] ?? '/images/placeholder.png';
      card.innerHTML = `
        <span class="category-badge">${p.category}</span>
        <button class="wishlist-btn ${favorites.some(fav => fav.id === p.id) ? 'active' : ''}" data-id="${p.id}" aria-label="${favorites.some(fav => fav.id === p.id) ? 'Remove' : 'Add'} ${p.name} to favorites">
          <i class="${favorites.some(fav => fav.id === p.id) ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <img src="${imageSrc}" alt="${p.name}" width="200" height="200" loading="lazy" onerror="handleImageError(this, '${imageSrc}')" />
        <div class="content">
          <h3>${p.name}</h3>
          <p>${p.description}</p>
          <span class="price">$${p.price.toFixed(2)}</span>
          <div class="button-container">
            <button class="quick-view-btn" data-id="${p.id}" aria-label="Quick view ${p.name}">Quick View</button>
            <button class="add-to-cart-btn" data-id="${p.id}" aria-label="Add ${p.name} to cart">Add to Cart</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = end >= filteredProducts.length ? 'none' : 'block';
    }
    grid.classList.remove('loading');

    // Attach event listeners
    grid.querySelectorAll('.quick-view-btn').forEach(btn => {
      btn.removeEventListener('click', openQuickView);
      btn.addEventListener('click', () => openQuickView(btn.dataset.id));
    });
    grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.removeEventListener('click', addToCart);
      btn.addEventListener('click', () => addToCart(btn.dataset.id));
    });
    grid.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.removeEventListener('click', toggleFavorite);
      btn.addEventListener('click', () => toggleFavorite(btn.dataset.id));
    });
  }

  // Render favorites
  function renderFavorites() {
    const favoritesGrid = document.getElementById('favorites-grid');
    if (!favoritesGrid) {
      showToast('Favorites grid not found.', 'error');
      return;
    }
    favoritesGrid.innerHTML = '';
    if (favorites.length === 0) {
      favoritesGrid.innerHTML = '<p class="empty-favorites">No favorites added yet.</p>';
      return;
    }
    favorites.forEach(product => {
      const card = document.createElement('div');
      card.className = 'product-card';
      const imageSrc = product.images?.[0] ?? '/images/placeholder.png';
      card.innerHTML = `
        <span class="category-badge">${product.category}</span>
        <button class="wishlist-btn active" data-id="${product.id}" aria-label="Remove ${product.name} from favorites">
          <i class="fas fa-heart"></i>
        </button>
        <img src="${imageSrc}" alt="${product.name}" width="200" height="200" loading="lazy" onerror="handleImageError(this, '${imageSrc}')" />
        <div class="content">
          <h3>${product.name}</h3>
          <span class="price">$${product.price.toFixed(2)}</span>
          <div class="button-container">
            <button class="quick-view-btn" data-id="${product.id}" aria-label="Quick view ${product.name}">Quick View</button>
            <button class="add-to-cart-btn" data-id="${product.id}" aria-label="Add ${product.name} to cart">Add to Cart</button>
          </div>
        </div>
      `;
      favoritesGrid.appendChild(card);
    });

    favoritesGrid.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.removeEventListener('click', toggleFavorite);
      btn.addEventListener('click', () => toggleFavorite(btn.dataset.id));
    });
    favoritesGrid.querySelectorAll('.quick-view-btn').forEach(btn => {
      btn.removeEventListener('click', openQuickView);
      btn.addEventListener('click', () => openQuickView(btn.dataset.id));
    });
    favoritesGrid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.removeEventListener('click', addToCart);
      btn.addEventListener('click', () => addToCart(btn.dataset.id));
    });
  }

  // Filter products
  function filterProducts(category) {
    currentPage = 0;
    renderProducts(category);
  }

  // Open quick view modal with carousel
  function openQuickView(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) {
      showToast('Product not available.', 'error');
      return;
    }

    const modal = document.getElementById('quick-view-modal');
    const nameElement = modal.querySelector('#modal-product-name');
    const descElement = modal.querySelector('#modal-product-description');
    const priceElement = modal.querySelector('#modal-product-price');
    const carousel = modal.querySelector('.carousel');
    const customizationDiv = document.getElementById('customization-options');
    const relatedGrid = document.getElementById('related-products-grid');
    const addToCartBtn = modal.querySelector('#add-to-cart-btn');
    const saveForLaterBtn = modal.querySelector('#save-for-later-btn');

    if (!nameElement || !descElement || !priceElement || !carousel || !customizationDiv || !relatedGrid || !addToCartBtn || !saveForLaterBtn) {
      showToast('Error displaying product details.', 'error');
      return;
    }

    modal.dataset.id = productId;
    nameElement.textContent = product.name || 'Unknown Product';
    descElement.textContent = product.description || 'No description available.';
    priceElement.textContent = product.price ? `$${product.price.toFixed(2)}` : 'Price unavailable';

    // Populate carousel
    carousel.innerHTML = `
      <div class="carousel-inner">
        ${product.images?.length > 0 ? product.images.map((img, i) => `
          <img src="${img}" alt="${product.name} view ${i + 1}" class="carousel-item ${i === 0 ? 'active' : ''}" width="300" height="300" loading="lazy" onerror="handleImageError(this, '${img}')" />
        `).join('') : `<img src="/images/placeholder.png" alt="${product.name} view 1" class="carousel-item active" width="300" height="300" loading="lazy" />`}
      </div>
      <button class="carousel-prev" aria-label="Previous image">❮</button>
      <button class="carousel-next" aria-label="Next image">❯</button>
    `;

    // Customization options
    customizationDiv.innerHTML = product.customization ? `
      <label for="custom-input">${product.customization.label}</label>
      <input type="${product.customization.type === 'image' ? 'file' : 'text'}" id="custom-input" placeholder="${product.customization.label}" accept="${product.customization.type === 'image' ? 'image/*' : ''}" aria-label="${product.customization.label}" data-type="${product.customization.type}">
    ` : '<p>No customization available.</p>';

    // Related products
    relatedGrid.innerHTML = (product.relatedProducts || []).map(relatedId => {
      const related = products.find(p => p.id == relatedId);
      return related ? `
        <div class="related-product">
          <img src="${related.images?.[0] ?? '/images/placeholder.png'}" alt="${related.name}" width="100" height="100" loading="lazy" onerror="handleImageError(this, '${related.images?.[0]}')" />
          <span>${related.name}</span>
        </div>
      ` : '';
    }).join('');

    saveForLaterBtn.textContent = favorites.some(fav => fav.id == productId) ? 'Remove from Favorites' : 'Save for Later';
    saveForLaterBtn.dataset.id = productId;

    modal.style.display = 'block';
    modal.querySelector('.modal-content').focus();

    // Carousel navigation
    const carouselInner = carousel.querySelector('.carousel-inner');
    const carouselItems = carousel.querySelectorAll('.carousel-item');
    let currentIndex = 0;

    function updateCarousel() {
      requestAnimationFrame(() => {
        carouselItems.forEach((item, i) => {
          item.classList.toggle('active', i === currentIndex);
        });
      });
    }

    carousel.querySelector('.carousel-prev').addEventListener('click', () => {
      currentIndex = currentIndex > 0 ? currentIndex - 1 : carouselItems.length - 1;
      updateCarousel();
    });

    carousel.querySelector('.carousel-next').addEventListener('click', () => {
      currentIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
      updateCarousel();
    });

    // Add to cart button
    const newAddBtn = addToCartBtn.cloneNode(true);
    addToCartBtn.parentNode.replaceChild(newAddBtn, addToCartBtn);
    newAddBtn.dataset.id = productId;
    newAddBtn.addEventListener('click', () => {
      addToCart(productId, true);
      closeModal();
    });

    // Save for later button
    const newSaveBtn = saveForLaterBtn.cloneNode(true);
    saveForLaterBtn.parentNode.replaceChild(newSaveBtn, saveForLaterBtn);
    newSaveBtn.dataset.id = productId;
    newSaveBtn.addEventListener('click', () => {
      toggleFavorite(productId);
      closeModal();
    });
  }

  // Close modal
  function closeModal() {
    const modal = document.getElementById('quick-view-modal');
    if (modal) {
      modal.style.display = 'none';
      document.querySelector('header').focus();
    }
  }

  // Add to cart
  function addToCart(productId, fromModal = false) {
    const product = products.find(p => p.id == productId);
    if (!product) {
      showToast('Product not available.', 'error');
      return;
    }

    let customization = null;
    if (fromModal && product.customization) {
      const input = document.getElementById('custom-input');
      if (input) {
        if (product.customization.type === 'image' && input.files?.[0]) {
          customization = { type: 'image', fileName: input.files[0].name };
        } else if (product.customization.type === 'text' && input.value.trim()) {
          customization = { type: 'text', value: input.value.trim() };
        } else {
          showToast('Please provide customization details.', 'error');
          return;
        }
      }
    }

    const existingItem = cart.find(item => item.id == productId && JSON.stringify(item.customization) === JSON.stringify(customization));
    if (existingItem) {
      existingItem.quantity++;
    } else {
      cart.push({ id: productId, quantity: 1, customization });
    }
    saveCart();
    updateMiniCart();
    showToast(`Added "${product.name}" to cart.`, 'success');
  }

  // Remove from cart
  function removeFromCart(productId, customizationIndex) {
    cart = cart.filter((item, index) => !(item.id == productId && index === customizationIndex));
    saveCart();
    renderCartPage();
    updateMiniCart();
    showToast('Product removed from cart.', 'success');
  }

  // Toggle favorite
  function toggleFavorite(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) {
      showToast('Product not available.', 'error');
      return;
    }
    const index = favorites.findIndex(fav => fav.id === product.id);
    if (index === -1) {
      favorites.push({
        id: product.id,
        name: product.name,
        price: product.price,
        images: product.images,
        category: product.category
      });
      showToast(`Added "${product.name}" to favorites.`, 'success');
    } else {
      favorites.splice(index, 1);
      showToast(`Removed "${product.name}" from favorites.`, 'info');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoriteButtons();
    renderFavorites();
  }

  // Update favorite buttons
  function updateFavoriteButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      const id = Number(btn.dataset.id);
      btn.classList.toggle('active', favorites.some(fav => fav.id === id));
      const icon = btn.querySelector('i');
      icon.className = favorites.some(fav => fav.id === id) ? 'fas fa-heart' : 'far fa-heart';
      btn.setAttribute('aria-label', `${favorites.some(fav => fav.id === id) ? 'Remove' : 'Add'} ${products.find(p => p.id === id)?.name || 'product'} to favorites`);
    });
    const saveForLaterBtn = document.querySelector('#save-for-later-btn');
    if (saveForLaterBtn) {
      const id = Number(saveForLaterBtn.dataset.id);
      saveForLaterBtn.textContent = favorites.some(fav => fav.id === id) ? 'Remove from Favorites' : 'Save for Later';
    }
  }

  // Save cart
  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
  }

  // Update cart count
  function updateCartCount() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) cartCount.textContent = total;
  }

  // Render cart page
  function renderCartPage() {
    const cartSection = document.getElementById('cart');
    const cartItems = cartSection?.querySelector('.cart-items');
    if (!cartItems) return;

    cartItems.innerHTML = '';
    if (cart.length === 0) {
      cartItems.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
      return;
    }

    cart.forEach((item, index) => {
      const product = products.find(p => p.id == item.id);
      if (!product) return;
      const div = document.createElement('div');
      div.className = 'cart-item';
      const imageSrc = product.images?.[0] ?? '/images/placeholder.png';
      div.innerHTML = `
        <img src="${imageSrc}" alt="${product.name}" width="50" height="50" loading="lazy" onerror="handleImageError(this, '${imageSrc}')" />
        <div class="cart-item-details">
          <h3>${product.name}</h3>
          ${item.customization ? `
            <p>Customization: ${item.customization.type === 'image' ? `Image (${item.customization.fileName})` : item.customization.value}</p>
          ` : ''}
          <p>Price: $${product.price.toFixed(2)}</p>
          <p>Qty: <input type="number" value="${item.quantity}" min="1" data-id="${item.id}" data-custom-index="${index}" aria-label="Quantity for ${product.name}"></p>
          <p>Subtotal: $${(product.price * item.quantity).toFixed(2)}</p>
          <button class="remove-btn" data-id="${item.id}" data-custom-index="${index}" aria-label="Remove ${product.name} from cart">Remove</button>
        </div>
      `;
      cartItems.appendChild(div);
    });

    cartItems.querySelectorAll('input[type="number"]').forEach(input => {
      input.removeEventListener('change', updateCartQuantity);
      input.addEventListener('change', updateCartQuantity);
    });
    cartItems.querySelectorAll('.remove-btn').forEach(btn => {
      btn.removeEventListener('click', removeFromCartHandler);
      btn.addEventListener('click', removeFromCartHandler);
    });

    const total = cart.reduce((sum, item) => {
      const product = products.find(p => p.id == item.id);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    const totalElement = cartSection.querySelector('.cart-total h3');
    if (totalElement) totalElement.textContent = `Total: $${total.toFixed(2)}`;
  }

  function updateCartQuantity(e) {
    const id = e.target.dataset.id;
    const customIndex = Number(e.target.dataset.customIndex);
    const newQty = parseInt(e.target.value);
    if (newQty > 0) {
      const item = cart.find((i, idx) => i.id == id && idx === customIndex);
      if (item) {
        item.quantity = newQty;
        saveCart();
        renderCartPage();
      }
    } else {
      removeFromCart(id, customIndex);
    }
  }

  function removeFromCartHandler() {
    const id = this.dataset.id;
    const customIndex = Number(this.dataset.customIndex);
    removeFromCart(id, customIndex);
  }

  // Update mini-cart
  function updateMiniCart() {
    const miniCartContent = document.querySelector('.mini-cart-content');
    if (!miniCartContent) return;
    if (cart.length === 0) {
      miniCartContent.innerHTML = '<p>Your cart is empty.</p>';
      return;
    }
    miniCartContent.innerHTML = cart.map(item => {
      const product = products.find(p => p.id == item.id);
      if (!product) return '';
      const imageSrc = product.images?.[0] ?? '/images/placeholder.png';
      return `
        <div class="mini-cart-item">
          <img src="${imageSrc}" alt="${product.name}" width="30" height="30" loading="lazy" onerror="handleImageError(this, '${imageSrc}')" />
          <span>${product.name} x ${item.quantity}${item.customization ? ` (${item.customization.type === 'image' ? 'Image' : item.customization.value})` : ''}</span>
          <span>$${(product.price * item.quantity).toFixed(2)}</span>
        </div>
      `;
    }).join('');
  }

  // Handle navigation
  function handleHashChange() {
    const hash = window.location.hash || '#home';
    const sections = document.querySelectorAll('section');
    const alwaysVisible = ['faq', 'testimonials', 'newsletter'];
    const shopSection = document.getElementById('shop');
    const favoritesSection = document.getElementById('favorites');
    const homeSection = document.getElementById('home');

    sections.forEach(sec => {
      sec.style.display = alwaysVisible.includes(sec.id) ? 'block' : 'none';
    });

    if (hash === '#home') {
      if (homeSection) homeSection.style.display = 'block';
      renderTestimonials();
    } else if (hash === '#favorites') {
      if (shopSection && favoritesSection) {
        shopSection.style.display = 'block';
        renderFavorites();
        favoritesSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (hash === '#shop') {
      if (shopSection) {
        shopSection.style.display = 'block';
        renderProducts();
      }
    } else if (hash === '#cart') {
      const cartSection = document.getElementById('cart');
      if (cartSection) {
        cartSection.style.display = 'block';
        renderCartPage();
        cartSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      const targetSection = document.getElementById(hash.substring(1));
      if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  // Intersection Observer for sections
  function setupIntersectionObserver() {
    const sections = document.querySelectorAll('.hero, .shop, .testimonials, .favorites, .cart, .faq, .newsletter');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    sections.forEach(section => observer.observe(section));
  }

  // Render testimonials
  async function renderTestimonials() {
    const grid = document.querySelector('.testimonial-grid');
    if (!grid) return;
    const data = await fetchTestimonials();
    if (data.length === 0) {
      grid.innerHTML = '<p>No testimonials available.</p>';
      return;
    }
    grid.innerHTML = data.map(testimonial => `
      <div class="testimonial">
        <img src="${testimonial.image || '/images/placeholder.png'}" alt="${testimonial.name}" width="100" height="100" loading="lazy" onerror="handleImageError(this, '${testimonial.image}')" />
        <p>"${testimonial.quote}"</p>
        <h4>${testimonial.name}</h4>
      </div>
    `).join('');
  }

  // Initialize
  async function init() {
    await fetchProducts();
    renderProducts();
    renderFavorites();
    renderTestimonials();
    updateCartCount();
    updateMiniCart();
    updateFavoriteButtons();
    setTimeout(handleHashChange, 0);
    setupIntersectionObserver();

    const closeBtn = document.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }
  }

  // Event listeners
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('nav-open');
      navToggle.classList.toggle('active');
      navToggle.setAttribute('aria-expanded', isOpen);
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('nav-open');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !navToggle.contains(e.target) && navLinks.classList.contains('nav-open')) {
        navLinks.classList.remove('nav-open');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll('.occasion-btn').forEach(btn => {
    btn.addEventListener('click', debounce(() => {
      document.querySelectorAll('.occasion-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterProducts(btn.dataset.category);
    }, 300));
  });

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      currentPage++;
      renderProducts(document.querySelector('.occasion-btn.active')?.dataset.category ?? 'all');
    });
  }

  const cartLink = document.querySelector('.cart-link');
  const miniCartDropdown = document.querySelector('.mini-cart-dropdown');
  if (cartLink && miniCartDropdown) {
    cartLink.addEventListener('mouseenter', () => {
      miniCartDropdown.style.display = 'block';
    });
    cartLink.addEventListener('mouseleave', () => {
      miniCartDropdown.style.display = 'none';
    });
  }

  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const answer = question.nextElementSibling;
      const isOpen = answer.style.display === 'block';
      answer.style.display = isOpen ? 'none' : 'block';
      question.setAttribute('aria-expanded', !isOpen);
    });
  });

  document.querySelectorAll('.newsletter-form, .footer-newsletter form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const email = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
      }
      showToast('Thank you for subscribing!', 'success');
      emailInput.value = '';
    });
  });

  const modal = document.getElementById('quick-view-modal');
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.style.display === 'block') closeModal();
  });

  window.addEventListener('hashchange', debounce(handleHashChange, 100));

  init();
});