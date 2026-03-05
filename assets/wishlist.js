(() => {
  const STORAGE_KEY = 'theme_wishlist_handles_v1';
  const HEART_ICON = `
    <span class="svg-wrapper" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-heart" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 5.24 8.515 3.773a4.433 4.433 0 0 0-6.21 0 4.293 4.293 0 0 0 0 6.128L10 17.495l7.695-7.593a4.293 4.293 0 0 0 0-6.128 4.433 4.433 0 0 0-6.21 0zm.765-2.177c2.113-2.084 5.538-2.084 7.65 0a5.29 5.29 0 0 1 0 7.55l-7.695 7.593a1.03 1.03 0 0 1-1.44 0l-7.696-7.594a5.29 5.29 0 0 1 0-7.549C3.697.98 7.122.98 9.234 3.063l.766.755z"/>
      </svg>
    </span>
  `;

  const normalizeHandle = (value) => {
    if (!value) return '';
    return String(value).trim().toLowerCase();
  };

  const readWishlist = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.map(normalizeHandle).filter(Boolean))];
    } catch (error) {
      return [];
    }
  };

  const writeWishlist = (handles) => {
    const next = [...new Set(handles.map(normalizeHandle).filter(Boolean))];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      return;
    }
    document.dispatchEvent(new CustomEvent('wishlist:updated', { detail: { handles: next } }));
  };

  const toggleHandle = (handle) => {
    const normalized = normalizeHandle(handle);
    if (!normalized) return;
    const current = readWishlist();
    const index = current.indexOf(normalized);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(normalized);
    }
    writeWishlist(current);
  };

  const escapeHtml = (value) => {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  const formatMoney = (cents, moneyFormat) => {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      return window.Shopify.formatMoney(cents, moneyFormat);
    }
    const amount = Number(cents || 0) / 100;
    return `$${amount.toFixed(2)}`;
  };

  const getProductColor = (product) => {
    const optionNames = Array.isArray(product.options) ? product.options : [];
    let colorIndex = -1;
    optionNames.some((name, index) => {
      const normalized = String(name || '').toLowerCase();
      if (normalized.includes('color') || normalized.includes('colour')) {
        colorIndex = index;
        return true;
      }
      return false;
    });

    if (colorIndex === -1) return 'N/A';

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const candidate = variants.find((variant) => variant.available) || variants[0];
    if (!candidate) return 'N/A';

    const colorValue = candidate[`option${colorIndex + 1}`];
    return colorValue || 'N/A';
  };

  const withImageWidth = (url, width) => {
    if (!url) return '';
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}`;
  };

  const createWishlistCardMarkup = (product, moneyFormat) => {
    const title = escapeHtml(product.title || 'Product');
    const handle = escapeHtml(product.handle || '');
    const productUrl = escapeHtml(product.url || `/products/${handle}`);
    const imageSrc = withImageWidth(product.featured_image || (product.images || [])[0], 533);
    const color = escapeHtml(getProductColor(product));
    const price = escapeHtml(formatMoney(product.price, moneyFormat));

    return `
      <li class="grid__item wishlist-modal__item">
        <div class="card-wrapper product-card-wrapper underline-links-hover">
          <div class="card card--standard card--media card--extend-height" style="--ratio-percent: 100%;">
            <div class="card__inner color-scheme-1 gradient ratio" style="--ratio-percent: 100%;">
              <div class="card__media">
                <div class="media media--transparent">
                  <a href="${productUrl}" class="full-unstyled-link">
                    ${imageSrc ? `<img src="${escapeHtml(imageSrc)}" alt="${title}" class="motion-reduce" loading="lazy" width="533" height="533">` : ''}
                  </a>
                </div>
              </div>
              <button
                type="button"
                class="wishlist-card-toggle is-active"
                data-wishlist-toggle
                data-product-handle="${handle}"
                data-product-title="${title}"
                data-label-add="Add to wishlist"
                data-label-remove="Remove from wishlist"
                aria-pressed="true"
                aria-label="Remove from wishlist: ${title}"
              >
                ${HEART_ICON}
              </button>
            </div>
            <div class="card__content">
              <div class="card__information">
                <h3 class="card__heading h5">
                  <a href="${productUrl}" class="full-unstyled-link">${title}</a>
                </h3>
                <div class="card-information">
                  <p class="caption-large light wishlist-card__color">Color: ${color}</p>
                  <div class="price">
                    <div class="price__regular">
                      <span class="price-item price-item--regular">${price}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </li>
    `;
  };

  const updateToggleButtons = (scope = document) => {
    const items = new Set(readWishlist());
    scope.querySelectorAll('[data-wishlist-toggle][data-product-handle]').forEach((button) => {
      const handle = normalizeHandle(button.dataset.productHandle);
      if (!handle) return;
      const active = items.has(handle);
      const productTitle = button.dataset.productTitle || handle;
      const addLabel = button.dataset.labelAdd || 'Add to wishlist';
      const removeLabel = button.dataset.labelRemove || 'Remove from wishlist';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-label', `${active ? removeLabel : addLabel}: ${productTitle}`);
    });
  };

  const fetchProductByHandle = async (handle) => {
    try {
      const response = await fetch(`/products/${encodeURIComponent(handle)}.js`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const init = () => {
    const modal = document.querySelector('[data-wishlist-modal]');
    const itemsContainer = modal ? modal.querySelector('[data-wishlist-items]') : null;
    const emptyState = modal ? modal.querySelector('[data-wishlist-empty]') : null;
    const moneyFormat = modal?.dataset.moneyFormat || '${{amount}}';

    const renderWishlistModal = async () => {
      if (!modal || !itemsContainer || !emptyState) return;
      const handles = readWishlist();

      if (handles.length === 0) {
        itemsContainer.innerHTML = '';
        emptyState.hidden = false;
        return;
      }

      const products = await Promise.all(handles.map((handle) => fetchProductByHandle(handle)));
      const validHandles = [];
      const cards = [];

      products.forEach((product, index) => {
        if (!product || !product.handle) return;
        validHandles.push(handles[index]);
        cards.push(createWishlistCardMarkup(product, moneyFormat));
      });

      if (validHandles.length !== handles.length) {
        writeWishlist(validHandles);
      }

      itemsContainer.innerHTML = cards.join('');
      emptyState.hidden = cards.length > 0;
      updateToggleButtons(itemsContainer);
    };

    const openModal = async () => {
      if (!modal) return;
      modal.hidden = false;
      document.body.classList.add('wishlist-open');
      await renderWishlistModal();
    };

    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
      document.body.classList.remove('wishlist-open');
    };

    document.addEventListener('click', async (event) => {
      const openButton = event.target.closest('[data-wishlist-open]');
      if (openButton) {
        event.preventDefault();
        await openModal();
        return;
      }

      const closeButton = event.target.closest('[data-wishlist-close]');
      if (closeButton) {
        event.preventDefault();
        closeModal();
        return;
      }

      const toggleButton = event.target.closest('[data-wishlist-toggle]');
      if (!toggleButton) return;

      const handle = normalizeHandle(toggleButton.dataset.productHandle);
      if (!handle) return;
      event.preventDefault();
      toggleHandle(handle);
      updateToggleButtons();
      if (modal && !modal.hidden) {
        await renderWishlistModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal && !modal.hidden) {
        closeModal();
      }
    });

    window.addEventListener('storage', () => {
      updateToggleButtons();
    });

    document.addEventListener('wishlist:updated', () => {
      updateToggleButtons();
    });

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        updateToggleButtons();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    updateToggleButtons();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
