document.addEventListener('DOMContentLoaded', () => {
  let products = [];
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
  let currentPage = 0;
  const productsPerPage = 6;
  let currentRenderer = null;
  let currentScene = null;
  let currentCamera = null;
  let heroModelLoaded = false;

  // Dispose Three.js resources
  function disposeThreeJsResources() {
    if (currentRenderer) {
      currentRenderer.dispose();
      currentRenderer = null;
    }
    if (currentScene) {
      currentScene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      currentScene = null;
    }
    currentCamera = null;
  }

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

  // Fetch products
  async function fetchProducts() {
    const cached = localStorage.getItem('products');
    if (cached) {
      products = JSON.parse(cached);
      return products;
    }
    try {
      const response = await fetch('/product.json');
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      products = await response.json();
      localStorage.setItem('products', JSON.stringify(products));
      return products;
    } catch (error) {
      showToast('Unable to load products. Please try again.', 'error');
      return [];
    }
  }

  // Fetch testimonials
  async function fetchTestimonials() {
    const cached = localStorage.getItem('testimonials');
    if (cached) return JSON.parse(cached);
    try {
      const response = await fetch('/testimonials.json');
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      localStorage.setItem('testimonials', JSON.stringify(data));
      return data;
    } catch (error) {
      showToast('Unable to load testimonials.', 'info');
      return [];
    }
  }

  // Render 3D model
  function render3DModel(modelUrl, canvas) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      canvas.innerHTML = '<p>3D rendering failed.</p>';
      showToast('3D rendering failed.', 'error');
      return;
    }

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      canvas.innerHTML = '<p>WebGL not supported on this device.</p>';
      showToast('WebGL not supported.', 'error');
      return;
    }

    disposeThreeJsResources();

    const width = Math.min(canvas.parentElement.clientWidth || 400, 400);
    const height = Math.min(canvas.parentElement.clientHeight || 300, 300);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0xEEE8E2, 1); // Match --beige-light

    currentScene = scene;
    currentCamera = camera;
    currentRenderer = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;

    const loader = new THREE.GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        scene.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2 / maxDim;
        model.scale.set(scale, scale, scale);
        model.position.sub(center.multiplyScalar(scale));
        camera.position.set(0, 0, 3);
        controls.update();
        const animate = () => {
          if (!currentRenderer) return;
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();
      },
      undefined,
      (error) => {
        canvas.innerHTML = '<p>Failed to load 3D model.</p>';
        showToast('Unable to load 3D model. Please try again.', 'error');
      }
    );

    const resizeHandler = () => {
      const newWidth = Math.min(canvas.parentElement.clientWidth || 400, 400);
      const newHeight = Math.min(canvas.parentElement.clientHeight || 300, 300);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${height}px`;
    };
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      disposeThreeJsResources();
    };
  }

  // Render hero 3D model when in view
  function setupHero3DModel() {
    const heroSection = document.getElementById('home');
    const heroCanvas = document.getElementById('hero-3d-model');
    if (!heroCanvas) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !heroModelLoaded) {
        const featuredProduct = products.find(p => p.featured) || products[0];
        if (featuredProduct?.modelUrl) {
          heroModelLoaded = true;
          render3DModel(featuredProduct.modelUrl, heroCanvas);
        } else {
          heroCanvas.innerHTML = '<p>3D model not available.</p>';
        }
      }
    }, { threshold: 0.1 });
    observer.observe(heroSection);
  }

  // Render products
  async function renderProducts(category = 'all') {
    const grid = document.querySelector('.product-grid');
    if (!grid) return;
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
      card.innerHTML = `
        ${p.isNew ? '<span class="new-badge">New</span>' : ''}
        <span class="category-badge">${p.category}</span>
        <button class="wishlist-btn" data-id="${p.id}" aria-label="Add ${p.name} to wishlist"><i class="fas fa-heart"></i></button>
        <img src="${p.thumbnail || p.image}" alt="${p.name}" loading="lazy" />
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
    loadMoreBtn.style.display = end >= filteredProducts.length ? 'none' : 'block';
    grid.classList.remove('loading');

    document.querySelectorAll('.quick-view-btn').forEach(btn => {
      btn.addEventListener('click', () => openQuickView(btn.dataset.id));
    });
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', () => addToCart(btn.dataset.id));
    });
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleWishlist(btn.dataset.id));
    });
  }

  // Filter products
  function filterProducts(category) {
    currentPage = 0;
    renderProducts(category);
  }

  // Open quick view modal
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
    const modelElement = document.getElementById('product-3d-model');
    const carousel = modal.querySelector('.carousel');
    const customizationDiv = document.getElementById('customization-options');
    const relatedGrid = document.getElementById('related-products-grid');
    const addToCartBtn = modal.querySelector('#add-to-cart-btn');

    if (!nameElement || !descElement || !priceElement || !modelElement || !carousel || !customizationDiv || !relatedGrid || !addToCartBtn) {
      showToast('Error displaying product details.', 'error');
      return;
    }

    nameElement.textContent = product.name || 'Unknown Product';
    descElement.textContent = product.description || 'No description available.';
    priceElement.textContent = product.price ? `$${product.price.toFixed(2)}` : 'Price unavailable';

    carousel.innerHTML = (product.images || [product.image]).map((img, i) => `
      <img src="${img}" alt="${product.name} view ${i + 1}" loading="lazy" />
    `).join('');

    customizationDiv.innerHTML = product.customization ? `
      <label for="custom-input">${product.customization.label}</label>
      ${product.customization.type === 'select' ? 
        `<select id="custom-input">
           ${product.customization.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
         </select>` :
        `<input type="${product.customization.type === 'image' ? 'file' : 'text'}" id="custom-input" placeholder="${product.customization.label}" accept="${product.customization.type === 'image' ? 'image/*' : ''}" aria-label="${product.customization.label}">`
      }
    ` : '<p>No customization available.</p>';

    relatedGrid.innerHTML = (product.relatedProducts || []).map(relatedId => {
      const related = products.find(p => p.id == relatedId);
      return related ? `
        <div class="related-product">
          <img src="${related.image}" alt="${related.name}" loading="lazy" />
          <span>${related.name}</span>
        </div>
      ` : '';
    }).join('');

    modal.style.display = 'block';
    modal.focus();

    modelElement.innerHTML = '<p>Loading 3D model...</p>';
    if (product.modelUrl) {
      render3DModel(product.modelUrl, modelElement);
    } else {
      modelElement.innerHTML = '<p>3D model not available.</p>';
    }

    const newBtn = addToCartBtn.cloneNode(true);
    addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
    newBtn.dataset.id = productId;
    newBtn.addEventListener('click', () => {
      addToCart(productId);
      closeModal();
    });
  }

  // Close modal
  function closeModal() {
    const modal = document.getElementById('quick-view-modal');
    if (modal) {
      modal.style.display = 'none';
      disposeThreeJsResources();
    }
  }

  // Add to cart
  function addToCart(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) {
      showToast('Product not available.', 'error');
      return;
    }
    const existingItem = cart.find(item => item.id == productId);
    if (existingItem) {
      existingItem.quantity++;
    } else {
      cart.push({ id: productId, quantity: 1 });
    }
    saveCart();
    updateMiniCart();
    showToast(`Added "${product.name}" to cart.`, 'success');
  }

  // Remove from cart
  function removeFromCart(productId) {
    cart = cart.filter(item => item.id != productId);
    saveCart();
    renderCartPage();
    updateMiniCart();
    showToast('Item removed from cart.', 'success');
  }

  // Toggle wishlist
  function toggleWishlist(productId) {
    if (wishlist.includes(productId)) {
      wishlist = wishlist.filter(id => id != productId);
      showToast('Removed from wishlist.', 'info');
    } else {
      wishlist.push(productId);
      showToast('Added to wishlist!', 'success');
    }
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistButtons();
  }

  // Update wishlist buttons
  function updateWishlistButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      const id = btn.dataset.id;
      btn.classList.toggle('active', wishlist.includes(id));
    });
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
    const cartItems = cartSection.querySelector('.cart-items');
    if (!cartItems) return;

    if (cart.length === 0) {
      cartItems.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
      return;
    }

    cartItems.innerHTML = '';
    cart.forEach(item => {
      const product = products.find(p => p.id == item.id);
      if (!product) return;
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <img src="${product.image}" alt="${product.name}" width="50" loading="lazy" />
        <h3>${product.name}</h3>
        <p>Qty: <input type="number" value="${item.quantity}" min="1" data-id="${item.id}" aria-label="Quantity for ${product.name}"></p>
        <p>Subtotal: $${(product.price * item.quantity).toFixed(2)}</p>
        <button class="remove-btn" data-id="${item.id}" aria-label="Remove ${product.name} from cart">Remove</button>
      `;
      cartItems.appendChild(div);
    });

    cartItems.querySelectorAll('input[type="number"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const newQty = parseInt(e.target.value);
        if (newQty > 0) {
          const item = cart.find(i => i.id == id);
          if (item) {
            item.quantity = newQty;
            saveCart();
            renderCartPage();
          }
        } else {
          removeFromCart(id);
        }
      });
    });
    cartItems.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
    });

    const total = cart.reduce((sum, item) => {
      const product = products.find(p => p.id == item.id);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    const totalElement = cartSection.querySelector('.cart-total h3');
    if (totalElement) totalElement.textContent = `Total: $${total.toFixed(2)}`;
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
      return `
        <div class="mini-cart-item">
          <img src="${product.image}" alt="${product.name}" width="30" loading="lazy" />
          <span>${product.name} x ${item.quantity}</span>
          <span>$${(product.price * item.quantity).toFixed(2)}</span>
        </div>
      `;
    }).join('');
  }

  // Handle navigation
  function handleHashChange() {
    const hash = window.location.hash || '#home';
    document.querySelectorAll('section').forEach(sec => {
      sec.style.display = ('#' + sec.id) === hash ? 'block' : 'none';
    });
    if (hash === '#cart') renderCartPage();
    disposeThreeJsResources();
  }

  // Intersection Observer for sections
  function setupIntersectionObserver() {
    const sections = document.querySelectorAll('.hero, .shop, .testimonials, .faq');
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
      grid.innerHTML = '<p>Testimonials unavailable.</p>';
      return;
    }
    grid.innerHTML = data.map(testimonial => `
      <div class="testimonial">
        <img src="${testimonial.image}" alt="${testimonial.name}" loading="lazy" />
        <p>"${testimonial.quote}"</p>
        <h4>${testimonial.name}</h4>
      </div>
    `).join('');
  }

  // Initialize
  async function init() {
    await fetchProducts();
    renderProducts();
    renderTestimonials();
    updateCartCount();
    updateMiniCart();
    updateWishlistButtons();
    handleHashChange();
    setupIntersectionObserver();
    setupHero3DModel();
  }

  // Event listeners
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('nav-open');
    navToggle.classList.toggle('active');
    navToggle.setAttribute('aria-expanded', navLinks.classList.contains('nav-open'));
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

  document.querySelectorAll('.occasion-btn').forEach(btn => {
    btn.addEventListener('click', debounce(() => {
      document.querySelectorAll('.occasion-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterProducts(btn.dataset.category);
    }, 300));
  });

  document.getElementById('load-more-btn').addEventListener('click', () => {
    currentPage++;
    renderProducts(document.querySelector('.occasion-btn.active').dataset.category);
  });

  const cartLink = document.querySelector('.cart-link');
  const miniCartDropdown = document.querySelector('.mini-cart-dropdown');
  cartLink.addEventListener('mouseenter', () => {
    miniCartDropdown.style.display = 'block';
  });
  cartLink.addEventListener('mouseleave', () => {
    miniCartDropdown.style.display = 'none';
  });

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
      const emailInput = e.target.querySelector('input[type="email"]');
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
  document.querySelector('.close-btn').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.style.display === 'block') closeModal();
  });

  window.addEventListener('hashchange', debounce(handleHashChange, 100));

  init();

  // Cleanup on unload
  window.addEventListener('unload', () => {
    disposeThreeJsResources();
    document.querySelectorAll('.quick-view-btn, .add-to-cart-btn, .wishlist-btn, .remove-btn, input[type="number"]').forEach(el => {
      el.replaceWith(el.cloneNode(true));
    });
  });
});