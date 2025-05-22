document.addEventListener('DOMContentLoaded', () => {
  let products = [];
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

  // Utility for toast notifications
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
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

  // Fetch products with error handling
  async function fetchProducts() {
    try {
      const response = await fetch('product.json');
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      products = await response.json();
      console.debug('Products loaded:', products.length);
      renderProducts();
      updateCartCount();
      updateWishlistButtons();
      handleHashChange();
      renderHero3DModel();
      setupIntersectionObserver();
    } catch (error) {
      console.error('Failed to load products:', error);
      showToast('Unable to load products. Please try again.', 'error');
    }
  }
  fetchProducts();

  // Intersection Observer for section animations
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

  // Mobile menu toggle with outside click close
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  function toggleMobileMenu() {
    navLinks.classList.toggle('nav-open');
    navToggle.classList.toggle('active');
    navToggle.setAttribute('aria-expanded', navLinks.classList.contains('nav-open'));
  }
  navToggle.addEventListener('click', toggleMobileMenu);
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', toggleMobileMenu);
  });
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !navToggle.contains(e.target) && navLinks.classList.contains('nav-open')) {
      toggleMobileMenu();
    }
  });

  // Category filter buttons
  document.querySelectorAll('.occasion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      console.debug('Filtering by category:', category);
      filterProducts(category);
      document.querySelectorAll('.occasion-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Navigation via hash changes
  window.addEventListener('hashchange', debounce(handleHashChange, 100));

  // Mini-cart hover functionality
  const cartLink = document.querySelector('.cart-link');
  const miniCartDropdown = document.querySelector('.mini-cart-dropdown');
  cartLink.addEventListener('mouseenter', () => {
    miniCartDropdown.style.display = 'block';
  });
  cartLink.addEventListener('mouseleave', () => {
    miniCartDropdown.style.display = 'none';
  });

  // FAQ toggle functionality
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const answer = question.nextElementSibling;
      const isOpen = answer.style.display === 'block';
      answer.style.display = isOpen ? 'none' : 'block';
      question.setAttribute('aria-expanded', !isOpen);
    });
  });

  // Newsletter form submission with validation (main and footer)
  document.querySelectorAll('.newsletter-form, .footer-newsletter form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = e.target.querySelector('input[type="email"]');
      const email = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
      }
      console.debug('Newsletter subscription:', email);
      showToast('Thank you for subscribing!', 'success');
      emailInput.value = '';
    });
  });

  // Close modal with escape key support
  const modal = document.getElementById('quick-view-modal');
  document.querySelector('.close-btn').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.style.display === 'block') closeModal();
  });

  // Render products with new-badge support
  function renderProducts(category = 'all') {
    const grid = document.querySelector('.product-grid');
    if (!grid) {
      console.error('Product grid not found.');
      return;
    }
    grid.innerHTML = '<p>Loading products...</p>';

    const filteredProducts = category === 'all'
      ? products
      : products.filter(p => p.category.toLowerCase() === category.toLowerCase());

    if (filteredProducts.length === 0) {
      grid.innerHTML = '<p class="empty-cart">No products found in this category.</p>';
      return;
    }

    grid.innerHTML = '';
    filteredProducts.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        ${p.isNew ? '<span class="new-badge">New</span>' : ''}
        <span class="category-badge">${p.category}</span>
        <button class="wishlist-btn" data-id="${p.id}" aria-label="Add ${p.name} to wishlist"><i class="fas fa-heart"></i></button>
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        <div class="content">
          <h3>${p.name}</h3>
          <p>${p.description}</p>
          <span class="price">$${p.price.toFixed(2)}</span>
        </div>
        <div class="button-container">
          <button class="quick-view-btn" data-id="${p.id}" aria-label="Quick view ${p.name}">Quick View</button>
          <button class="add-to-cart-btn" data-id="${p.id}" aria-label="Add ${p.name} to cart">Add to Cart</button>
        </div>
      `;
      grid.appendChild(card);
    });

    document.querySelectorAll('.quick-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        console.debug('Quick view clicked for product ID:', btn.dataset.id);
        openQuickView(btn.dataset.id);
      });
    });
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        console.debug('Add to cart clicked for product ID:', btn.dataset.id);
        addToCart(btn.dataset.id);
      });
    });
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        console.debug('Wishlist clicked for product ID:', btn.dataset.id);
        toggleWishlist(btn.dataset.id);
      });
    });
  }

  // Filter products
  function filterProducts(category) {
    renderProducts(category);
  }

  // Add product to cart
  function addToCart(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) {
      console.warn('Product not found:', productId);
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

  // Remove product from cart
  function removeFromCart(productId) {
    cart = cart.filter(item => item.id != productId);
    saveCart();
    renderCartPage();
    updateMiniCart();
    showToast('Item removed from cart.', 'success');
  }

  // Toggle product in wishlist
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

  // Update wishlist button states
  function updateWishlistButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      const id = btn.dataset.id;
      btn.classList.toggle('active', wishlist.includes(id));
    });
  }

  // Save cart to localStorage
  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
  }

  // Update cart count
  function updateCartCount() {
    try {
      const total = cart.reduce((sum, item) => sum + item.quantity, 0);
      const cartCount = document.getElementById('cart-count');
      if (cartCount) {
        cartCount.textContent = total;
      } else {
        console.warn('Cart count element not found.');
      }
    } catch (error) {
      console.error('Error updating cart count:', error);
    }
  }

  // Render cart page
  function renderCartPage() {
    const cartSection = document.getElementById('cart');
    const cartItems = cartSection.querySelector('.cart-items');
    if (!cartItems) {
      console.warn('Cart items container not found.');
      return;
    }
    cartItems.innerHTML = '<p>Loading cart...</p>';

    if (cart.length === 0) {
      cartItems.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
      return;
    }

    cartItems.innerHTML = '';
    cart.forEach(item => {
      const product = products.find(p => p.id == item.id);
      if (!product) {
        console.warn('Product not found in cart:', item.id);
        return;
      }

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
    if (totalElement) {
      totalElement.textContent = `Total: $${total.toFixed(2)}`;
    } else {
      console.warn('Cart total element not found.');
    }
  }

  // Handle navigation
  function handleHashChange() {
    const hash = window.location.hash || '#home';
    console.debug('Navigating to:', hash);
    document.querySelectorAll('section').forEach(sec => {
      sec.style.display = ('#' + sec.id) === hash ? 'block' : 'none';
    });
    if (hash === '#cart') renderCartPage();
  }

  // Update mini-cart dropdown
  function updateMiniCart() {
    const miniCartContent = document.querySelector('.mini-cart-content');
    if (!miniCartContent) {
      console.warn('Mini-cart content element not found.');
      return;
    }
    if (cart.length === 0) {
      miniCartContent.innerHTML = '<p>Your cart is empty.</p>';
      return;
    }

    miniCartContent.innerHTML = '';
    cart.forEach(item => {
      const product = products.find(p => p.id == item.id);
      if (!product) return;

      const div = document.createElement('div');
      div.className = 'mini-cart-item';
      div.innerHTML = `
        <img src="${product.image}" alt="${product.name}" width="30" loading="lazy" />
        <span>${product.name} x ${item.quantity}</span>
        <span>$${(product.price * item.quantity).toFixed(2)}</span>
      `;
      miniCartContent.appendChild(div);
    });
  }

  // Open quick view modal with carousel
  function openQuickView(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) {
      console.error('Product not found:', productId);
      showToast('Product not available.', 'error');
      return;
    }

    const modal = document.getElementById('quick-view-modal');
    if (!modal) {
      console.error('Quick view modal not found.');
      showToast('Unable to open product details.', 'error');
      return;
    }

    const nameElement = modal.querySelector('#modal-product-name');
    const descElement = modal.querySelector('#modal-product-description');
    const priceElement = modal.querySelector('#modal-product-price');
    const modelElement = document.getElementById('product-3d-model');
    const carousel = modal.querySelector('.carousel');
    const customizationDiv = document.getElementById('customization-options');
    const relatedGrid = document.getElementById('related-products-grid');
    const addToCartBtn = modal.querySelector('#add-to-cart-btn');

    if (!nameElement || !descElement || !priceElement || !modelElement || !carousel || !customizationDiv || !relatedGrid || !addToCartBtn) {
      console.error('One or more modal elements missing:', {
        nameElement, descElement, priceElement, modelElement, carousel, customizationDiv, relatedGrid, addToCartBtn
      });
      showToast('Error displaying product details.', 'error');
      return;
    }

    nameElement.textContent = product.name || 'Unknown Product';
    descElement.textContent = product.description || 'No description available.';
    priceElement.textContent = product.price ? `$${product.price.toFixed(2)}` : 'Price unavailable';

    // Populate carousel
    carousel.innerHTML = '';
    (product.images || [product.image]).forEach((img, index) => {
      const imgElement = document.createElement('img');
      imgElement.src = img;
      imgElement.alt = `${product.name} view ${index + 1}`;
      imgElement.setAttribute('loading', 'lazy');
      carousel.appendChild(imgElement);
    });

    // Populate customization options
    customizationDiv.innerHTML = '';
    if (product.customization) {
      customizationDiv.innerHTML = `
        <label for="custom-input">${product.customization.label}</label>
        ${product.customization.type === 'select' ? 
          `<select id="custom-input">
             ${product.customization.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
           </select>` :
          `<input type="${product.customization.type === 'image' ? 'file' : 'text'}" id="custom-input" placeholder="${product.customization.label}" accept="${product.customization.type === 'image' ? 'image/*' : ''}" aria-label="${product.customization.label}">`
        }
      `;
    } else {
      customizationDiv.innerHTML = '<p>No customization available.</p>';
    }

    // Populate related products
    relatedGrid.innerHTML = '';
    (product.relatedProducts || []).forEach(relatedId => {
      const related = products.find(p => p.id == relatedId);
      if (related) {
        const div = document.createElement('div');
        div.className = 'related-product';
        div.innerHTML = `
          <img src="${related.image}" alt="${related.name}" loading="lazy" />
          <span>${related.name}</span>
        `;
        relatedGrid.appendChild(div);
      }
    });

    // Render 3D model
    modelElement.innerHTML = '<p>Loading 3D model...</p>';
    if (product.modelUrl) {
      modal.style.opacity = '0';
      modal.style.display = 'block';
      setTimeout(() => {
        modal.style.opacity = '1';
        render3DModel(product.modelUrl, modelElement);
      }, 50);
    } else {
      modelElement.innerHTML = '<p>3D model not available</p>';
      console.warn('No modelUrl for product:', product.name);
    }

    // Add to cart button
    const newBtn = addToCartBtn.cloneNode(true);
    addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
    newBtn.dataset.id = productId;
    newBtn.addEventListener('click', () => {
      console.debug('Modal add to cart clicked for product ID:', productId);
      addToCart(productId);
      closeModal();
    });

    modal.focus();
    console.debug('Quick view modal opened for:', product.name);
  }

  // Close modal
  function closeModal() {
    if (modal) {
      modal.style.opacity = '0';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
      console.debug('Quick view modal closed.');
    }
  }

  // Render 3D model with Three.js and OrbitControls
  function render3DModel(modelUrl, canvas) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      console.error('Invalid canvas element for 3D rendering:', canvas);
      canvas.innerHTML = '<p>3D rendering failed.</p>';
      showToast('3D rendering failed.', 'error');
      return;
    }

    const defaultWidth = 400;
    const defaultHeight = 300;
    const width = Math.min(canvas.parentElement.clientWidth || defaultWidth, defaultWidth);
    const height = Math.min(canvas.parentElement.clientHeight || defaultHeight, defaultHeight);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    console.debug('Canvas dimensions set:', { width, height });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    const gl = renderer.getContext();
    if (!gl) {
      console.error('WebGL context not available.');
      canvas.innerHTML = '<p>WebGL not supported.</p>';
      showToast('Your browser does not support 3D rendering.', 'error');
      return;
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
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
        console.debug('GLTF model loaded successfully:', modelUrl);
        const model = gltf.scene;
        scene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2 / maxDim;
        model.scale.set(scale, scale, scale);
        model.position.sub(center.multiplyScalar(scale));

        model.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material = new THREE.MeshStandardMaterial({
              color: child.material.color || 0xffffff,
              metalness: 0.5,
              roughness: 0.5
            });
          }
        });

        camera.position.set(0, 0, 3);
        controls.update();

        function animate() {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();
      },
      (xhr) => {
        console.debug(`Loading progress: ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
      },
      (error) => {
        console.error('Failed to load GLTF model:', error);
        canvas.innerHTML = '<p>Failed to load 3D model.</p>';
        showToast('Unable to load 3D model.', 'error');
      }
    );

    const resizeHandler = () => {
      const newWidth = Math.min(canvas.parentElement.clientWidth || defaultWidth, defaultWidth);
      const newHeight = Math.min(canvas.parentElement.clientHeight || defaultHeight, defaultHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
      console.debug('Canvas resized:', { newWidth, newHeight });
    };
    window.addEventListener('resize', resizeHandler);

    modal.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'opacity' && modal.style.display === 'none') {
        window.removeEventListener('resize', resizeHandler);
        renderer.dispose();
        scene.clear();
        console.debug('Cleaned up 3D renderer for:', modelUrl);
      }
    }, { once: true });
  }

  // Render hero section 3D model
  function renderHero3DModel() {
    const featuredProduct = products.find(p => p.featured) || products[0];
    const heroCanvas = document.getElementById('hero-3d-model');
    if (featuredProduct?.modelUrl && heroCanvas) {
      console.debug('Rendering hero 3D model for:', featuredProduct.name);
      render3DModel(featuredProduct.modelUrl, heroCanvas);
    } else {
      console.warn('No featured product or hero canvas found:', { featuredProduct, heroCanvas });
      if (heroCanvas) heroCanvas.innerHTML = '<p>3D model not available</p>';
    }
  }

  // Fetch and render testimonials
  async function fetchTestimonials() {
    try {
      const response = await fetch('testimonials.json');
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      const grid = document.querySelector('.testimonial-grid');
      if (!grid) {
        console.warn('Testimonial grid not found.');
        return;
      }
      grid.innerHTML = '';
      data.forEach(testimonial => {
        const div = document.createElement('div');
        div.className = 'testimonial';
        div.innerHTML = `
          <img src="${testimonial.image}" alt="${testimonial.name}" loading="lazy" />
          <p>"${testimonial.quote}"</p>
          <h4>${testimonial.name}</h4>
        `;
        grid.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading testimonials:', error);
      showToast('Unable to load testimonials.', 'info');
      const grid = document.querySelector('.testimonial-grid');
      if (grid) {
        grid.innerHTML = '<p>Testimonials unavailable.</p>';
      }
    }
  }
  fetchTestimonials();

  // Cleanup event listeners on page unload
  window.addEventListener('unload', () => {
    document.querySelectorAll('.quick-view-btn, .add-to-cart-btn, .wishlist-btn, .remove-btn, input[type="number"]').forEach(el => {
      el.replaceWith(el.cloneNode(true));
    });
  });
});