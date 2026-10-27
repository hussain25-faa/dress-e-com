# SAAYA image upgrade

The storefront now uses curated external fashion-photo URLs for the homepage hero, product cards, product detail modal, and bag thumbnails. The original SVG illustrations are retained as local fallbacks, so the shop still has imagery if a remote image host is unavailable.

## Notes
- Internet access is needed to load the remote photography.
- Photo URLs are served by Pexels and Unsplash; check each provider's current license/terms and ensure the selected image is suitable for commercial use before deploying a live store.
- Product titles, prices, categories, stock, API endpoints, cart/wishlist local storage, checkout form, and SQLite schema were not changed.
- To customize a product image, edit `photoByProduct` in `static/js/app.js`. The homepage hero is configured in `templates/index.html`.
