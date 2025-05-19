// script.js

document.addEventListener('DOMContentLoaded', () => {
  // — State
  let products = []
  // Load raw cart, but sanitize into {id: string, quantity: number}
  let rawCart = JSON.parse(localStorage.getItem('cart')) || []
  let cart = rawCart
    .map(item => {
      // If someone stored full product, pick id & quantity
      const id = String(item.id ?? item.productId ?? '')
      const qty = Number(item.quantity) || 0
      return id && qty > 0 ? { id, quantity: qty } : null
    })
    .filter(x => x)

  const footer = document.querySelector('footer')
  const cartCountElem = document.getElementById('cart-count')

  // — Helpers
  function log(...args) { console.log('[Shop]', ...args) }

  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart))
    updateCartCount()
    log('Cart saved', cart)
  }

  function updateCartCount() {
    const total = cart.reduce((sum, i) => sum + i.quantity, 0)
    cartCountElem.textContent = total
    log('Cart count', total)
  }

  // — Fetch & normalize products
  async function loadProducts() {
    try {
      const res = await fetch('product.json')
      if (!res.ok) throw new Error(`Fetch failed ${res.status}`)
      const data = await res.json()
      // Ensure ids are strings
      products = data.map(p => ({ ...p, id: String(p.id) }))
      log('Products loaded', products)
      renderProducts()
      updateCartCount()
      handleHashChange()
    } catch (err) {
      console.error('[Shop] Error loading products:', err)
    }
  }

  // — Render Shop
  function renderProducts() {
    let shop = document.getElementById('shop')
    if (!shop) {
      shop = document.createElement('section')
      shop.id = 'shop'
      shop.className = 'shop'
      footer.before(shop)
    }
    shop.innerHTML = `
      <div class="container">
        <h2>Our Products</h2>
        <div class="product-grid"></div>
      </div>
    `
    const grid = shop.querySelector('.product-grid')

    products.forEach(p => {
      const card = document.createElement('div')
      card.className = 'product-card'
      card.innerHTML = `
        <img src="${p.image}" alt="${p.name}" />
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <span>$${p.price.toFixed(2)}</span>
        <button data-id="${p.id}">Add to Cart</button>
      `
      grid.append(card)
    })

    // Delegate add-to-cart
    grid.addEventListener('click', e => {
      const btn = e.target.closest('button[data-id]')
      if (!btn) return
      const id = btn.dataset.id
      const prod = products.find(x => x.id === id)
      if (!prod) {
        return log('No product match for id', id)
      }
      const existing = cart.find(i => i.id === id)
      if (existing) existing.quantity++
      else cart.push({ id, quantity: 1 })
      saveCart()
      alert(`Added “${prod.name}” to cart.`)
    })

    log('Shop rendered')
  }

  // — Render Cart Page
  function renderCartPage() {
    const old = document.getElementById('cart')
    if (old) old.remove()

    const sec = document.createElement('section')
    sec.id = 'cart'
    sec.className = 'cart'
    sec.innerHTML = `
      <div class="container">
        <h2>Your Cart</h2>
        <div class="cart-items"></div>
      </div>
    `
    footer.before(sec)

    const list = sec.querySelector('.cart-items')
    if (cart.length === 0) {
      list.innerHTML = '<p>Your cart is empty.</p>'
    } else {
      cart.forEach(item => {
        const prod = products.find(p => p.id === item.id)
        if (!prod) {
          log('Missing product for cart item', item)
          return
        }
        const div = document.createElement('div')
        div.className = 'cart-item'
        div.innerHTML = `
          <h3>${prod.name}</h3>
          <p>Qty: ${item.quantity}</p>
          <p>Subtotal: $${(prod.price * item.quantity).toFixed(2)}</p>
          <button data-id="${prod.id}">Remove</button>
        `
        list.append(div)
      })

      // Total
      const total = cart.reduce((sum, it) => {
        const p = products.find(x => x.id === it.id)
        return sum + (p ? p.price * it.quantity : 0)
      }, 0)
      list.innerHTML += `
        <div class="cart-total"><h3>Total: $${total.toFixed(2)}</h3></div>
      `

      // Delegate remove
      list.addEventListener('click', e => {
        const btn = e.target.closest('button[data-id]')
        if (!btn) return
        const id = btn.dataset.id
        cart = cart.filter(i => i.id !== id)
        saveCart()
        renderCartPage()
      })
    }
    log('Cart rendered')
  }

  // — Navigation
  function showSection(hash) {
    document.querySelectorAll('section').forEach(sec => {
      sec.style.display = ('#' + sec.id) === hash ? 'block' : 'none'
    })
    if (hash === '#cart') renderCartPage()
  }

  function handleHashChange() {
    const hash = window.location.hash || '#home'
    log('Navigating to', hash)
    showSection(hash)
  }

  window.addEventListener('hashchange', handleHashChange)

  // — Initialize
  loadProducts()
})
