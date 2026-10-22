export class CartService {
  constructor() {
    let savedCart = localStorage.getItem("cart");
    this.cart = savedCart ? JSON.parse(savedCart) : [];
  }

  save() {
    localStorage.setItem("cart", JSON.stringify(this.cart));
    this.renderCartUI();
  }

  addItem(product) {
    let existing = null;
    for (let i = 0; i < this.cart.length; i++) {
      if (String(this.cart[i].id) == String(product.id)) {
        existing = this.cart[i];
        break;
      }
    }

    if (existing) {
      existing.cantidad += 1;
    } else {
      let newItem = Object.assign({}, product);
      newItem.cantidad = 1;
      this.cart.push(newItem);
    }
    this.save();
  }

  removeItem(productId) {
    let newCart = [];
    for (let i = 0; i < this.cart.length; i++) {
      if (String(this.cart[i].id) != String(productId)) {
        newCart.push(this.cart[i]);
      }
    }
    this.cart = newCart;
    this.save();
  }

  updateQuantity(productId, quantity) {
    for (let i = 0; i < this.cart.length; i++) {
      if (String(this.cart[i].id) == String(productId)) {
        let newQty = parseInt(quantity);
        if (isNaN(newQty) || newQty < 1) newQty = 1;
        this.cart[i].cantidad = newQty;
        break;
      }
    }
    this.save();
  }

  clear() {
    this.cart = [];
    localStorage.removeItem("cart");
    this.renderCartUI();
  }

  getItems() {
    return this.cart;
  }

  getTotal() {
    let total = 0;
    for (let i = 0; i < this.cart.length; i++) {
      let price = Number(this.cart[i].precio);
      if (isNaN(price)) price = 0;
      total += price * this.cart[i].cantidad;
    }
    return total;
  }

  renderCartUI() {
    let totalCount = 0;
    for (let i = 0; i < this.cart.length; i++) {
      totalCount += this.cart[i].cantidad;
    }

    // 1. Actualizar número de ícono
    let badge = document.getElementById("cart-count");
    if (badge) {
      badge.innerText = totalCount;
    } else {
      let badges = document.querySelectorAll(".bg-orange-500.text-white.rounded-full");
      for (let i = 0; i < badges.length; i++) {
        let b = badges[i];
        let txt = b.innerText.trim();
        if (txt == "0" || !isNaN(Number(txt))) {
          b.innerText = totalCount;
        }
      }
    }

    // 2. Actualizar el Total y evitar errores de caracteres
    let totalFormatted = "$" + this.getTotal().toLocaleString();
    let totalElement = document.getElementById("cart-total");
    
    if (!totalElement) {
      let spans = document.querySelectorAll("span, b, strong, p");
      for (let i = 0; i < spans.length; i++) {
        let el = spans[i];
        let txt = el.innerText;
        
        let isMatch = false;
        if (txt.includes("$20")) isMatch = true;
        if (txt.includes("$ 20")) isMatch = true;
        if (el.classList.contains("total-actualizado")) isMatch = true;
        
        if (isMatch) {
          totalElement = el;
          break;
        }
      }
    }

    if (totalElement) {
      totalElement.innerText = totalFormatted;
      totalElement.classList.add("total-actualizado");
    }

    // 3. Crear contenedor de productos de forma segura
    let container = document.getElementById("cart-items-container");
    
    if (!container) {
      container = document.createElement("div");
      container.id = "cart-items-container";
      container.className = "flex-1 overflow-y-auto p-6 space-y-4";
      
      let headers = document.querySelectorAll("h2, h3, span");
      let targetHeader = null;
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].innerText.includes("Tu Pedido")) {
          targetHeader = headers[i].parentElement;
          if (targetHeader && targetHeader.parentElement) {
            let p = targetHeader.parentElement;
            if (p.tagName == "HEADER" || p.classList.contains("border-b")) {
              targetHeader = p;
            }
          }
          break;
        }
      }

      if (targetHeader && targetHeader.parentElement) {
        targetHeader.insertAdjacentElement("afterend", container);
      }
    }

    if (!container) return;
    container.innerHTML = "";

    // 4. Dibujar los ítems y calcular subtotales
    if (this.cart.length == 0) {
      container.innerHTML = '<div class="text-center py-8 text-slate-400"><p class="text-sm font-medium">El carrito está vacío</p></div>';
      return;
    }

    for (let i = 0; i < this.cart.length; i++) {
      let item = this.cart[i];
      let row = document.createElement("div");
      row.className = "flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3";
      
      let priceVal = Number(item.precio);
      if (isNaN(priceVal)) priceVal = 0;
      let subtotalVal = priceVal * item.cantidad;
      
      let priceFmt = priceVal.toLocaleString();
      let subFmt = subtotalVal.toLocaleString();
      
      let svgIcon = '<svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';

      row.innerHTML = `
        <div class="flex-1 pr-4">
          <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">${item.nombre}</h4>
          <p class="text-sm text-orange-500 font-bold">$${priceFmt}</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex flex-col items-end">
             <span class="text-xs text-slate-400 font-medium mb-1">Sub: $${subFmt}</span>
             <input type="number" min="1" value="${item.cantidad}" data-id="${item.id}" class="cart-item-qty w-14 text-center text-sm p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-100 font-bold focus:outline-none">
          </div>
          <button data-id="${item.id}" class="btn-remove-item text-rose-500 hover:text-rose-600 p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-lg transition mt-4 cursor-pointer z-10 relative">
            ${svgIcon}
          </button>
        </div>
      `;
      container.appendChild(row);
    }

    // 5. Activar botones de suma, resta y papelera
    let inputs = container.querySelectorAll(".cart-item-qty");
    for (let i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener("change", (e) => {
        let id = e.target.getAttribute("data-id");
        let qty = parseInt(e.target.value);
        if (isNaN(qty)) qty = 1;
        this.updateQuantity(id, qty);
      });
    }

    let btns = container.querySelectorAll(".btn-remove-item");
    for (let i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", (e) => {
        let btnEl = e.target.closest("button");
        if (btnEl) {
          let id = btnEl.getAttribute("data-id");
          this.removeItem(id);
        }
      });
    }
  }
}